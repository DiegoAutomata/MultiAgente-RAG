-- migration 20260319000000_init_rag.sql
-- 1. Activar la extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 2. Crear las tablas principales
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT DEFAULT 'pdf',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: We are using 1024 as the standard for Voyage AI embedding vectors
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1024),
  chunk_index INTEGER NOT NULL,
  -- fts (Full Text Search) column for BM25 hybrid search
  fts tsvector GENERATED ALWAYS AS (to_tsvector('spanish', content)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para documents
CREATE POLICY "Users can read own documents" 
ON documents FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" 
ON documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" 
ON documents FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" 
ON documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Políticas para document_chunks
CREATE POLICY "Users can read own chunks" 
ON document_chunks FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chunks" 
ON document_chunks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chunks" 
ON document_chunks FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chunks" 
ON document_chunks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Índices para performance
-- HNSW index for vector similarity (pgvector >= 0.5.0)
CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);
-- GIN index for full-text search
CREATE INDEX document_chunks_fts_idx ON document_chunks USING GIN (fts);

-- 7. Función RPC para Hybrid Search (Coseno + BM25) usando RRF (Reciprocal Rank Fusion)
CREATE OR REPLACE FUNCTION match_document_chunks_hybrid(
  query_text TEXT,
  query_embedding vector(1024),
  match_count INT DEFAULT 10,
  full_text_weight FLOAT DEFAULT 1.0,
  semantic_weight FLOAT DEFAULT 1.0,
  rrf_k INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH full_text AS (
    SELECT
      dc.id,
      ROW_NUMBER() OVER(
        ORDER BY ts_rank_cd(dc.fts, plainto_tsquery('spanish', query_text)) DESC
      ) AS rank_ix
    FROM document_chunks dc
    WHERE dc.user_id = auth.uid()
      AND dc.fts @@ plainto_tsquery('spanish', query_text)
    ORDER BY rank_ix
    LIMIT match_count * 2
  ),
  semantic AS (
    SELECT
      dc.id,
      ROW_NUMBER() OVER (
        ORDER BY dc.embedding <=> query_embedding
      ) AS rank_ix
    FROM document_chunks dc
    WHERE dc.user_id = auth.uid()
    ORDER BY rank_ix
    LIMIT match_count * 2
  )
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    (COALESCE(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight +
     COALESCE(1.0 / (rrf_k + sm.rank_ix), 0.0) * semantic_weight)::FLOAT AS similarity
  FROM document_chunks dc
  LEFT JOIN full_text ft ON ft.id = dc.id
  LEFT JOIN semantic sm ON sm.id = dc.id
  WHERE (ft.id IS NOT NULL OR sm.id IS NOT NULL)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
