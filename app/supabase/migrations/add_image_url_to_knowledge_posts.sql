-- Optional cover image URL for Knowledge Base posts.

ALTER TABLE knowledge_posts
ADD COLUMN IF NOT EXISTS image_url TEXT;
