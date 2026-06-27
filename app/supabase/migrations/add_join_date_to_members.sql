-- Add join_date column to members table
-- This stores the actual join date entered by the admin during member creation,
-- which may differ from created_at (the row insertion timestamp).

ALTER TABLE members ADD COLUMN IF NOT EXISTS join_date DATE;

-- Backfill existing members: use the earliest membership start_date as join_date
UPDATE members m
SET join_date = sub.earliest_start
FROM (
  SELECT member_id, MIN(start_date) AS earliest_start
  FROM memberships
  GROUP BY member_id
) sub
WHERE m.id = sub.member_id
  AND m.join_date IS NULL;

-- For any members without memberships, fall back to created_at date
UPDATE members
SET join_date = created_at::date
WHERE join_date IS NULL;

COMMENT ON COLUMN members.join_date IS 'The actual join date of the member as entered during creation';
