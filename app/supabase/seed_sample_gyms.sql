-- ================================================
-- Sample Gyms and Admin Setup
-- ================================================
-- This script creates sample gym data for testing
-- Run this in Supabase SQL Editor
-- ================================================

-- Insert Sample Gyms
INSERT INTO gyms (id, name, address, city, state, phone, email, weekday_open, weekday_close, weekend_open, weekend_close, created_at, updated_at)
VALUES
  -- Gym 1: FitZone Gym
  (
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    'FitZone Gym',
    '123 Main Street, Downtown',
    'Mumbai',
    'Maharashtra',
    '9876543210',
    'admin@fitzonegym.com',
    '06:00:00',
    '22:00:00',
    '07:00:00',
    '20:00:00',
    NOW(),
    NOW()
  ),
  
  -- Gym 2: PowerHouse Fitness
  (
    'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e',
    'PowerHouse Fitness',
    '456 Park Avenue, Central Plaza',
    'Delhi',
    'Delhi',
    '9876543211',
    'admin@powerhousefitness.com',
    '05:30:00',
    '23:00:00',
    '06:00:00',
    '21:00:00',
    NOW(),
    NOW()
  ),
  
  -- Gym 3: Elite Fitness Hub
  (
    'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f',
    'Elite Fitness Hub',
    '789 Beach Road, Seaside Complex',
    'Bangalore',
    'Karnataka',
    '9876543212',
    'admin@elitefitnesshub.com',
    '06:00:00',
    '22:30:00',
    '07:00:00',
    '21:00:00',
    NOW(),
    NOW()
  );

-- ================================================
-- ADMIN USER CREDENTIALS
-- ================================================
-- Since Supabase Auth users must be created through the Supabase Dashboard
-- or Authentication API, follow these steps:
--
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User" for each admin
-- 3. Use the following credentials:
--
-- ================================================
-- ADMIN 1 (FitZone Gym)
-- ================================================
-- Email: admin@fitzonegym.com
-- Password: FitZone@2026
-- Name: Raj Sharma
-- Role: admin (add to user_metadata)
-- Gym ID: a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d
--
-- After creating user in Auth, note the user ID and update:
-- User Metadata (JSON):
-- {
--   "name": "Raj Sharma",
--   "role": "admin",
--   "gym_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"
-- }
--
-- ================================================
-- ADMIN 2 (PowerHouse Fitness)
-- ================================================
-- Email: admin@powerhousefitness.com
-- Password: PowerHouse@2026
-- Name: Priya Patel
-- Role: admin (add to user_metadata)
-- Gym ID: b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e
--
-- User Metadata (JSON):
-- {
--   "name": "Priya Patel",
--   "role": "admin",
--   "gym_id": "b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e"
-- }
--
-- ================================================
-- ADMIN 3 (Elite Fitness Hub)
-- ================================================
-- Email: admin@elitefitnesshub.com
-- Password: EliteFit@2026
-- Name: Arjun Kumar
-- Role: admin (add to user_metadata)
-- Gym ID: c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f
--
-- User Metadata (JSON):
-- {
--   "name": "Arjun Kumar",
--   "role": "admin",
--   "gym_id": "c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f"
-- }
--
-- ================================================

-- Insert Sample Membership Plans for each gym
INSERT INTO membership_plans (gym_id, name, duration_days, price, is_active, created_at)
VALUES
  -- FitZone Gym Plans
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Monthly Basic', 30, 1500, true, NOW()),
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Quarterly Premium', 90, 4000, true, NOW()),
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Yearly VIP', 365, 15000, true, NOW()),
  
  -- PowerHouse Fitness Plans
  ('b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'Monthly Standard', 30, 2000, true, NOW()),
  ('b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'Quarterly Elite', 90, 5500, true, NOW()),
  ('b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'Yearly Platinum', 365, 20000, true, NOW()),
  
  -- Elite Fitness Hub Plans
  ('c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'Monthly Starter', 30, 1800, true, NOW()),
  ('c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'Quarterly Pro', 90, 4800, true, NOW()),
  ('c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'Yearly Elite', 365, 18000, true, NOW());

-- ================================================
-- VERIFICATION QUERIES
-- ================================================
-- Run these to verify the data was inserted correctly:
--
-- SELECT * FROM gyms;
-- SELECT * FROM membership_plans ORDER BY gym_id, price;
--
-- ================================================

-- ================================================
-- SUMMARY OF CREDENTIALS
-- ================================================
/*
ADMIN CREDENTIALS (Create these in Supabase Auth Dashboard):

1. FitZone Gym (Mumbai)
   Email: admin@fitzonegym.com
   Password: FitZone@2026
   Admin: Raj Sharma

2. PowerHouse Fitness (Delhi)
   Email: admin@powerhousefitness.com
   Password: PowerHouse@2026
   Admin: Priya Patel

3. Elite Fitness Hub (Bangalore)
   Email: admin@elitefitnesshub.com
   Password: EliteFit@2026
   Admin: Arjun Kumar

SETUP STEPS:
1. Run this SQL file in Supabase SQL Editor
2. Go to Authentication > Users in Supabase Dashboard
3. Click "Add User" and create each admin with:
   - Email and Password from above
   - Confirm Email: Yes
   - Add User Metadata with gym_id, name, and role
4. Test login with each admin account

*/
