-- Add 2D projection columns for PCA visualization in VectorDBInspector
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS x_2d FLOAT,
  ADD COLUMN IF NOT EXISTS y_2d FLOAT;

-- Index for fast retrieval by user (via document_id join)
CREATE INDEX IF NOT EXISTS idx_document_chunks_2d ON document_chunks (document_id)
  WHERE x_2d IS NOT NULL AND y_2d IS NOT NULL;
