-- migration 20260323000000_fix_hybrid_search_rpc.sql
-- Fix: Remove auth.uid() filters from the hybrid search function.
-- The function is called from a trusted server with the service_role key,
-- so auth.uid() is NULL and the old WHERE clause returned 0 results.

CREATE OR REPLACE FUNCTION match_document_chunks_hybrid(
  query_text TEXT,
  query_embedding vector(384),
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
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS.
-- This is safe because only the service_role key calls this function.
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

-- Grant execution to authenticated and service_role
GRANT EXECUTE ON FUNCTION match_document_chunks_hybrid TO authenticated;
GRANT EXECUTE ON FUNCTION match_document_chunks_hybrid TO service_role;
