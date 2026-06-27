-- Allow shared trainer sessions per slot while preventing duplicate slot assignment for the same member.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'unique_active_trainer_booking'
          AND conrelid = 'trainer_bookings'::regclass
    ) THEN
        ALTER TABLE trainer_bookings
        DROP CONSTRAINT unique_active_trainer_booking;
    END IF;
END $$;

-- Enforce uniqueness only per trainer + member + day + slot while active.
CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_bookings_unique_member_slot_active
    ON trainer_bookings (trainer_id, member_id, day, time_slot, gym_id)
    WHERE is_active = TRUE;
