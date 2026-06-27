-- Migration: Add gym settings fields to gyms table
-- Date: 2025-01-15
-- Description: Adds phone, email, website, operating hours, and QR code settings to gyms table

-- Add contact information fields
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS website VARCHAR(255);

-- Add operating hours fields
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS weekday_open TIME DEFAULT '05:00';
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS weekday_close TIME DEFAULT '23:00';
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS weekend_open TIME DEFAULT '06:00';
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS weekend_close TIME DEFAULT '22:00';

-- Add QR code settings
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS qr_enabled BOOLEAN DEFAULT true;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS qr_type VARCHAR(20) DEFAULT 'dynamic';
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- Add comments
COMMENT ON COLUMN gyms.phone IS 'Gym contact phone number';
COMMENT ON COLUMN gyms.email IS 'Gym contact email';
COMMENT ON COLUMN gyms.website IS 'Gym website URL';
COMMENT ON COLUMN gyms.weekday_open IS 'Opening time for weekdays (Mon-Fri)';
COMMENT ON COLUMN gyms.weekday_close IS 'Closing time for weekdays (Mon-Fri)';
COMMENT ON COLUMN gyms.weekend_open IS 'Opening time for weekends (Sat-Sun)';
COMMENT ON COLUMN gyms.weekend_close IS 'Closing time for weekends (Sat-Sun)';
COMMENT ON COLUMN gyms.qr_enabled IS 'Whether QR code attendance is enabled';
COMMENT ON COLUMN gyms.qr_type IS 'QR code type: static or dynamic';
COMMENT ON COLUMN gyms.qr_code IS 'QR code data/content';

