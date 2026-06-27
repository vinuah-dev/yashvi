-- Migration: Create notification_settings table
-- Date: 2025-01-15
-- Description: Creates table to store gym notification preferences

CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL UNIQUE REFERENCES gyms(id) ON DELETE CASCADE,
    
    -- Attendance Alerts
    attendance_reminder BOOLEAN NOT NULL DEFAULT true,
    attendance_reminder_time TIME NOT NULL DEFAULT '06:00',
    no_show_alert BOOLEAN NOT NULL DEFAULT true,
    no_show_days INTEGER NOT NULL DEFAULT 3,
    
    -- Payment Reminders
    payment_reminder BOOLEAN NOT NULL DEFAULT true,
    payment_reminder_days INTEGER NOT NULL DEFAULT 3,
    overdue_alert BOOLEAN NOT NULL DEFAULT true,
    
    -- Member Notifications
    welcome_message BOOLEAN NOT NULL DEFAULT true,
    birthday_wishes BOOLEAN NOT NULL DEFAULT true,
    expiry_reminder BOOLEAN NOT NULL DEFAULT true,
    expiry_reminder_days INTEGER NOT NULL DEFAULT 7,
    
    -- Channels
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
    sms_enabled BOOLEAN NOT NULL DEFAULT false,
    push_enabled BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_notification_settings_gym_id ON notification_settings(gym_id);

-- Add trigger for updated_at
CREATE TRIGGER update_notification_settings_updated_at
    BEFORE UPDATE ON notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE notification_settings IS 'Gym notification preferences and settings';

