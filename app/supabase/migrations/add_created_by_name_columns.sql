-- Migration: Add created_by_name columns to track who created records
-- This allows quick display without JOINs

-- Add created_by_name column to members table
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255);

COMMENT ON COLUMN members.created_by_name IS 'Name of the admin/trainer who created this member';

-- Add created_by_name column to diet_plans table (if not exists)
ALTER TABLE diet_plans 
ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255);

COMMENT ON COLUMN diet_plans.created_by_name IS 'Name of the admin/trainer who created this diet plan';

-- Add created_by_name column to workout_plans table (if not exists)
ALTER TABLE workout_plans 
ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255);

COMMENT ON COLUMN workout_plans.created_by_name IS 'Name of the admin/trainer who created this workout plan';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_members_created_by_name ON members(created_by_name);
CREATE INDEX IF NOT EXISTS idx_diet_plans_created_by_name ON diet_plans(created_by_name);
CREATE INDEX IF NOT EXISTS idx_workout_plans_created_by_name ON workout_plans(created_by_name);
