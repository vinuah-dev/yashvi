-- Migration: Add shift timings to gyms table
-- Date: 2026-01-04
-- Description: Adds morning and evening shift timings for weekdays and weekends, plus Sunday off option

-- Drop old single shift columns
ALTER TABLE gyms DROP COLUMN IF EXISTS weekday_open;
ALTER TABLE gyms DROP COLUMN IF EXISTS weekday_close;
ALTER TABLE gyms DROP COLUMN IF EXISTS weekend_open;
ALTER TABLE gyms DROP COLUMN IF EXISTS weekend_close;

-- Add weekday shift timings (Mon-Fri)
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS weekday_morning_start TIME DEFAULT '06:00';
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS weekday_morning_end TIME DEFAULT '12:00';
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS weekday_evening_start TIME DEFAULT '16:00';
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS weekday_evening_end TIME DEFAULT '22:00';

-- Add weekend shift timings (Sat-Sun or just Sat if Sunday off)
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS weekend_morning_start TIME DEFAULT '06:00';
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS weekend_morning_end TIME DEFAULT '12:00';
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS weekend_evening_start TIME DEFAULT '16:00';
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS weekend_evening_end TIME DEFAULT '22:00';

-- Add Sunday off option
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS sunday_off BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN gyms.weekday_morning_start IS 'Weekday morning shift start time (Mon-Fri)';
COMMENT ON COLUMN gyms.weekday_morning_end IS 'Weekday morning shift end time (Mon-Fri)';
COMMENT ON COLUMN gyms.weekday_evening_start IS 'Weekday evening shift start time (Mon-Fri)';
COMMENT ON COLUMN gyms.weekday_evening_end IS 'Weekday evening shift end time (Mon-Fri)';
COMMENT ON COLUMN gyms.weekend_morning_start IS 'Weekend morning shift start time (Sat-Sun or just Sat if Sunday off)';
COMMENT ON COLUMN gyms.weekend_morning_end IS 'Weekend morning shift end time (Sat-Sun or just Sat if Sunday off)';
COMMENT ON COLUMN gyms.weekend_evening_start IS 'Weekend evening shift start time (Sat-Sun or just Sat if Sunday off)';
COMMENT ON COLUMN gyms.weekend_evening_end IS 'Weekend evening shift end time (Sat-Sun or just Sat if Sunday off)';
COMMENT ON COLUMN gyms.sunday_off IS 'Whether gym is closed on Sundays';
