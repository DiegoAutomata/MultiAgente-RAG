-- migration 20260404000001_add_document_status.sql
-- Adds a status field to documents table so the frontend can distinguish
-- between processing, completed, and failed states.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing'
  CHECK (status IN ('processing', 'completed', 'failed'));

-- Index for fast polling queries (frontend checks status by title + user_id)
CREATE INDEX IF NOT EXISTS documents_user_status_idx ON documents(user_id, status);
