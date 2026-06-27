-- Migration: Add credentials_updated_at column to profiles table
-- This is used to detect when admin changes trainer credentials and force re-login

-- Add credentials_updated_at column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS credentials_updated_at TIMESTAMPTZ;

-- Comment
COMMENT ON COLUMN profiles.credentials_updated_at IS 'Timestamp when credentials (password/email/phone) were last updated by admin. Used to force trainer re-login.';
