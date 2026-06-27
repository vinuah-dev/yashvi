-- ============================================================
-- BIOMETRIC INTEGRATION MIGRATION
-- Run this AFTER your main schema.sql
-- This adds eSSL F22 biometric device support to existing tables
-- ============================================================

-- ============================================================
-- STEP 1: ADD FINGERPRINT_ID TO EXISTING MEMBERS TABLE
-- This links biometric device PIN to member profile
-- ============================================================

-- Add fingerprint_id column to members table
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS fingerprint_id VARCHAR(50);

-- Create index for fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_members_fingerprint_id ON members(fingerprint_id);

-- Create unique constraint: each fingerprint_id must be unique within a gym
-- First, we need to handle this carefully since column may have nulls
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_gym_fingerprint'
    ) THEN
        -- Create unique index for gym + fingerprint combination
        CREATE UNIQUE INDEX unique_gym_fingerprint 
        ON members(gym_id, fingerprint_id) 
        WHERE fingerprint_id IS NOT NULL;
    END IF;
END $$;

COMMENT ON COLUMN members.fingerprint_id IS 'PIN/User ID assigned on eSSL biometric device. Must match device enrollment.';

-- ============================================================
-- STEP 2: CREATE DEVICES TABLE
-- Maps device serial number (SN) → gym_id
-- This is CRITICAL for multi-gym support
-- ============================================================

CREATE TABLE IF NOT EXISTS devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    device_sn VARCHAR(50) NOT NULL UNIQUE,
    device_name VARCHAR(100),
    location VARCHAR(255),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for device lookups
CREATE INDEX IF NOT EXISTS idx_devices_gym_id ON devices(gym_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_sn ON devices(device_sn);

COMMENT ON TABLE devices IS 'eSSL biometric devices. Maps device serial number to gym for multi-tenant support.';
COMMENT ON COLUMN devices.device_sn IS 'Serial number printed on the eSSL device. Found in Menu → Sys Info.';

-- ============================================================
-- STEP 3: CREATE/UPDATE ATTENDANCE_LOGS TABLE
-- For biometric attendance data (separate from manual attendance table)
-- ============================================================

-- Drop old attendance_logs if it exists with wrong schema
DROP TABLE IF EXISTS attendance_logs CASCADE;

CREATE TABLE attendance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    user_id VARCHAR(50) NOT NULL,           -- Fingerprint PIN from device
    device_sn VARCHAR(50) NOT NULL,         -- Device serial number
    timestamp TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'CHECK_IN',  -- CHECK_IN, CHECK_OUT, BREAK_OUT, etc.
    membership_status VARCHAR(20),          -- ACTIVE, EXPIRED, UNKNOWN_MEMBER
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX idx_attendance_logs_gym_id ON attendance_logs(gym_id);
CREATE INDEX idx_attendance_logs_member_id ON attendance_logs(member_id);
CREATE INDEX idx_attendance_logs_user_id ON attendance_logs(user_id);
CREATE INDEX idx_attendance_logs_device_sn ON attendance_logs(device_sn);
CREATE INDEX idx_attendance_logs_timestamp ON attendance_logs(timestamp);
CREATE INDEX idx_attendance_logs_created_at ON attendance_logs(created_at);
-- Composite indexes for common queries
CREATE INDEX idx_attendance_logs_gym_timestamp ON attendance_logs(gym_id, timestamp);
CREATE INDEX idx_attendance_logs_gym_date ON attendance_logs(gym_id, (timestamp::date));

COMMENT ON TABLE attendance_logs IS 'Biometric attendance records from eSSL devices. Linked to members via fingerprint_id.';
COMMENT ON COLUMN attendance_logs.user_id IS 'Fingerprint PIN from biometric device. Maps to members.fingerprint_id.';
COMMENT ON COLUMN attendance_logs.membership_status IS 'Membership status at time of check-in: ACTIVE, EXPIRED, UNKNOWN_MEMBER';

-- ============================================================
-- STEP 4: CREATE/UPDATE DEVICE_COMMANDS TABLE
-- Queue commands to be sent to biometric devices
-- ============================================================

-- Drop old table if exists
DROP TABLE IF EXISTS device_commands CASCADE;

CREATE TABLE device_commands (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    device_sn VARCHAR(50) NOT NULL,
    command_string TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'SUCCESS', 'FAILED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_device_commands_gym_id ON device_commands(gym_id);
CREATE INDEX idx_device_commands_device_sn ON device_commands(device_sn);
CREATE INDEX idx_device_commands_status ON device_commands(status);
CREATE INDEX idx_device_commands_gym_status ON device_commands(gym_id, status);

COMMENT ON TABLE device_commands IS 'Queue of commands to send to biometric devices.';

-- ============================================================
-- STEP 5: CREATE HELPER FUNCTION FOR MEMBERSHIP STATUS
-- Checks if member has active membership
-- ============================================================

CREATE OR REPLACE FUNCTION get_membership_status(p_member_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    v_status VARCHAR(20);
    v_end_date DATE;
BEGIN
    -- Get the latest active membership
    SELECT ms.status, ms.end_date
    INTO v_status, v_end_date
    FROM memberships ms
    WHERE ms.member_id = p_member_id
    ORDER BY ms.end_date DESC
    LIMIT 1;
    
    -- No membership found
    IF v_status IS NULL THEN
        RETURN 'NO_MEMBERSHIP';
    END IF;
    
    -- Check if expired by date
    IF v_end_date < CURRENT_DATE THEN
        RETURN 'EXPIRED';
    END IF;
    
    -- Check status
    IF v_status = 'active' THEN
        RETURN 'ACTIVE';
    ELSIF v_status = 'expired' THEN
        RETURN 'EXPIRED';
    ELSIF v_status = 'cancelled' THEN
        RETURN 'CANCELLED';
    ELSE
        RETURN 'UNKNOWN';
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_membership_status IS 'Returns membership status for a member: ACTIVE, EXPIRED, CANCELLED, NO_MEMBERSHIP, UNKNOWN';

-- ============================================================
-- STEP 6: SAMPLE DATA FOR TESTING
-- ============================================================

-- Get the first gym ID for sample data
DO $$
DECLARE
    v_gym_id UUID;
BEGIN
    -- Get existing gym
    SELECT id INTO v_gym_id FROM gyms LIMIT 1;
    
    IF v_gym_id IS NOT NULL THEN
        -- Insert sample device (replace 'YOUR_DEVICE_SN' with actual serial number)
        INSERT INTO devices (gym_id, device_sn, device_name, location)
        VALUES (v_gym_id, 'SAMPLE_DEVICE_SN', 'Main Entry Device', 'Front Door')
        ON CONFLICT (device_sn) DO NOTHING;
        
        RAISE NOTICE 'Sample device created for gym: %', v_gym_id;
        RAISE NOTICE 'IMPORTANT: Update device_sn with your actual eSSL serial number!';
        RAISE NOTICE 'Run: UPDATE devices SET device_sn = ''YOUR_ACTUAL_SN'' WHERE device_sn = ''SAMPLE_DEVICE_SN'';';
    ELSE
        RAISE NOTICE 'No gym found. Create a gym first, then run this migration again.';
    END IF;
END $$;

-- Update existing members with sample fingerprint_ids
DO $$
DECLARE
    v_counter INTEGER := 1;
    v_member RECORD;
BEGIN
    -- Assign fingerprint IDs to existing members who don't have one
    FOR v_member IN 
        SELECT id, full_name 
        FROM members 
        WHERE fingerprint_id IS NULL
        ORDER BY created_at
        LIMIT 10
    LOOP
        UPDATE members 
        SET fingerprint_id = v_counter::VARCHAR
        WHERE id = v_member.id;
        
        RAISE NOTICE 'Assigned fingerprint_id % to member: %', v_counter, v_member.full_name;
        v_counter := v_counter + 1;
    END LOOP;
    
    IF v_counter = 1 THEN
        RAISE NOTICE 'No members without fingerprint_id found.';
    END IF;
END $$;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check devices table
SELECT 'devices' AS table_name, COUNT(*) AS row_count FROM devices
UNION ALL
SELECT 'attendance_logs', COUNT(*) FROM attendance_logs
UNION ALL
SELECT 'device_commands', COUNT(*) FROM device_commands
UNION ALL
SELECT 'members_with_fingerprint', COUNT(*) FROM members WHERE fingerprint_id IS NOT NULL;

-- Show members with fingerprint IDs
SELECT id, full_name, fingerprint_id, gym_id 
FROM members 
WHERE fingerprint_id IS NOT NULL
ORDER BY fingerprint_id::INTEGER;

-- ============================================================
-- MIGRATION COMPLETE!
-- ============================================================
-- 
-- Next Steps:
-- 1. Update the sample device with your actual eSSL serial number:
--    UPDATE devices SET device_sn = 'YOUR_ACTUAL_SERIAL' WHERE device_sn = 'SAMPLE_DEVICE_SN';
--
-- 2. Assign fingerprint_id to members (must match User ID on machine):
--    UPDATE members SET fingerprint_id = '1' WHERE id = 'member-uuid-here';
--
-- 3. On eSSL machine, enroll fingerprints with matching User IDs
--
-- ============================================================
