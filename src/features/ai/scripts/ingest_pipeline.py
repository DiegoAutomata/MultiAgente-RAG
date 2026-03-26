import os
import asyncio
import sys
from dotenv import load_dotenv

# Import SDKs
from supabase import create_client, Client

try:
    from llama_parse import LlamaParse
except ImportError:
    LlamaParse = None

try:
    import voyageai
except ImportError:
    voyageai = None

# Load environment variables (from .env or .env.local)
load_dotenv(".env.local")
load_dotenv(".env")

# Supabase Client setup
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("WARNING: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    supabase = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_voyage_client():
    if not voyageai:
        return None
    api_key = os.getenv("VOYAGE_API_KEY")
    if not api_key:
        return None
    return voyageai.Client(api_key=api_key)


async def parse_pdf(file_path: str) -> str:
    """Uses LlamaParse to extract text from a PDF with markdown structure, falling back to PyPDF if key is missing."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF missing: {file_path}")
    
    llama_key = os.getenv("LLAMA_CLOUD_API_KEY")
    if not llama_key or not LlamaParse:
        print("INFO: Using PyPDF parser (open source, no API key needed).")
        if file_path.endswith('.txt'):
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
                
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text
        
    parser = LlamaParse(
        api_key=llama_key,
        result_type="markdown",
        verbose=True
    )
    
    print(f"Parsing {file_path} via LlamaParse...")
    documents = await asyncio.to_thread(parser.load_data, file_path)
    
    full_text = "\n\n".join([doc.text for doc in documents])
    return full_text


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


async def ingest_document(user_id: str, file_path: str, title: str):
    print(f"🚀 Starting ingestion for document: {title}")
    
    # 1. Parsing
    parsed_text = await parse_pdf(file_path)
    parsed_text = parsed_text.replace("\x00", "")
    
    if not parsed_text.strip():
        print("❌ PDF parsing returned empty text. Aborting.")
        return
    
    print(f"📝 Parsed {len(parsed_text)} characters from PDF.")
    
    # 2. Chunking
    chunks = chunk_text(parsed_text)
    print(f"✂️  Generated {len(chunks)} chunks.")
    
    if not supabase:
        print("❌ Supabase client not initialized. Aborting insert.")
        return

    # 3. Create Document Record
    doc_response = supabase.table("documents").insert({
        "title": title,
        "content_type": "pdf",
        "metadata": {"source_file": os.path.basename(file_path)}
    }).execute()
    
    document_id = doc_response.data[0]["id"]
    print(f"📄 Created document record ID: {document_id}")
    
    # 4. Setup Embedding Model
    voyage_client = get_voyage_client()
    local_embedder = None
    
    if not voyage_client:
        try:
            from sentence_transformers import SentenceTransformer
            print("🚀 Loading local embedding model (all-MiniLM-L6-v2)...")
            local_embedder = SentenceTransformer("all-MiniLM-L6-v2")
        except ImportError:
            print("⚠️ sentence-transformers not installed. Chunks will be stored without embeddings.")
    
    # 5. Process and Insert Chunks (NO AI refinement - raw text is best for RAG)
    print("🧠 Generating embeddings and storing chunks...")
    
    for idx, chunk in enumerate(chunks):
        embedding_vec = None
        if voyage_client:
            result = voyage_client.embed(texts=[chunk], model="voyage-3", input_type="document")
            embedding_vec = result.embeddings[0]
        elif local_embedder:
            embedding_vec = local_embedder.encode([chunk])[0].tolist()

        chunk_data = {
            "document_id": document_id,
            "content": chunk,
            "chunk_index": idx
        }
        
        if embedding_vec:
            chunk_data["embedding"] = embedding_vec
            
        supabase.table("document_chunks").insert(chunk_data).execute()
        
        if (idx + 1) % 10 == 0 or idx == 0 or idx == len(chunks) - 1:
            print(f"   ✅ Inserted chunk {idx+1}/{len(chunks)}")

    print(f"🎉 Ingestion completed for {title}! ({len(chunks)} chunks stored)")


async def main():
    if len(sys.argv) < 3:
        print("Usage: ./venv/bin/python src/features/ai/scripts/ingest_pipeline.py <user_uuid> <path_to_file>")
        sys.exit(1)
        
    user_id = sys.argv[1]
    file_path = sys.argv[2]
    title = os.path.basename(file_path)
    
    await ingest_document(user_id=user_id, file_path=file_path, title=title)

if __name__ == "__main__":
    asyncio.run(main())
