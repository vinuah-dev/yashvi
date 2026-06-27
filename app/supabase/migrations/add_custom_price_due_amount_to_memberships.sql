-- Migration: Add custom_price and due_amount columns to memberships table
-- This allows tracking the actual price charged (if different from plan price) and the due amount

-- Add custom_price column (nullable - NULL means plan price was used)
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS custom_price DECIMAL(10, 2);

-- Add due_amount column (defaults to 0)
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS due_amount DECIMAL(10, 2) DEFAULT 0;

-- Backfill existing memberships: calculate due_amount from payments
-- For each membership, due_amount = (custom_price or plan_price) - total_paid
UPDATE memberships m
SET due_amount = COALESCE(m.custom_price, mp.price, 0) - COALESCE(
    (SELECT SUM(p.amount) FROM payments p WHERE p.membership_id = m.id AND p.status = 'paid'),
    0
)
FROM membership_plans mp
WHERE m.plan_id = mp.id;

-- Also try to fix payments that have NULL membership_id by matching member_id + date proximity
-- This links orphaned payments to the membership that was active around the time of payment
UPDATE payments p
SET membership_id = (
    SELECT m.id
    FROM memberships m
    WHERE m.member_id = p.member_id
    AND p.created_at >= m.created_at - INTERVAL '1 minute'
    AND p.created_at <= m.created_at + INTERVAL '1 minute'
    ORDER BY ABS(EXTRACT(EPOCH FROM (p.created_at - m.created_at)))
    LIMIT 1
)
WHERE p.membership_id IS NULL;

-- After linking payments, recalculate due_amount for affected memberships
UPDATE memberships m
SET due_amount = COALESCE(m.custom_price, mp.price, 0) - COALESCE(
    (SELECT SUM(p.amount) FROM payments p WHERE p.membership_id = m.id AND p.status = 'paid'),
    0
)
FROM membership_plans mp
WHERE m.plan_id = mp.id;

-- Ensure due_amount is never negative
UPDATE memberships SET due_amount = 0 WHERE due_amount < 0;
