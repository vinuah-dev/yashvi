-- Add created_by_member_id column to diet_plans table
-- This allows members with self_plan_edit_access to create their own diet plans

ALTER TABLE diet_plans
ADD COLUMN created_by_member_id UUID REFERENCES members(id) ON DELETE CASCADE;

COMMENT ON COLUMN diet_plans.created_by_member_id IS 'Member who created this diet plan (for self-created plans)';

-- Create index for faster lookups
CREATE INDEX idx_diet_plans_created_by_member_id ON diet_plans(created_by_member_id);
