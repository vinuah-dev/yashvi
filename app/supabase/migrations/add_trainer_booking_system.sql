-- ============================================================
-- TRAINER BOOKING SYSTEM MIGRATION
-- Adds trainer scheduling, cost, and booking capabilities
-- ============================================================

-- ============================================================
-- 1. ADD NEW FIELDS TO PROFILES TABLE (for trainers)
-- ============================================================

-- Trainer hourly cost (in smallest currency unit, e.g., INR)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles'
                   AND column_name = 'trainer_cost') THEN
        ALTER TABLE profiles
        ADD COLUMN trainer_cost INTEGER DEFAULT NULL;
    END IF;
END $$;

COMMENT ON COLUMN profiles.trainer_cost IS 'Trainer cost per hour in INR (only for trainer role)';

-- Available days as text array (e.g., {Monday,Tuesday,Wednesday})
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles'
                   AND column_name = 'available_days') THEN
        ALTER TABLE profiles
        ADD COLUMN available_days TEXT[] DEFAULT NULL;
    END IF;
END $$;

COMMENT ON COLUMN profiles.available_days IS 'Days the trainer is available (only for trainer role)';

-- Available time slots as JSONB (day-wise 1-hour slots)
-- Example: {"Monday": ["8-9 AM", "9-10 AM"], "Tuesday": ["5-6 PM", "6-7 PM"]}
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles'
                   AND column_name = 'available_time_slots') THEN
        ALTER TABLE profiles
        ADD COLUMN available_time_slots JSONB DEFAULT NULL;
    END IF;
END $$;

COMMENT ON COLUMN profiles.available_time_slots IS 'JSONB of day-wise available 1-hour time slots (only for trainer role)';

-- ============================================================
-- 2. CREATE TRAINER BOOKINGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS trainer_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Prevent double booking: same trainer, same day, same time slot (only active)
    CONSTRAINT unique_active_trainer_booking UNIQUE (trainer_id, day, time_slot, gym_id)
);

COMMENT ON TABLE trainer_bookings IS 'Tracks trainer time slot bookings to prevent double booking';
COMMENT ON COLUMN trainer_bookings.day IS 'Day of week (e.g., Monday, Tuesday)';
COMMENT ON COLUMN trainer_bookings.time_slot IS 'Time slot string (e.g., 8-9 AM, 5-6 PM)';
COMMENT ON COLUMN trainer_bookings.is_active IS 'Whether this booking is currently active';

-- ============================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_trainer_bookings_trainer_id ON trainer_bookings(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_bookings_member_id ON trainer_bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_trainer_bookings_gym_id ON trainer_bookings(gym_id);
CREATE INDEX IF NOT EXISTS idx_trainer_bookings_day ON trainer_bookings(day);
CREATE INDEX IF NOT EXISTS idx_trainer_bookings_is_active ON trainer_bookings(is_active);
CREATE INDEX IF NOT EXISTS idx_trainer_bookings_trainer_day_slot
    ON trainer_bookings(trainer_id, day, time_slot) WHERE is_active = TRUE;

-- Index on profiles for trainer-specific queries
CREATE INDEX IF NOT EXISTS idx_profiles_trainer_cost ON profiles(trainer_cost) WHERE role = 'trainer';

-- ============================================================
-- 4. CREATE TRIGGER FOR updated_at
-- ============================================================

CREATE OR REPLACE TRIGGER update_trainer_bookings_updated_at
    BEFORE UPDATE ON trainer_bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. FUNCTION: Check slot availability before booking
-- ============================================================

CREATE OR REPLACE FUNCTION check_trainer_slot_available(
    p_trainer_id UUID,
    p_day TEXT,
    p_time_slot TEXT,
    p_gym_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM trainer_bookings
        WHERE trainer_id = p_trainer_id
          AND day = p_day
          AND time_slot = p_time_slot
          AND gym_id = p_gym_id
          AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_trainer_slot_available IS 'Returns TRUE if the trainer slot is available for booking';

-- ============================================================
-- MIGRATION COMPLETE!
-- ============================================================
--
-- Summary:
-- ✓ Added trainer_cost (INTEGER) to profiles
-- ✓ Added available_days (TEXT[]) to profiles
-- ✓ Added available_time_slots (JSONB) to profiles
-- ✓ Created trainer_bookings table with double-booking prevention
-- ✓ Added performance indexes
-- ✓ Created slot availability check function
--
-- ============================================================
