-- ============================================================
-- FIX: Row Level Security for payment_receipts table
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================================

-- Option 1: DISABLE RLS completely (simpler, less secure)
ALTER TABLE payment_receipts DISABLE ROW LEVEL SECURITY;

-- OR Option 2: If you want RLS enabled, use these policies instead:
-- (Comment out the DISABLE above and uncomment below)

/*
-- Enable RLS
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated and anon users
CREATE POLICY "Allow all access to payment_receipts"
ON payment_receipts
FOR ALL
TO public
USING (true)
WITH CHECK (true);
*/

-- ============================================================
-- Also ensure storage bucket policies are correct
-- ============================================================

-- Drop existing policies if they exist (ignore errors)
DROP POLICY IF EXISTS "Allow public uploads to payment-receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from payment-receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes from payment-receipts" ON storage.objects;

-- Recreate storage policies
CREATE POLICY "Allow public uploads to payment-receipts"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'payment-receipts');

CREATE POLICY "Allow public reads from payment-receipts"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'payment-receipts');

CREATE POLICY "Allow public updates to payment-receipts"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'payment-receipts')
WITH CHECK (bucket_id = 'payment-receipts');

CREATE POLICY "Allow public deletes from payment-receipts"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'payment-receipts');
