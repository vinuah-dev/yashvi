-- ============================================================
-- TRAINER MANAGEMENT SCHEMA MIGRATION
-- Adds support for trainers to manage assigned members
-- ============================================================

-- ============================================================
-- 1. CREATE TRAINERS TABLE (extends profiles with gym association)
-- ============================================================
-- Note: Trainers already exist in profiles table with role='trainer'
-- This table adds gym-specific trainer information

CREATE TABLE IF NOT EXISTS gym_trainers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    specialization VARCHAR(255),
    bio TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    hire_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- A trainer can only be associated with a gym once
    CONSTRAINT unique_gym_trainer UNIQUE (gym_id, profile_id)
);

COMMENT ON TABLE gym_trainers IS 'Trainers associated with specific gyms';
COMMENT ON COLUMN gym_trainers.specialization IS 'Trainer specialization (e.g., Weight Training, Cardio, Yoga)';
COMMENT ON COLUMN gym_trainers.bio IS 'Short biography/description of the trainer';

-- ============================================================
-- 2. CREATE TRAINER-MEMBER ASSIGNMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS trainer_member_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- A member can only be assigned to one trainer at a time per gym
    CONSTRAINT unique_active_assignment UNIQUE (gym_id, member_id, trainer_id)
);

COMMENT ON TABLE trainer_member_assignments IS 'Links trainers to their assigned members';
COMMENT ON COLUMN trainer_member_assignments.assigned_by IS 'Admin who made this assignment';
COMMENT ON COLUMN trainer_member_assignments.notes IS 'Optional notes about the assignment';

-- ============================================================
-- 3. ADD TRAINER TRACKING TO MEMBER_DIETS TABLE
-- ============================================================
-- Add column to track which trainer assigned the diet plan
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'member_diets' 
                   AND column_name = 'assigned_by_trainer_id') THEN
        ALTER TABLE member_diets
        ADD COLUMN assigned_by_trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON COLUMN member_diets.assigned_by_trainer_id IS 'Trainer who assigned this diet plan to the member';

-- ============================================================
-- 4. ADD TRAINER TRACKING TO MEMBER_WORKOUTS TABLE
-- ============================================================
-- Add column to track which trainer assigned the workout plan
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'member_workouts' 
                   AND column_name = 'assigned_by_trainer_id') THEN
        ALTER TABLE member_workouts
        ADD COLUMN assigned_by_trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON COLUMN member_workouts.assigned_by_trainer_id IS 'Trainer who assigned this workout plan to the member';

-- ============================================================
-- 5. ADD TRAINER ID TO DIET_PLANS (already exists but ensure it)
-- ============================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'diet_plans' 
                   AND column_name = 'trainer_id') THEN
        ALTER TABLE diet_plans
        ADD COLUMN trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- 6. ADD TRAINER ID TO WORKOUT_PLANS (already exists but ensure it)
-- ============================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'workout_plans' 
                   AND column_name = 'trainer_id') THEN
        ALTER TABLE workout_plans
        ADD COLUMN trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- 7. CREATE INDEXES FOR BETTER PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_gym_trainers_gym_id ON gym_trainers(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_trainers_profile_id ON gym_trainers(profile_id);
CREATE INDEX IF NOT EXISTS idx_gym_trainers_is_active ON gym_trainers(is_active);

CREATE INDEX IF NOT EXISTS idx_trainer_member_assignments_gym_id ON trainer_member_assignments(gym_id);
CREATE INDEX IF NOT EXISTS idx_trainer_member_assignments_trainer_id ON trainer_member_assignments(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_member_assignments_member_id ON trainer_member_assignments(member_id);
CREATE INDEX IF NOT EXISTS idx_trainer_member_assignments_is_active ON trainer_member_assignments(is_active);

CREATE INDEX IF NOT EXISTS idx_member_diets_assigned_by_trainer ON member_diets(assigned_by_trainer_id);
CREATE INDEX IF NOT EXISTS idx_member_workouts_assigned_by_trainer ON member_workouts(assigned_by_trainer_id);

-- ============================================================
-- 8. CREATE TRIGGER FOR UPDATED_AT
-- ============================================================
CREATE TRIGGER update_gym_trainers_updated_at
    BEFORE UPDATE ON gym_trainers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 9. USEFUL VIEWS FOR ADMIN
-- ============================================================

-- View: Trainer assignments with member and plan details
CREATE OR REPLACE VIEW trainer_assignment_details AS
SELECT 
    tma.id AS assignment_id,
    tma.gym_id,
    tma.trainer_id,
    p.first_name || ' ' || p.last_name AS trainer_name,
    p.email AS trainer_email,
    p.phone AS trainer_phone,
    tma.member_id,
    m.full_name AS member_name,
    m.phone AS member_phone,
    tma.assigned_at,
    tma.is_active,
    -- Count of diet plans assigned by this trainer to this member
    (SELECT COUNT(*) FROM member_diets md 
     WHERE md.member_id = tma.member_id 
     AND md.assigned_by_trainer_id = tma.trainer_id) AS diet_plans_count,
    -- Count of workout plans assigned by this trainer to this member
    (SELECT COUNT(*) FROM member_workouts mw 
     WHERE mw.member_id = tma.member_id 
     AND mw.assigned_by_trainer_id = tma.trainer_id) AS workout_plans_count
FROM trainer_member_assignments tma
JOIN profiles p ON p.id = tma.trainer_id
JOIN members m ON m.id = tma.member_id;

-- View: Trainer summary for admin dashboard
CREATE OR REPLACE VIEW trainer_summary AS
SELECT 
    gt.id AS gym_trainer_id,
    gt.gym_id,
    gt.profile_id AS trainer_id,
    p.first_name || ' ' || p.last_name AS trainer_name,
    p.email AS trainer_email,
    p.phone AS trainer_phone,
    gt.specialization,
    gt.is_active,
    gt.hire_date,
    -- Count of assigned members
    (SELECT COUNT(*) FROM trainer_member_assignments tma 
     WHERE tma.trainer_id = gt.profile_id 
     AND tma.gym_id = gt.gym_id 
     AND tma.is_active = TRUE) AS assigned_members_count,
    -- Count of diet plans created by trainer
    (SELECT COUNT(*) FROM diet_plans dp 
     WHERE dp.trainer_id = gt.profile_id 
     AND dp.gym_id = gt.gym_id) AS diet_plans_created,
    -- Count of workout plans created by trainer
    (SELECT COUNT(*) FROM workout_plans wp 
     WHERE wp.trainer_id = gt.profile_id 
     AND wp.gym_id = gt.gym_id) AS workout_plans_created
FROM gym_trainers gt
JOIN profiles p ON p.id = gt.profile_id;

-- ============================================================
-- 10. SAMPLE DATA (Optional - Comment out in production)
-- ============================================================
-- You can insert sample trainers here if needed for testing

-- ============================================================
-- MIGRATION COMPLETE!
-- ============================================================
-- 
-- Summary:
-- ✓ gym_trainers table for gym-specific trainer info
-- ✓ trainer_member_assignments table for member assignments
-- ✓ Added assigned_by_trainer_id to member_diets
-- ✓ Added assigned_by_trainer_id to member_workouts
-- ✓ Created useful views for admin dashboard
-- ✓ Added indexes for performance
-- 
-- Trainer Workflow:
-- 1. Admin creates a trainer profile (role='trainer')
-- 2. Admin associates trainer with gym (gym_trainers)
-- 3. Admin assigns members to trainer (trainer_member_assignments)
-- 4. Trainer can view assigned members' info (not credentials)
-- 5. Trainer can create/assign diet and workout plans
-- 6. Trainer can view assigned members' attendance
-- 7. Admin can see all trainer assignments and activities
-- 
-- ============================================================
