-- ============================================================
-- BIOMETRIC SERVER SCHEMA REFERENCE
-- ============================================================
-- 
-- IMPORTANT: Your main schema is at: /app/supabase/schema.sql
-- 
-- To add biometric integration, run ONLY this migration file:
--   /biometric-server/migrations/001_biometric_integration.sql
-- 
-- This migration will:
--   1. Add fingerprint_id column to existing members table
--   2. Create devices table (maps device SN → gym_id)
--   3. Create attendance_logs table (biometric attendance)
--   4. Create device_commands table (queue commands to devices)
-- 
-- ============================================================
-- QUICK REFERENCE: Tables used by biometric server
-- ============================================================

/*
EXISTING TABLES (from your main schema):
- gyms: id, name, address, owner_id
- members: id, gym_id, full_name, phone, fingerprint_id (added by migration)
- memberships: id, member_id, status, start_date, end_date

NEW TABLES (created by migration):
- devices: id, gym_id, device_sn, device_name, location, last_seen_at
- attendance_logs: id, gym_id, member_id, user_id, device_sn, timestamp, membership_status
- device_commands: id, gym_id, device_sn, command_string, status
*/

-- ============================================================
-- HOW TO SET UP
-- ============================================================

/*
STEP 1: Run your main schema first
   Run: /app/supabase/schema.sql

STEP 2: Run the biometric migration
   Run: /biometric-server/migrations/001_biometric_integration.sql

STEP 3: Register your eSSL device
   Find your device serial number: Menu → Sys Info on the machine
   Then run:
   
   -- Get your gym_id first
   SELECT id, name FROM gyms;
   
   -- Register device (replace with actual values)
   INSERT INTO devices (gym_id, device_sn, device_name, location)
   VALUES ('your-gym-uuid', 'YOUR_DEVICE_SERIAL', 'Main Entrance', 'Front Door');

STEP 4: Assign fingerprint IDs to members
   The fingerprint_id must match the User ID you set on the eSSL machine!
   
   -- Update member with fingerprint ID
   UPDATE members SET fingerprint_id = '1' WHERE full_name = 'Arjun Kumar';
   UPDATE members SET fingerprint_id = '2' WHERE full_name = 'Sneha Reddy';

STEP 5: Enroll fingerprints on the machine
   On eSSL F22: Menu → User Mgt → New User → User ID: 1 → Enroll FP
   The User ID MUST match the fingerprint_id in database!
*/

-- ============================================================
-- USEFUL QUERIES
-- ============================================================

-- List all registered devices
-- SELECT d.*, g.name as gym_name 
-- FROM devices d 
-- JOIN gyms g ON g.id = d.gym_id;

-- Today's biometric attendance for a gym
-- SELECT al.*, m.full_name 
-- FROM attendance_logs al
-- LEFT JOIN members m ON m.id = al.member_id
-- WHERE al.gym_id = 'your-gym-uuid'
--   AND al.timestamp::date = CURRENT_DATE
-- ORDER BY al.timestamp DESC;

-- Expired memberships who checked in today
-- SELECT al.timestamp, m.full_name, al.membership_status
-- FROM attendance_logs al
-- JOIN members m ON m.id = al.member_id
-- WHERE al.membership_status = 'EXPIRED'
--   AND al.timestamp::date = CURRENT_DATE
-- ORDER BY al.timestamp DESC;

-- Pending device commands
-- SELECT * FROM device_commands
-- WHERE status = 'PENDING'
-- ORDER BY created_at;
