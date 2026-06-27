-- Migration: Add member_id column to workout_plans for member-specific plans
-- This allows creating custom workout plans that are only visible to a specific member

-- Add member_id column to workout_plans table
ALTER TABLE workout_plans 
ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_workout_plans_member_id ON workout_plans(member_id);

-- Comment explaining the column
COMMENT ON COLUMN workout_plans.member_id IS 'If set, this workout plan is specific to this member and should not appear in general workout plans list';
