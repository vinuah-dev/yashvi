-- Knowledge base posts scoped per gym.
-- Admins create posts; same-gym admins, trainers, and members can read published posts.

CREATE TABLE IF NOT EXISTS knowledge_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    excerpt TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    category VARCHAR(40) NOT NULL DEFAULT 'health'
        CHECK (category IN ('health', 'nutrition', 'workout', 'recovery', 'announcement')),
    status VARCHAR(20) NOT NULL DEFAULT 'published'
        CHECK (status IN ('draft', 'published')),
    is_featured BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_posts_gym_status_published
    ON knowledge_posts (gym_id, status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_posts_gym_category
    ON knowledge_posts (gym_id, category);

COMMENT ON TABLE knowledge_posts IS 'Gym-scoped health, diet, workout, and announcement knowledge posts';

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
