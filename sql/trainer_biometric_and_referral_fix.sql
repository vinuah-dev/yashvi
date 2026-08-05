-- ============================================================
-- TRAINER BIOMETRIC UID + REFERRAL COLUMN FIX
-- Idempotent - safe to re-run any number of times.
-- ============================================================

-- ─── 1. TRAINER BIOMETRIC UID ───────────────────────────────
-- Trainers punch on the same eSSL F22 device as members.
-- The F22 "User ID" for a trainer is stored on their profile row.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS biometric_uid VARCHAR(20);

COMMENT ON COLUMN profiles.biometric_uid IS 'eSSL F22 device User ID for this trainer/staff profile';

-- One UID can only belong to one profile (NULLs are ignored)
CREATE UNIQUE INDEX IF NOT EXISTS unique_profile_biometric_uid
  ON profiles (biometric_uid)
  WHERE biometric_uid IS NOT NULL;

-- Fast lookup from the ADMS server
CREATE INDEX IF NOT EXISTS idx_profiles_biometric_uid
  ON profiles (biometric_uid)
  WHERE biometric_uid IS NOT NULL;


-- ─── 2. REFERRAL SYSTEM COLUMNS ─────────────────────────────
-- process_referral() reads/writes these. If any are missing the RPC
-- fails with "column ... does not exist".

ALTER TABLE members ADD COLUMN IF NOT EXISTS points INT DEFAULT 0;
ALTER TABLE members ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES members(id);
ALTER TABLE members ADD COLUMN IF NOT EXISTS referral_count INT DEFAULT 0;

UPDATE members SET points = 0 WHERE points IS NULL;
UPDATE members SET referral_count = 0 WHERE referral_count IS NULL;

CREATE TABLE IF NOT EXISTS referral_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE UNIQUE,
  points_per_referral INT DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE referral_settings
  ADD COLUMN IF NOT EXISTS points_to_currency_ratio NUMERIC(10,4) DEFAULT 1.0;

ALTER TABLE referral_settings DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS points_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  points_change INT NOT NULL,
  new_total INT,
  reason TEXT,
  changed_by UUID,
  changed_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE points_history ADD COLUMN IF NOT EXISTS new_total INT;
ALTER TABLE points_history ADD COLUMN IF NOT EXISTS changed_by UUID;
ALTER TABLE points_history ADD COLUMN IF NOT EXISTS changed_by_name TEXT;

CREATE INDEX IF NOT EXISTS idx_points_history_member
  ON points_history (member_id, created_at DESC);

ALTER TABLE points_history DISABLE ROW LEVEL SECURITY;


-- ─── 3. RE-CREATE process_referral (safe version) ───────────
-- Same behaviour as before, plus:
--   * blocks double-referral of the same member
--   * never crashes when referral_settings row is missing
CREATE OR REPLACE FUNCTION process_referral(
  p_gym_id UUID,
  p_new_member_id UUID,
  p_referrer_id UUID,
  p_changed_by UUID DEFAULT NULL,
  p_changed_by_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_points INT;
  v_referrer_name TEXT;
  v_new_member_name TEXT;
  v_already UUID;
  v_new_total INT;
BEGIN
  IF p_new_member_id = p_referrer_id THEN
    RETURN jsonb_build_object('error', 'Cannot refer yourself');
  END IF;

  SELECT full_name INTO v_referrer_name
  FROM members WHERE id = p_referrer_id AND gym_id = p_gym_id;

  IF v_referrer_name IS NULL THEN
    RETURN jsonb_build_object('error', 'Referrer not found in this gym');
  END IF;

  SELECT full_name, referred_by INTO v_new_member_name, v_already
  FROM members WHERE id = p_new_member_id AND gym_id = p_gym_id;

  IF v_new_member_name IS NULL THEN
    RETURN jsonb_build_object('error', 'New member not found in this gym');
  END IF;

  IF v_already IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'This member was already referred');
  END IF;

  SELECT COALESCE(rs.points_per_referral, 50) INTO v_points
  FROM referral_settings rs WHERE rs.gym_id = p_gym_id;

  IF v_points IS NULL THEN v_points := 50; END IF;

  UPDATE members SET referred_by = p_referrer_id WHERE id = p_new_member_id;

  UPDATE members
    SET referral_count = COALESCE(referral_count, 0) + 1,
        points         = COALESCE(points, 0) + v_points
    WHERE id = p_referrer_id
    RETURNING points INTO v_new_total;

  INSERT INTO points_history
    (gym_id, member_id, points_change, new_total, reason, changed_by, changed_by_name)
  VALUES (
    p_gym_id,
    p_referrer_id,
    v_points,
    v_new_total,
    'Referral bonus: ' || COALESCE(v_new_member_name, 'New member') || ' joined',
    p_changed_by,
    p_changed_by_name
  );

  RETURN jsonb_build_object(
    'success', true,
    'referrer_name', v_referrer_name,
    'points_awarded', v_points,
    'referrer_new_total', v_new_total
  );
END;
$$;


-- ─── 4. WORKOUT ASSIGN COLUMNS (safety net) ─────────────────
-- The assign API writes these. Ensure they exist.
ALTER TABLE workout_plans   ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE CASCADE;
ALTER TABLE workout_plans   ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE workout_plans   ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE member_workouts ADD COLUMN IF NOT EXISTS assigned_by_trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS timing_minutes INTEGER;

CREATE INDEX IF NOT EXISTS idx_workout_plans_member_id ON workout_plans (member_id);


-- ─── 5. VERIFY ──────────────────────────────────────────────
-- Run this SELECT after the script to confirm everything landed.
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name='profiles' AND column_name='biometric_uid')          AS profiles_biometric_uid,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name='members' AND column_name='points')                  AS members_points,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name='members' AND column_name='referred_by')             AS members_referred_by,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name='members' AND column_name='referral_count')          AS members_referral_count,
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_name='points_history')                                    AS points_history_table,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name='member_workouts' AND column_name='assigned_by_trainer_id') AS mw_assigned_by_trainer;
