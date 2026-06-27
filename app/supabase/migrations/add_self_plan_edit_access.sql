-- Add self_plan_edit_access column to members table
ALTER TABLE members
ADD COLUMN self_plan_edit_access BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN members.self_plan_edit_access IS 'Allow member to edit their own workout/diet plans from the app';

