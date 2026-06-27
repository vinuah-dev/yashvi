-- ============================================================
-- TRAINER PLANS SCHEMA MIGRATION
-- Adds support for trainer subscription plans (monthly, quarterly, yearly)
-- Each trainer has their own plans with individual pricing
-- ============================================================

-- ============================================================
-- 1. CREATE TRAINER_PLANS TABLE
-- Per-trainer plans (each trainer can have different pricing)
-- ============================================================
CREATE TABLE IF NOT EXISTS trainer_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE trainer_plans IS 'Per-trainer subscription plans with individual pricing';
COMMENT ON COLUMN trainer_plans.duration_days IS 'Plan duration in days (30 = monthly, 90 = quarterly, 365 = yearly)';
COMMENT ON COLUMN trainer_plans.price IS 'Price for this trainer plan';

-- ============================================================
-- 2. ADD trainer_id COLUMN IF TABLE ALREADY EXISTS WITHOUT IT
-- ============================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trainer_plans' 
                   AND column_name = 'trainer_id') THEN
        ALTER TABLE trainer_plans
        ADD COLUMN trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM trainer_plans
        WHERE trainer_id IS NULL
    ) THEN
        ALTER TABLE trainer_plans
        ALTER COLUMN trainer_id SET NOT NULL;
    END IF;
END $$;

COMMENT ON COLUMN trainer_plans.trainer_id IS 'The trainer this plan belongs to';

-- ============================================================
-- 3. CREATE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_trainer_plans_gym_id ON trainer_plans(gym_id);
CREATE INDEX IF NOT EXISTS idx_trainer_plans_trainer_id ON trainer_plans(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_plans_is_active ON trainer_plans(is_active);

-- ============================================================
-- 3. ADD TRAINER PLAN REFERENCE TO TRAINER_MEMBER_ASSIGNMENTS
-- So we can track which plan a member subscribed to for a trainer
-- ============================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trainer_member_assignments' 
                   AND column_name = 'trainer_plan_id') THEN
        ALTER TABLE trainer_member_assignments
        ADD COLUMN trainer_plan_id UUID REFERENCES trainer_plans(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trainer_member_assignments' 
                   AND column_name = 'plan_start_date') THEN
        ALTER TABLE trainer_member_assignments
        ADD COLUMN plan_start_date DATE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trainer_member_assignments' 
                   AND column_name = 'plan_end_date') THEN
        ALTER TABLE trainer_member_assignments
        ADD COLUMN plan_end_date DATE;
    END IF;
END $$;

COMMENT ON COLUMN trainer_member_assignments.trainer_plan_id IS 'The trainer plan under which this member is assigned';
COMMENT ON COLUMN trainer_member_assignments.plan_start_date IS 'Start date of the trainer plan for this member';
COMMENT ON COLUMN trainer_member_assignments.plan_end_date IS 'End date of the trainer plan for this member';

-- ============================================================
-- 4. TRAINER EARNINGS TABLE
-- Tracks trainer's share of each plan payment (50% split)
-- ============================================================
CREATE TABLE IF NOT EXISTS trainer_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    trainer_plan_id UUID REFERENCES trainer_plans(id) ON DELETE SET NULL,
    assignment_id UUID REFERENCES trainer_member_assignments(id) ON DELETE SET NULL,
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
    trainer_amount DECIMAL(10, 2) NOT NULL CHECK (trainer_amount >= 0),
    gym_amount DECIMAL(10, 2) NOT NULL CHECK (gym_amount >= 0),
    payment_mode VARCHAR(20) DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE trainer_earnings IS 'Tracks earnings split between gym and trainer for each plan assignment';
COMMENT ON COLUMN trainer_earnings.total_amount IS 'Full plan price';
COMMENT ON COLUMN trainer_earnings.trainer_amount IS 'Trainer share (50% of total)';
COMMENT ON COLUMN trainer_earnings.gym_amount IS 'Gym share (50% of total)';

CREATE INDEX IF NOT EXISTS idx_trainer_earnings_gym_id ON trainer_earnings(gym_id);
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_trainer_id ON trainer_earnings(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_created_at ON trainer_earnings(created_at);

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================
ALTER TABLE trainer_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer_plans_select" ON trainer_plans;
CREATE POLICY "trainer_plans_select" ON trainer_plans
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "trainer_plans_insert" ON trainer_plans;
CREATE POLICY "trainer_plans_insert" ON trainer_plans
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "trainer_plans_update" ON trainer_plans;
CREATE POLICY "trainer_plans_update" ON trainer_plans
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "trainer_plans_delete" ON trainer_plans;
CREATE POLICY "trainer_plans_delete" ON trainer_plans
    FOR DELETE USING (true);

ALTER TABLE trainer_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer_earnings_select" ON trainer_earnings;
CREATE POLICY "trainer_earnings_select" ON trainer_earnings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "trainer_earnings_insert" ON trainer_earnings;
CREATE POLICY "trainer_earnings_insert" ON trainer_earnings
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "trainer_earnings_update" ON trainer_earnings;
CREATE POLICY "trainer_earnings_update" ON trainer_earnings
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "trainer_earnings_delete" ON trainer_earnings;
CREATE POLICY "trainer_earnings_delete" ON trainer_earnings
    FOR DELETE USING (true);
