-- Workout Plans Schema Migration
-- This creates the complete workout plan management system

-- 1. workout_plans - High-level workout program
CREATE TABLE IF NOT EXISTS workout_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,              -- e.g. "Beginner Muscle Gain"
    goal VARCHAR(100),                        -- fat loss, muscle gain, strength
    level VARCHAR(50),                        -- beginner / intermediate / advanced
    description TEXT,
    is_template BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES profiles(id),  -- admin
    created_by_member_id UUID REFERENCES members(id) ON DELETE CASCADE, -- member (for self-created plans)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE workout_plans IS 'High-level workout programs with goals and levels';
COMMENT ON COLUMN workout_plans.created_by_member_id IS 'Member who created this workout plan (for self-created plans)';

-- 2. workout_plan_days - Monday to Saturday (no Sunday)
CREATE TABLE IF NOT EXISTS workout_plan_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
    day_name VARCHAR(10) NOT NULL,            -- Monday, Tuesday...
    focus VARCHAR(100),                       -- Chest & Triceps, Back & Biceps
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE workout_plan_days IS 'Days of the workout plan (Monday-Saturday)';

-- 3. workout_exercises - Exercises for each day
CREATE TABLE IF NOT EXISTS workout_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_day_id UUID NOT NULL REFERENCES workout_plan_days(id) ON DELETE CASCADE,
    exercise_name VARCHAR(150) NOT NULL,      -- Bench Press
    sets INTEGER,
    reps VARCHAR(20),                         -- 8–10 / 12–15
    weight VARCHAR(50),                       -- optional
    rest_seconds INTEGER,
    notes TEXT,
    exercise_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE workout_exercises IS 'Exercises within each workout day';

-- 4. member_workouts - Assign Workout to Member
CREATE TABLE IF NOT EXISTS member_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    workout_plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id), -- admin
    assigned_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE member_workouts IS 'Workout plans assigned to members';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workout_plans_gym_id ON workout_plans(gym_id);
CREATE INDEX IF NOT EXISTS idx_workout_plans_created_by_member_id ON workout_plans(created_by_member_id);
CREATE INDEX IF NOT EXISTS idx_workout_plan_days_plan_id ON workout_plan_days(workout_plan_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_day_id ON workout_exercises(workout_day_id);
CREATE INDEX IF NOT EXISTS idx_member_workouts_member_id ON member_workouts(member_id);
CREATE INDEX IF NOT EXISTS idx_member_workouts_plan_id ON member_workouts(workout_plan_id);
