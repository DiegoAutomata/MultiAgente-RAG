-- migration 20260326000000_remove_user_auth_dependency.sql
-- Remove user_id / auth dependency since this app has no login.
-- Service_role key bypasses RLS, but we clean up the schema for clarity.

-- 1. Drop old RLS policies (reference auth.uid())
DROP POLICY IF EXISTS "Users can read own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;

DROP POLICY IF EXISTS "Users can read own chunks" ON document_chunks;
DROP POLICY IF EXISTS "Users can insert own chunks" ON document_chunks;
DROP POLICY IF EXISTS "Users can update own chunks" ON document_chunks;
DROP POLICY IF EXISTS "Users can delete own chunks" ON document_chunks;

-- 2. Disable RLS (no login = no need for row-level isolation)
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks DISABLE ROW LEVEL SECURITY;

-- 3. Drop user_id FK constraints before dropping columns
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_user_id_fkey;
ALTER TABLE document_chunks DROP CONSTRAINT IF EXISTS document_chunks_user_id_fkey;

-- 4. Remove user_id columns
ALTER TABLE documents DROP COLUMN IF EXISTS user_id;
ALTER TABLE document_chunks DROP COLUMN IF EXISTS user_id;

-- 5. Update hybrid search function (remove user_id references, already done in previous migration)
-- The current function (20260323) already has no auth.uid() filters — nothing to change.
