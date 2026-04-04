import os
import asyncio
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables (from .env or .env.local)
load_dotenv(".env.local")
load_dotenv(".env")

# Supabase Client setup
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env", file=sys.stderr)
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def set_document_status(document_id: str, status: str, error_msg: str = None):
    """Update document status in DB. status: 'processing' | 'completed' | 'failed'"""
    try:
        payload = {"status": status}
        if error_msg:
            payload["metadata"] = {"error": error_msg[:500]}
        supabase.table("documents").update(payload).eq("id", document_id).execute()
    except Exception as e:
        print(f"⚠️ Could not update document status to '{status}': {e}", file=sys.stderr)


def parse_pdf_fast(file_path: str) -> str:
    """
    Fast table-aware PDF parser using PyMuPDF (fitz).
    - ~2-5s for a 24MB PDF (vs 90s pdfplumber, 27s pypdf)
    - sort=True preserves spatial reading order: left→right, top→bottom
    - Correctly associates table rows (Autopistas | 130 km/h | 80 km/h)
    Falls back to pypdf if PyMuPDF unavailable.
    """
    if file_path.endswith('.txt'):
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()

    try:
        import fitz  # PyMuPDF
        doc = fitz.open(file_path)
        pages_text = []
        for page in doc:
            text = page.get_text("text", sort=True)
            if text.strip():
                pages_text.append(text)
        doc.close()
        return "\n\n".join(pages_text)
    except ImportError:
        pass

    # Fallback: pypdf (slower, worse table order)
    print("WARNING: PyMuPDF not found, using pypdf fallback (tables may be out of order)")
    from pypdf import PdfReader
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text



def chunk_text(text: str, chunk_size: int = 1500, overlap: int = 200) -> list[str]:
    """Basic sliding window chunking."""
    chunks = []
    start = 0
    text_len = len(text)
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunk = text[start:end]
        # Skip chunks that are too short or mostly whitespace
        if len(chunk.strip()) > 50:
            chunks.append(chunk)
        start += (chunk_size - overlap)
    return chunks


def generate_and_store_embeddings(document_id: str):
    """Phase 2: fetch existing chunks, generate embeddings, update rows in batch."""
    # Fetch chunks ordered by chunk_index
    rows = supabase.table("document_chunks") \
        .select("id, content, chunk_index") \
        .eq("document_id", document_id) \
        .order("chunk_index") \
        .execute()

    if not rows.data:
        print(f"⚠️ No chunks found for document {document_id}")
        return

    chunks = [r["content"] for r in rows.data]
    ids = [r["id"] for r in rows.data]
    print(f"🧠 Generating embeddings for {len(chunks)} chunks...")

    try:
        from sentence_transformers import SentenceTransformer
        local_embedder = SentenceTransformer("all-MiniLM-L6-v2")
        batch_embeddings = local_embedder.encode(chunks, batch_size=64, show_progress_bar=False)
        embeddings = [vec.tolist() for vec in batch_embeddings]
        print(f"   ✅ {len(embeddings)} embeddings via local model")
    except ImportError:
        print("⚠️ sentence-transformers not installed. Skipping embeddings.")
        return

    # Update each chunk with its embedding
    for chunk_id, emb in zip(ids, embeddings):
        supabase.table("document_chunks") \
            .update({"embedding": emb}) \
            .eq("id", chunk_id) \
            .execute()

    print(f"✅ Embeddings stored for document {document_id}")


async def ingest_document(user_id: str, file_path: str, title: str):
    """
    Streaming ingestion: page-by-page parse → chunk → insert.
    The document becomes searchable after the FIRST batch of pages (~2s).
    Works for any file size with constant memory usage.
    Status transitions: processing → completed (or failed on error).
    """
    print(f"🚀 Starting streaming ingestion for: {title}")
    document_id = None

    try:
        # 1. Create document record FIRST with status='processing'
        doc_response = supabase.table("documents").insert({
            "user_id": user_id,
            "title": title,
            "content_type": "pdf",
            "status": "processing",
            "metadata": {"source_file": os.path.basename(file_path)}
        }).execute()
        document_id = doc_response.data[0]["id"]
        print(f"📄 Document record created: {document_id}")

        # 2. Stream pages with PyMuPDF — insert chunks as we go
        try:
            import fitz
        except ImportError:
            raise RuntimeError("PyMuPDF not installed. Run: pip install pymupdf")

        PAGES_PER_BATCH = 15
        CHUNK_SIZE = 1500
        OVERLAP = 200
        DB_BATCH = 500

        doc = fitz.open(file_path)
        total_pages = len(doc)
        print(f"📄 {total_pages} pages to process (streaming {PAGES_PER_BATCH} pages/batch)")

        text_buffer = ""
        chunk_index = 0
        total_chunks = 0

        for batch_start in range(0, total_pages, PAGES_PER_BATCH):
            batch_end = min(batch_start + PAGES_PER_BATCH, total_pages)

            batch_text = text_buffer
            for page_num in range(batch_start, batch_end):
                page_text = doc[page_num].get_text("text", sort=True)
                if page_text.strip():
                    batch_text += "\n" + page_text

            batch_text = batch_text.replace("\x00", "")

            is_last_batch = (batch_end >= total_pages)
            chunks = chunk_text(batch_text, chunk_size=CHUNK_SIZE, overlap=OVERLAP)

            if not is_last_batch and len(batch_text) > OVERLAP:
                text_buffer = batch_text[-OVERLAP:]
            else:
                text_buffer = ""

            if not chunks:
                continue

            rows = [
                {
                    "document_id": document_id,
                    "user_id": user_id,
                    "content": chunk,
                    "chunk_index": chunk_index + i,
                }
                for i, chunk in enumerate(chunks)
            ]
            for i in range(0, len(rows), DB_BATCH):
                supabase.table("document_chunks").insert(rows[i:i + DB_BATCH]).execute()

            chunk_index += len(chunks)
            total_chunks += len(chunks)

            pct = int(batch_end / total_pages * 100)
            print(f"   ✅ Pages {batch_start+1}-{batch_end}/{total_pages} ({pct}%) → {total_chunks} chunks indexed")

        doc.close()
        print(f"✅ Phase 1 done — {total_chunks} chunks stored. Document fully searchable!")

        # 3. Mark as completed NOW — frontend can proceed, document is searchable
        set_document_status(document_id, "completed")
        print(f"✅ Document marked as completed. Frontend can now query it.")

        # 4. Phase 2 — Embeddings in background (improves semantic search quality)
        generate_and_store_embeddings(document_id)
        print(f"🎉 Ingestion completed for {title}! ({total_chunks} chunks, embeddings done)")

    except Exception as e:
        error_str = str(e)
        print(f"❌ Ingestion failed for {title}: {error_str}", file=sys.stderr)
        if document_id:
            set_document_status(document_id, "failed", error_str)
        sys.exit(1)

    finally:
        # Always clean up temp file
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"🗑️ Temp file removed: {file_path}")
        except OSError as e:
            print(f"⚠️ Could not remove temp file {file_path}: {e}", file=sys.stderr)


async def main():
    # Mode: --parse-only <file_path>  →  prints extracted text to stdout
    if len(sys.argv) >= 2 and sys.argv[1] == "--parse-only":
        if len(sys.argv) < 3:
            print("Usage: ingest_pipeline.py --parse-only <file_path>", file=sys.stderr)
            sys.exit(1)
        text = parse_pdf_fast(sys.argv[2])
        sys.stdout.buffer.write(text.replace("\x00", "").encode("utf-8"))
        return

    # Mode: --embeddings-only <document_id>
    if len(sys.argv) >= 2 and sys.argv[1] == "--embeddings-only":
        if len(sys.argv) < 3:
            print("Usage: ingest_pipeline.py --embeddings-only <document_id>")
            sys.exit(1)
        document_id = sys.argv[2]
        generate_and_store_embeddings(document_id)
        return

    # Default mode: <user_uuid> <path_to_file>
    if len(sys.argv) < 3:
        print("Usage: ./venv/bin/python src/features/ai/scripts/ingest_pipeline.py <user_uuid> <path_to_file>")
        sys.exit(1)

    user_id = sys.argv[1]
    file_path = sys.argv[2]
    # Strip UUID prefix added by upload route (e.g. "uuid-filename.pdf" → "filename.pdf")
    raw_name = os.path.basename(file_path)
    title = raw_name[37:] if len(raw_name) > 37 and raw_name[36] == '-' else raw_name

    await ingest_document(user_id=user_id, file_path=file_path, title=title)

if __name__ == "__main__":
    asyncio.run(main())
