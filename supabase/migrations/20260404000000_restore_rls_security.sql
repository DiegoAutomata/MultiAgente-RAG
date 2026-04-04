-- migration 20260404000000_restore_rls_security.sql
-- Restores multi-tenant data isolation: re-enables RLS, recreates user policies,
-- and updates the hybrid search RPC to filter at DB level by user_id parameter.

-- 1. Ensure user_id columns exist (safe if already present)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Re-enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- 3. Drop old policies (idempotent)
DROP POLICY IF EXISTS "Users can read own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;

DROP POLICY IF EXISTS "Users can read own chunks" ON document_chunks;
DROP POLICY IF EXISTS "Users can insert own chunks" ON document_chunks;
DROP POLICY IF EXISTS "Users can update own chunks" ON document_chunks;
DROP POLICY IF EXISTS "Users can delete own chunks" ON document_chunks;

-- 4. Recreate RLS policies for authenticated users
CREATE POLICY "Users can read own documents"
ON documents FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
ON documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
ON documents FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
ON documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can read own chunks"
ON document_chunks FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chunks"
ON document_chunks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chunks"
ON document_chunks FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chunks"
ON document_chunks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Note: service_role key bypasses RLS automatically — no explicit policy needed.

-- 5. Update hybrid search RPC to accept and filter by user_id at DB level.
--    This replaces the old post-filter approach in TypeScript.
CREATE OR REPLACE FUNCTION match_document_chunks_hybrid(
  query_text TEXT,
  query_embedding vector(384),
  match_count INT DEFAULT 10,
  full_text_weight FLOAT DEFAULT 1.0,
  semantic_weight FLOAT DEFAULT 1.0,
  rrf_k INT DEFAULT 50,
  filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    WHERE dc.fts @@ plainto_tsquery('spanish', query_text)
      AND (filter_user_id IS NULL OR dc.user_id = filter_user_id)
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
    WHERE (filter_user_id IS NULL OR dc.user_id = filter_user_id)
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

GRANT EXECUTE ON FUNCTION match_document_chunks_hybrid TO authenticated;
GRANT EXECUTE ON FUNCTION match_document_chunks_hybrid TO service_role;
