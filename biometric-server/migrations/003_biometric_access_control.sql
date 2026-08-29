-- ============================================================
-- BIOMETRIC ACCESS CONTROL
-- Adds everything the block / restore flow reads and writes.
--
-- The app code already referenced these tables and columns, but no migration
-- ever created them. Every write in the ADMS server swallows its error, so a
-- missing column here means blocking silently does nothing while the member
-- still shows as "blocked" in the dashboard.
--
-- Non-destructive: only adds if missing. Nothing is dropped or updated.
-- Run AFTER 002_non_destructive_biometric_integration.sql
-- ============================================================

-- ------------------------------------------------------------
-- The F22 User ID lives directly on the member / trainer.
-- (Referenced by routes/adms.js; included here so a fresh install works.)
-- ------------------------------------------------------------
ALTER TABLE members
ADD COLUMN IF NOT EXISTS biometric_uid VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_members_gym_biometric_uid
ON members(gym_id, biometric_uid);

-- ------------------------------------------------------------
-- Whether this member's record is currently removed from the scanners.
-- Set when access is withdrawn, cleared on renewal, so the expiry sweep
-- only queues the command once instead of on every punch.
-- ------------------------------------------------------------
ALTER TABLE members
ADD COLUMN IF NOT EXISTS biometric_blocked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE members
ADD COLUMN IF NOT EXISTS biometric_blocked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_members_biometric_blocked
ON members(gym_id, biometric_blocked);

-- ------------------------------------------------------------
-- Per-gym access rules.
--   biometric_grace_days  how long after expiry the gate still opens
--   biometric_block_mode  what happens on renewal:
--                           'disable' -> push the saved fingerprint back
--                           'delete'  -> staff re-enrolls on the machine
-- ------------------------------------------------------------
ALTER TABLE gyms
ADD COLUMN IF NOT EXISTS biometric_grace_days INTEGER NOT NULL DEFAULT 7;

ALTER TABLE gyms
ADD COLUMN IF NOT EXISTS biometric_block_mode VARCHAR(10) NOT NULL DEFAULT 'disable';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'gyms_biometric_block_mode_check'
    ) THEN
        ALTER TABLE gyms
        ADD CONSTRAINT gyms_biometric_block_mode_check
        CHECK (biometric_block_mode IN ('disable', 'delete'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'gyms_biometric_grace_days_check'
    ) THEN
        ALTER TABLE gyms
        ADD CONSTRAINT gyms_biometric_grace_days_check
        CHECK (biometric_grace_days BETWEEN 0 AND 90);
    END IF;
END $$;

-- ------------------------------------------------------------
-- A device reports the outcome of every command as Return=<code>.
-- 0 means it actually ran; anything else means it was rejected, which must
-- not be recorded as success or a member looks blocked while the gate opens.
-- ------------------------------------------------------------
ALTER TABLE biometric_device_commands
ADD COLUMN IF NOT EXISTS return_code INTEGER;

ALTER TABLE biometric_device_commands
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- Backed-up fingerprint templates.
--
-- Blocking a member means deleting their user record from the scanner (the
-- only command every eSSL firmware honours), which also wipes the enrolled
-- finger. Keeping a copy here is what lets a renewal restore access without
-- the member putting their finger on the machine again.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS biometric_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    biometric_uid VARCHAR(50) NOT NULL,
    finger_id INTEGER NOT NULL DEFAULT 0,
    template_size INTEGER,
    is_valid INTEGER DEFAULT 1,
    template_data TEXT NOT NULL,
    device_sn VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (gym_id, biometric_uid, finger_id)
);

CREATE INDEX IF NOT EXISTS idx_biometric_templates_gym_uid
ON biometric_templates(gym_id, biometric_uid);

-- ------------------------------------------------------------
-- Raw copies of non-attendance pushes, so the diagnostics screen can answer
-- "does this particular device upload templates at all?" from real data
-- instead of assumptions.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS biometric_device_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    device_sn VARCHAR(50),
    endpoint VARCHAR(30),
    table_name VARCHAR(50),
    raw_body TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biometric_device_logs_gym_created
ON biometric_device_logs(gym_id, created_at DESC);
