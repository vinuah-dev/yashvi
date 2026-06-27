-- Optional data integrity cleanup for cross-gym collector corruption.
-- This keeps payment records but clears invalid collector attribution.

-- Preview impacted rows before update.
SELECT p.id, p.gym_id AS payment_gym_id, p.collected_by, pr.gym_id AS collector_gym_id
FROM payments p
LEFT JOIN profiles pr ON pr.id = p.collected_by
WHERE p.collected_by IS NOT NULL
  AND (pr.id IS NULL OR pr.gym_id IS DISTINCT FROM p.gym_id);

-- Cleanup invalid collector fields.
UPDATE payments p
SET collected_by = NULL,
    collected_by_name = NULL
FROM profiles pr
WHERE p.collected_by = pr.id
  AND pr.gym_id IS DISTINCT FROM p.gym_id;

-- Cleanup collector rows where user record no longer exists.
UPDATE payments p
SET collected_by = NULL,
    collected_by_name = NULL
WHERE p.collected_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM profiles pr WHERE pr.id = p.collected_by
  );
