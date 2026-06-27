-- Migration: Add collected_by columns to payments table
-- This allows tracking which trainer collected a payment

-- Add collected_by column (trainer's profile_id)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add collected_by_name for quick display without joins
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS collected_by_name VARCHAR(255);

-- Add comment
COMMENT ON COLUMN payments.collected_by IS 'ID of the trainer who collected this payment (null if collected by admin)';
COMMENT ON COLUMN payments.collected_by_name IS 'Name of the person who collected this payment for quick display';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_collected_by ON payments(collected_by);
