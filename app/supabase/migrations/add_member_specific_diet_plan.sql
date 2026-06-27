-- Migration: Add member_id column to diet_plans for member-specific plans
-- This allows creating custom diet plans that are only visible to a specific member

-- Add member_id column to diet_plans table
ALTER TABLE diet_plans 
ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_diet_plans_member_id ON diet_plans(member_id);

-- Comment explaining the column
COMMENT ON COLUMN diet_plans.member_id IS 'If set, this diet plan is specific to this member and should not appear in general diet plans list';
