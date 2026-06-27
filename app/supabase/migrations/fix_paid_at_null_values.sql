-- Fix existing payments where paid_at is NULL by setting it to created_at
UPDATE payments 
SET paid_at = created_at 
WHERE paid_at IS NULL;

-- Add a default value so future inserts without paid_at will auto-fill
ALTER TABLE payments 
ALTER COLUMN paid_at SET DEFAULT now();
