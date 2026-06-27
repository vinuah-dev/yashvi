-- ============================================================
-- MEMBER POINTS SYSTEM
-- ============================================================

-- 1. Add points column to members table (if not exists)
ALTER TABLE members ADD COLUMN IF NOT EXISTS points INT DEFAULT 0;

-- 2. Points history table (audit trail)
CREATE TABLE IF NOT EXISTS points_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  points_change INT NOT NULL, -- positive = added, negative = removed
  new_total INT NOT NULL,
  reason TEXT,
  changed_by UUID, -- admin/trainer who made the change
  changed_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_history_member
  ON points_history(member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_points_history_gym
  ON points_history(gym_id, created_at DESC);

-- Disable RLS (access controlled via API middleware)
ALTER TABLE points_history DISABLE ROW LEVEL SECURITY;

-- 3. Function to update points and log history
CREATE OR REPLACE FUNCTION update_member_points(
  p_gym_id UUID,
  p_member_id UUID,
  p_points_change INT,
  p_reason TEXT DEFAULT NULL,
  p_changed_by UUID DEFAULT NULL,
  p_changed_by_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_total INT;
BEGIN
  -- Update points (don't go below 0)
  UPDATE members
  SET points = GREATEST(0, COALESCE(points, 0) + p_points_change)
  WHERE id = p_member_id AND gym_id = p_gym_id
  RETURNING points INTO v_new_total;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Member not found');
  END IF;

  -- Log history
  INSERT INTO points_history (gym_id, member_id, points_change, new_total, reason, changed_by, changed_by_name)
  VALUES (p_gym_id, p_member_id, p_points_change, v_new_total, p_reason, p_changed_by, p_changed_by_name);

  RETURN jsonb_build_object(
    'new_total', v_new_total,
    'change', p_points_change
  );
END;
$$;

-- 4. Function to get points history for a member
CREATE OR REPLACE FUNCTION get_member_points_history(
  p_member_id UUID,
  p_limit INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ph.id,
      'points_change', ph.points_change,
      'new_total', ph.new_total,
      'reason', ph.reason,
      'changed_by_name', ph.changed_by_name,
      'created_at', ph.created_at
    ) ORDER BY ph.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM points_history ph
  WHERE ph.member_id = p_member_id
  LIMIT p_limit;

  RETURN v_result;
END;
$$;
