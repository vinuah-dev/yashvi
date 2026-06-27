-- ============================================================
-- PAYMENT RECEIPTS TABLE AND STORAGE
-- For storing payment receipt PDFs with 7-day auto-expiry
-- ============================================================

-- Create payment_receipts table
CREATE TABLE IF NOT EXISTS payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    receipt_number VARCHAR(50) NOT NULL,
    receipt_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_mode VARCHAR(20) NOT NULL,
    plan_name VARCHAR(100),
    plan_duration INTEGER,
    validity_start DATE,
    validity_end DATE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_payment_receipts_member_id ON payment_receipts(member_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_gym_id ON payment_receipts(gym_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment_id ON payment_receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_expires_at ON payment_receipts(expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_created_at ON payment_receipts(created_at DESC);

-- Add unique constraint for receipt_number per gym
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_receipts_unique_number 
ON payment_receipts(gym_id, receipt_number);

COMMENT ON TABLE payment_receipts IS 'Payment receipts with 7-day auto-expiry';
COMMENT ON COLUMN payment_receipts.expires_at IS 'Receipt expires 7 days after creation';
COMMENT ON COLUMN payment_receipts.file_path IS 'Storage path for PDF file in Supabase storage';

-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow public uploads to payment-receipts bucket
CREATE POLICY "Allow public uploads to payment-receipts"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'payment-receipts');

-- Policy: Allow public reads from payment-receipts bucket
CREATE POLICY "Allow public reads from payment-receipts"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'payment-receipts');

-- Policy: Allow public deletes from payment-receipts bucket (for cleanup)
CREATE POLICY "Allow public deletes from payment-receipts"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'payment-receipts');

-- ============================================================
-- FUNCTION: Clean up expired receipts
-- Run this periodically (via cron or Supabase Edge Function)
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_receipts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    receipt_record RECORD;
BEGIN
    -- First, delete files from storage
    FOR receipt_record IN 
        SELECT file_path FROM payment_receipts 
        WHERE expires_at < now()
    LOOP
        -- Note: Actual file deletion should be handled by application/edge function
        -- since storage.objects delete requires API call
        NULL;
    END LOOP;
    
    -- Delete expired receipt records
    DELETE FROM payment_receipts 
    WHERE expires_at < now();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Generate unique receipt number
-- Format: GYM-YYYYMMDD-XXXX (e.g., GYM-20260107-0001)
-- ============================================================
CREATE OR REPLACE FUNCTION generate_receipt_number(p_gym_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    today_date VARCHAR(8);
    daily_count INTEGER;
    receipt_num VARCHAR(50);
BEGIN
    today_date := to_char(CURRENT_DATE, 'YYYYMMDD');
    
    -- Count receipts for this gym today
    SELECT COUNT(*) + 1 INTO daily_count
    FROM payment_receipts
    WHERE gym_id = p_gym_id
    AND DATE(created_at) = CURRENT_DATE;
    
    receipt_num := 'RCP-' || today_date || '-' || LPAD(daily_count::TEXT, 4, '0');
    
    RETURN receipt_num;
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON FUNCTION cleanup_expired_receipts() IS 'Deletes expired payment receipts (older than 7 days)';
COMMENT ON FUNCTION generate_receipt_number(UUID) IS 'Generates unique receipt number for a gym';
