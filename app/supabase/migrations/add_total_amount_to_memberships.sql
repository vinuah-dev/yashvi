-- Add canonical membership total amount (plan price at time of purchase).
ALTER TABLE memberships
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2);

-- Backfill for existing rows using custom_price first, then plan price.
UPDATE memberships ms
SET total_amount = COALESCE(ms.custom_price, mp.price, 0)
FROM membership_plans mp
WHERE ms.plan_id = mp.id
  AND ms.total_amount IS NULL;

-- Ensure no negative totals.
ALTER TABLE memberships
DROP CONSTRAINT IF EXISTS memberships_total_amount_non_negative;

ALTER TABLE memberships
ADD CONSTRAINT memberships_total_amount_non_negative
CHECK (total_amount IS NULL OR total_amount >= 0);

-- Optional guardrail: only one active membership per member.
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_one_active_per_member
ON memberships(member_id)
WHERE status = 'active';
