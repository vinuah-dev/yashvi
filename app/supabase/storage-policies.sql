-- Storage policies for member-images bucket
-- Run this in Supabase Dashboard -> SQL Editor

-- First, create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-images', 'member-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy 1: Allow anyone to upload files to member-images bucket
CREATE POLICY "Allow public uploads to member-images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'member-images');

-- Policy 2: Allow anyone to read files from member-images bucket
CREATE POLICY "Allow public reads from member-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'member-images');

-- Policy 3: Allow anyone to update files in member-images bucket
CREATE POLICY "Allow public updates to member-images"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'member-images')
WITH CHECK (bucket_id = 'member-images');

-- Policy 4: Allow anyone to delete files from member-images bucket
CREATE POLICY "Allow public deletes from member-images"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'member-images');
