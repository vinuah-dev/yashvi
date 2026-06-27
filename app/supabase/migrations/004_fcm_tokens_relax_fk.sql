-- Migration: Relax FCM tokens FK and support member accounts
-- Created: 2026-01-11

-- Drop FK to profiles to allow storing tokens for members as well
ALTER TABLE fcm_tokens DROP CONSTRAINT IF EXISTS fcm_tokens_user_id_fkey;

-- Add account_type to distinguish id type ('profile' or 'member')
ALTER TABLE fcm_tokens ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'profile';
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_account_type ON fcm_tokens(account_type);
