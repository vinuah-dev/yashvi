-- Migration to update existing trainers with gym_id in profiles table
-- This fixes the issue where trainers can't see their gym after login

-- Update all trainer profiles with their gym_id from gym_trainers table
UPDATE profiles
SET gym_id = gt.gym_id
FROM gym_trainers gt
WHERE profiles.id = gt.profile_id
  AND profiles.role = 'trainer'
  AND profiles.gym_id IS NULL;

-- Verify the update
SELECT 
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.gym_id,
  p.role
FROM profiles p
WHERE p.role = 'trainer';
