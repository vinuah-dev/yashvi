-- Add missing columns to gyms table for extended gym settings

ALTER TABLE gyms
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS website VARCHAR(255),
ADD COLUMN IF NOT EXISTS weekday_morning_start TIME DEFAULT '06:00',
ADD COLUMN IF NOT EXISTS weekday_morning_end TIME DEFAULT '12:00',
ADD COLUMN IF NOT EXISTS weekday_evening_start TIME DEFAULT '16:00',
ADD COLUMN IF NOT EXISTS weekday_evening_end TIME DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS weekend_morning_start TIME DEFAULT '06:00',
ADD COLUMN IF NOT EXISTS weekend_morning_end TIME DEFAULT '12:00',
ADD COLUMN IF NOT EXISTS weekend_evening_start TIME DEFAULT '16:00',
ADD COLUMN IF NOT EXISTS weekend_evening_end TIME DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS sunday_off BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS qr_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS qr_type VARCHAR(50) DEFAULT 'dynamic';

-- Add comment to explain the new columns
COMMENT ON COLUMN gyms.phone IS 'Gym contact phone number';
COMMENT ON COLUMN gyms.email IS 'Gym contact email';
COMMENT ON COLUMN gyms.website IS 'Gym website URL';
COMMENT ON COLUMN gyms.weekday_morning_start IS 'Weekday morning shift start time';
COMMENT ON COLUMN gyms.weekday_morning_end IS 'Weekday morning shift end time';
COMMENT ON COLUMN gyms.weekday_evening_start IS 'Weekday evening shift start time';
COMMENT ON COLUMN gyms.weekday_evening_end IS 'Weekday evening shift end time';
COMMENT ON COLUMN gyms.weekend_morning_start IS 'Weekend morning shift start time';
COMMENT ON COLUMN gyms.weekend_morning_end IS 'Weekend morning shift end time';
COMMENT ON COLUMN gyms.weekend_evening_start IS 'Weekend evening shift start time';
COMMENT ON COLUMN gyms.weekend_evening_end IS 'Weekend evening shift end time';
COMMENT ON COLUMN gyms.sunday_off IS 'Whether gym is closed on Sundays';
COMMENT ON COLUMN gyms.qr_enabled IS 'Whether QR code attendance is enabled';
COMMENT ON COLUMN gyms.qr_type IS 'Type of QR code (dynamic/static)';
