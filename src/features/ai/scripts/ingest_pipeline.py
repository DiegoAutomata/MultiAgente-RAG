import os
import asyncio
import sys
from dotenv import load_dotenv

# Import SDKs
from supabase import create_client, Client
from llama_parse import LlamaParse
from claude_agent_sdk.client import ClaudeSDKClient

try:
    import voyageai
except ImportError:
    voyageai = None

# Load environment variables (from .env or .env.local)
load_dotenv(".env.local")
load_dotenv(".env")

# Supabase Client setup
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Use Service Role for backend insertion

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("WARNING: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    supabase = None
else:
    # We must use the service role key to bypass RLS for inserting on behalf of users,
    # or login as the user if we had their token. Since this is a backend script, 
    # using service_role is standard, then we attach their user_id.
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
    if not llama_key:
        print("WARNING: LLAMA_CLOUD_API_KEY missing. Falling back to simple PyPDF parser (no table extraction).")
        if file_path.endswith('.txt'):
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
                
        # 🛡️ Fallback robusto a PyPDF (Open Source) si el cliente no configuró la key premium
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
    # LlamaParse.load_data is synchronous, wrap it in thread
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
        chunks.append(chunk)
        start += (chunk_size - overlap)
    return chunks


async def enrich_chunk_with_agent(client: ClaudeSDKClient, chunk: str) -> str:
    """Uses Anthropic Agent SDK to cleanup or summarize the chunk before embedding."""
    # This invokes Anthropic Agent SDK
    prompt = f"Please clean up this text chunk for better semantic search retrieval. Fix formatting only. Text:\n{chunk}"
    
    refined_chunk = ""
    # We send query and stream the response
    await client.query(prompt)
    
    # We must import message types inside or at top level to parse
    from claude_agent_sdk.types import AssistantMessage, TextBlock
    
    async for msg in client.receive_response():
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock):
                    refined_chunk += block.text
    
    return refined_chunk if refined_chunk else chunk


async def ingest_document(user_id: str, file_path: str, title: str):
    print(f"🚀 Starting ingestion for document: {title}")
    
    # 1. Parsing
    parsed_text = await parse_pdf(file_path)
    
    # 2. Chunking
    chunks = chunk_text(parsed_text)
    print(f"✂️  Generated {len(chunks)} chunks.")
    
    if not supabase:
        print("❌ Supabase client not initialized. Aborting insert.")
        return

    # 3. Create Document Record
    doc_response = supabase.table("documents").insert({
        "user_id": user_id,
        "title": title,
        "content_type": "pdf",
        "metadata": {"source_file": os.path.basename(file_path)}
    }).execute()
    
    document_id = doc_response.data[0]["id"]
    print(f"📄 Created document record ID: {document_id}")
    
    # 4. Processing Chunks (Embedding & Storage)
    voyage_client = get_voyage_client()
    
    print("🧠 Generating embeddings and enriching via Anthropic Agent SDK...")
    
    # We instantiate the Anthropic SDK to refine chunks optimally
    # Required: ANTHROPIC_API_KEY in .env
    has_anthropic = bool(os.getenv("ANTHROPIC_API_KEY"))

    async def _process_chunks(_claude_client):
        for idx, chunk in enumerate(chunks):
            final_chunk = chunk
            
            # Optional: AI Refinement
            if _claude_client:
                final_chunk = await enrich_chunk_with_agent(_claude_client, chunk)
                
            embedding_vec = None
            if voyage_client:
                # Voyage AI recommends voyage-3 for general text
                result = voyage_client.embed(texts=[final_chunk], model="voyage-3", input_type="document")
                embedding_vec = result.embeddings[0]

            # In pgvector / Supabase, we insert list of floats directly into vector column
            chunk_data = {
                "document_id": document_id,
                "user_id": user_id,
                "content": final_chunk,
                "chunk_index": idx
            }
            
            if embedding_vec:
                chunk_data["embedding"] = embedding_vec
                
            supabase.table("document_chunks").insert(chunk_data).execute()
            print(f"   ✅ Inserted chunk {idx+1}/{len(chunks)}")
    
    if has_anthropic:
        print("🤖 Anthropic Agent SDK active: Refining chunks...")
        async with ClaudeSDKClient() as claude_client:
            # Some versions might require permission mode
            if hasattr(claude_client, 'set_permission_mode'):
                await claude_client.set_permission_mode('acceptEdits')
            
            # 🚀 Force the Agent SDK to use the Sonnet 4.6 Model:
            if hasattr(claude_client, 'set_model'):
                await claude_client.set_model('claude-4-6-sonnet-latest')
                
            await _process_chunks(claude_client)
    else:
        print("⚠️ ANTHROPIC_API_KEY missing: Skipping chunk refinement.")
        await _process_chunks(None)

    print(f"🎉 Ingestion fully completed for {title}!")


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
