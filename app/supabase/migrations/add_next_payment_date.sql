-- Migration: Add next_payment_date to payments table for partial payment tracking
-- Date: 2026-01-04

-- Add next_payment_date column to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS next_payment_date DATE;

-- Add remaining_amount column to track partial payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(10, 2) DEFAULT 0;

-- Add notes column if not exists
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for quick lookup of pending payments with next payment dates
CREATE INDEX IF NOT EXISTS idx_payments_next_payment_date ON payments(next_payment_date) WHERE next_payment_date IS NOT NULL;

-- Create index for pending payments
CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments(gym_id, status) WHERE status = 'pending';

COMMENT ON COLUMN payments.next_payment_date IS 'Due date for remaining payment when partial payment is made';
COMMENT ON COLUMN payments.remaining_amount IS 'Remaining amount to be paid for partial payments';
