-- ============================================================
-- Trainer assignment history + trainer_payments (history-safe PT)
-- - Soft-close assignments (is_active=false, end_date) — never delete rows
-- - At most one active assignment per (gym_id, member_id)
-- - trainer_payments: one row per PT collection, tied to assignment_id
-- - Sync new trainer_earnings rows into trainer_payments via trigger
-- ============================================================

-- 1) Lifecycle columns on trainer_member_assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trainer_member_assignments' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE trainer_member_assignments ADD COLUMN start_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trainer_member_assignments' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE trainer_member_assignments ADD COLUMN end_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trainer_member_assignments' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE trainer_member_assignments ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

COMMENT ON COLUMN trainer_member_assignments.start_date IS 'Assignment period start (defaults to plan_start_date or first assignment date)';
COMMENT ON COLUMN trainer_member_assignments.end_date IS 'Set when assignment is closed (renewal, change, remove); NULL while active';

-- Backfill start_date / end_date / created_at
UPDATE trainer_member_assignments tma
SET
  start_date = COALESCE(tma.plan_start_date, (tma.assigned_at AT TIME ZONE 'UTC')::date),
  end_date = CASE
    WHEN tma.is_active THEN NULL
    ELSE COALESCE(tma.plan_end_date, (tma.assigned_at AT TIME ZONE 'UTC')::date)
  END,
  created_at = COALESCE(tma.created_at, tma.assigned_at, now())
WHERE tma.start_date IS NULL;

UPDATE trainer_member_assignments
SET created_at = COALESCE(created_at, assigned_at, now());

-- 2) Drop old unique constraint that blocked multiple rows per member+trainer (history)
ALTER TABLE trainer_member_assignments DROP CONSTRAINT IF EXISTS unique_active_assignment;

-- 2b) If multiple active rows exist for same gym+member, soft-close older ones (keep newest)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY gym_id, member_id
      ORDER BY assigned_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS rn
  FROM trainer_member_assignments
  WHERE is_active = TRUE
)
UPDATE trainer_member_assignments tma
SET
  is_active = FALSE,
  end_date = COALESCE(tma.end_date, tma.plan_end_date, CURRENT_DATE)
FROM ranked r
WHERE tma.id = r.id
  AND r.rn > 1;

-- 3) At most ONE active assignment per member per gym
CREATE UNIQUE INDEX IF NOT EXISTS uniq_trainer_member_one_active_per_gym
  ON trainer_member_assignments (gym_id, member_id)
  WHERE is_active = TRUE;

-- 4) App rule: soft-close only. (No DB trigger — CASCADE deletes from members/gyms must still work.)

-- 5) trainer_payments (installment-level PT payments, assignment-scoped)
CREATE TABLE IF NOT EXISTS trainer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES trainer_member_assignments(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trainer_earning_id UUID REFERENCES trainer_earnings(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_trainer_payments_earning_id
  ON trainer_payments (trainer_earning_id)
  WHERE trainer_earning_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trainer_payments_assignment ON trainer_payments (assignment_id);
CREATE INDEX IF NOT EXISTS idx_trainer_payments_member ON trainer_payments (member_id);
CREATE INDEX IF NOT EXISTS idx_trainer_payments_trainer ON trainer_payments (trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_payments_gym ON trainer_payments (gym_id);

COMMENT ON TABLE trainer_payments IS 'PT payments tied to a specific trainer_member_assignments row; preserves history across renewals/changes';

-- 6) Backfill from trainer_earnings (one payment row per earning when assignment_id present)
INSERT INTO trainer_payments (gym_id, member_id, trainer_id, assignment_id, amount, payment_date, created_at, trainer_earning_id)
SELECT
  te.gym_id,
  te.member_id,
  te.trainer_id,
  te.assignment_id,
  te.total_amount,
  te.created_at,
  te.created_at,
  te.id
FROM trainer_earnings te
WHERE te.assignment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM trainer_payments tp WHERE tp.trainer_earning_id = te.id
  );

-- 7) Future inserts on trainer_earnings -> trainer_payments (idempotent via trainer_earning_id)
CREATE OR REPLACE FUNCTION public.sync_trainer_payment_from_earning()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignment_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM trainer_payments WHERE trainer_earning_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO trainer_payments (gym_id, member_id, trainer_id, assignment_id, amount, payment_date, created_at, trainer_earning_id)
  VALUES (
    NEW.gym_id,
    NEW.member_id,
    NEW.trainer_id,
    NEW.assignment_id,
    NEW.total_amount,
    NEW.created_at,
    NEW.created_at,
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trainer_earnings_sync_trainer_payment ON trainer_earnings;
CREATE TRIGGER trg_trainer_earnings_sync_trainer_payment
  AFTER INSERT ON trainer_earnings
  FOR EACH ROW EXECUTE FUNCTION public.sync_trainer_payment_from_earning();

-- 8) RLS (match permissive pattern used elsewhere for these tables)
ALTER TABLE trainer_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer_payments_select" ON trainer_payments;
CREATE POLICY "trainer_payments_select" ON trainer_payments FOR SELECT USING (true);

DROP POLICY IF EXISTS "trainer_payments_insert" ON trainer_payments;
CREATE POLICY "trainer_payments_insert" ON trainer_payments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "trainer_payments_update" ON trainer_payments;
CREATE POLICY "trainer_payments_update" ON trainer_payments FOR UPDATE USING (true);

DROP POLICY IF EXISTS "trainer_payments_delete" ON trainer_payments;
CREATE POLICY "trainer_payments_delete" ON trainer_payments FOR DELETE USING (true);
