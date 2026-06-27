-- Migration: Add profile_image column to members table if not exists
-- Run this migration to ensure the profile_image column exists

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'members' 
        AND column_name = 'profile_image'
    ) THEN
        ALTER TABLE members ADD COLUMN profile_image TEXT;
        COMMENT ON COLUMN members.profile_image IS 'URL to member profile image stored in Supabase Storage';
    END IF;
END $$;

-- Create storage bucket for member profile images (run in Supabase Dashboard -> Storage)
-- Bucket name: member-images
-- Public: true (for easy access to images)
-- File size limit: 3MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- Storage policies (run in Supabase Dashboard -> Storage -> Policies)
-- 1. Allow public read access:
--    CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'member-images');
-- 
-- 2. Allow authenticated upload:
--    CREATE POLICY "Allow Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'member-images');
--
-- 3. Allow authenticated update:
--    CREATE POLICY "Allow Update" ON storage.objects FOR UPDATE USING (bucket_id = 'member-images');
--
-- 4. Allow authenticated delete:
--    CREATE POLICY "Allow Delete" ON storage.objects FOR DELETE USING (bucket_id = 'member-images');
