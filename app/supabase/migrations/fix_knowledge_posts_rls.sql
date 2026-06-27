-- Fix RLS for existing knowledge_posts tables.
-- The app performs gym/user authorization in API middleware; these policies
-- allow the server-side Supabase client to perform scoped CRUD operations.

ALTER TABLE knowledge_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "knowledge_posts_select" ON knowledge_posts;
DROP POLICY IF EXISTS "knowledge_posts_insert" ON knowledge_posts;
DROP POLICY IF EXISTS "knowledge_posts_update" ON knowledge_posts;
DROP POLICY IF EXISTS "knowledge_posts_delete" ON knowledge_posts;

CREATE POLICY "knowledge_posts_select" ON knowledge_posts
    FOR SELECT USING (true);

CREATE POLICY "knowledge_posts_insert" ON knowledge_posts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "knowledge_posts_update" ON knowledge_posts
    FOR UPDATE USING (true);

CREATE POLICY "knowledge_posts_delete" ON knowledge_posts
    FOR DELETE USING (true);
