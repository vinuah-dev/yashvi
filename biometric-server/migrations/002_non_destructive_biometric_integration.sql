-- ============================================================
-- NON-DESTRUCTIVE BIOMETRIC INTEGRATION
-- This migration only adds tables/columns/indexes if missing.
-- It does not drop, delete, truncate, or update existing rows.
-- ============================================================

-- Optional column already used by the attendance UI/RPCs in this app.
-- Safe behavior: existing attendance rows remain as-is.
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS membership_status VARCHAR(20) DEFAULT 'ACTIVE';

CREATE TABLE IF NOT EXISTS biometric_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    device_sn VARCHAR(50) NOT NULL UNIQUE,
    device_name VARCHAR(100),
    location VARCHAR(255),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biometric_devices_gym_id
ON biometric_devices(gym_id);

CREATE INDEX IF NOT EXISTS idx_biometric_devices_device_sn
ON biometric_devices(device_sn);

CREATE TABLE IF NOT EXISTS biometric_member_map (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    fingerprint_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (gym_id, fingerprint_id),
    UNIQUE (gym_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_biometric_member_map_gym_fingerprint
ON biometric_member_map(gym_id, fingerprint_id);

CREATE INDEX IF NOT EXISTS idx_biometric_member_map_member_id
ON biometric_member_map(member_id);

CREATE TABLE IF NOT EXISTS biometric_attendance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    user_id VARCHAR(50) NOT NULL,
    device_sn VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'CHECK_IN',
    membership_status VARCHAR(20),
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biometric_attendance_logs_gym_id
ON biometric_attendance_logs(gym_id);

CREATE INDEX IF NOT EXISTS idx_biometric_attendance_logs_member_id
ON biometric_attendance_logs(member_id);

CREATE INDEX IF NOT EXISTS idx_biometric_attendance_logs_user_id
ON biometric_attendance_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_biometric_attendance_logs_device_sn
ON biometric_attendance_logs(device_sn);

CREATE INDEX IF NOT EXISTS idx_biometric_attendance_logs_timestamp
ON biometric_attendance_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_biometric_attendance_logs_gym_timestamp
ON biometric_attendance_logs(gym_id, timestamp);

CREATE TABLE IF NOT EXISTS biometric_device_commands (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    device_sn VARCHAR(50) NOT NULL,
    command_string TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SENT', 'SUCCESS', 'FAILED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biometric_device_commands_gym_id
ON biometric_device_commands(gym_id);

CREATE INDEX IF NOT EXISTS idx_biometric_device_commands_device_sn
ON biometric_device_commands(device_sn);

CREATE INDEX IF NOT EXISTS idx_biometric_device_commands_status
ON biometric_device_commands(status);

CREATE INDEX IF NOT EXISTS idx_biometric_device_commands_gym_status
ON biometric_device_commands(gym_id, status);
