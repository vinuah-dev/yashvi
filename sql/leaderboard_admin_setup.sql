-- ============================================================
-- LEADERBOARD SETTINGS TABLE
-- ============================================================
-- Stores admin preferences per member (hide from public board,
-- streak reset timestamps, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS leaderboard_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  is_hidden BOOLEAN DEFAULT false,
  streak_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gym_id, member_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_leaderboard_settings_gym
  ON leaderboard_settings(gym_id);

CREATE INDEX IF NOT EXISTS idx_leaderboard_settings_gym_hidden
  ON leaderboard_settings(gym_id) WHERE is_hidden = true;

-- RLS: Allow authenticated users to manage their gym's settings
ALTER TABLE leaderboard_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON leaderboard_settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- UPDATE the leaderboard function to respect hidden members
-- ============================================================

CREATE OR REPLACE FUNCTION get_attendance_leaderboard(
  p_gym_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH member_dates AS (
    SELECT DISTINCT a.member_id, a.check_in_date
    FROM attendance a
    WHERE a.gym_id = p_gym_id
      AND a.check_in_date >= CURRENT_DATE - INTERVAL '365 days'
      -- Respect streak resets: only count dates AFTER reset
      AND a.check_in_date >= COALESCE(
        (SELECT ls.streak_reset_at::DATE
         FROM leaderboard_settings ls
         WHERE ls.gym_id = p_gym_id AND ls.member_id = a.member_id),
        '1970-01-01'::DATE
      )
  ),
  date_gaps AS (
    SELECT
      member_id,
      check_in_date,
      check_in_date - (ROW_NUMBER() OVER (
        PARTITION BY member_id ORDER BY check_in_date
      ))::INT AS streak_group
    FROM member_dates
  ),
  streaks AS (
    SELECT
      member_id,
      streak_group,
      COUNT(*) AS streak_length,
      MAX(check_in_date) AS streak_end,
      MIN(check_in_date) AS streak_start
    FROM date_gaps
    GROUP BY member_id, streak_group
  ),
  current_streaks AS (
    SELECT
      member_id,
      streak_length AS current_streak
    FROM streaks
    WHERE streak_end >= CURRENT_DATE - 1
      AND streak_end <= CURRENT_DATE
  ),
  best_streaks AS (
    SELECT
      member_id,
      MAX(streak_length) AS best_streak
    FROM streaks
    GROUP BY member_id
  ),
  total_days AS (
    SELECT
      member_id,
      COUNT(DISTINCT check_in_date) AS days_last_30
    FROM member_dates
    WHERE check_in_date >= CURRENT_DATE - 30
    GROUP BY member_id
  ),
  leaderboard AS (
    SELECT
      m.id,
      m.full_name,
      m.profile_image,
      COALESCE(cs.current_streak, 0) AS current_streak,
      COALESCE(bs.best_streak, 0) AS best_streak,
      COALESCE(td.days_last_30, 0) AS days_last_30
    FROM members m
    LEFT JOIN current_streaks cs ON cs.member_id = m.id
    LEFT JOIN best_streaks bs ON bs.member_id = m.id
    LEFT JOIN total_days td ON td.member_id = m.id
    -- Exclude hidden members from PUBLIC leaderboard
    LEFT JOIN leaderboard_settings ls
      ON ls.gym_id = p_gym_id AND ls.member_id = m.id
    WHERE m.gym_id = p_gym_id
      AND (COALESCE(cs.current_streak, 0) > 0 OR COALESCE(bs.best_streak, 0) > 0)
      AND COALESCE(ls.is_hidden, false) = false
    ORDER BY COALESCE(cs.current_streak, 0) DESC, COALESCE(bs.best_streak, 0) DESC
    LIMIT p_limit
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', lb.id,
      'full_name', lb.full_name,
      'profile_image', lb.profile_image,
      'current_streak', lb.current_streak,
      'best_streak', lb.best_streak,
      'days_last_30', lb.days_last_30
    )
  ), '[]'::jsonb)
  INTO v_result
  FROM leaderboard lb;

  RETURN jsonb_build_object(
    'leaderboard', v_result,
    'generated_at', NOW()
  );
END;
$$;

-- ============================================================
-- ADMIN version: returns ALL members including hidden
-- ============================================================

CREATE OR REPLACE FUNCTION get_attendance_leaderboard_admin(
  p_gym_id UUID,
  p_limit INT DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH member_dates AS (
    SELECT DISTINCT a.member_id, a.check_in_date
    FROM attendance a
    WHERE a.gym_id = p_gym_id
      AND a.check_in_date >= CURRENT_DATE - INTERVAL '365 days'
      AND a.check_in_date >= COALESCE(
        (SELECT ls.streak_reset_at::DATE
         FROM leaderboard_settings ls
         WHERE ls.gym_id = p_gym_id AND ls.member_id = a.member_id),
        '1970-01-01'::DATE
      )
  ),
  date_gaps AS (
    SELECT
      member_id,
      check_in_date,
      check_in_date - (ROW_NUMBER() OVER (
        PARTITION BY member_id ORDER BY check_in_date
      ))::INT AS streak_group
    FROM member_dates
  ),
  streaks AS (
    SELECT
      member_id,
      streak_group,
      COUNT(*) AS streak_length,
      MAX(check_in_date) AS streak_end
    FROM date_gaps
    GROUP BY member_id, streak_group
  ),
  current_streaks AS (
    SELECT member_id, streak_length AS current_streak
    FROM streaks
    WHERE streak_end >= CURRENT_DATE - 1 AND streak_end <= CURRENT_DATE
  ),
  best_streaks AS (
    SELECT member_id, MAX(streak_length) AS best_streak
    FROM streaks GROUP BY member_id
  ),
  total_days AS (
    SELECT member_id, COUNT(DISTINCT check_in_date) AS days_last_30
    FROM member_dates
    WHERE check_in_date >= CURRENT_DATE - 30
    GROUP BY member_id
  ),
  leaderboard AS (
    SELECT
      m.id, m.full_name, m.profile_image,
      COALESCE(cs.current_streak, 0) AS current_streak,
      COALESCE(bs.best_streak, 0) AS best_streak,
      COALESCE(td.days_last_30, 0) AS days_last_30
    FROM members m
    LEFT JOIN current_streaks cs ON cs.member_id = m.id
    LEFT JOIN best_streaks bs ON bs.member_id = m.id
    LEFT JOIN total_days td ON td.member_id = m.id
    WHERE m.gym_id = p_gym_id
      AND (COALESCE(cs.current_streak, 0) > 0 OR COALESCE(bs.best_streak, 0) > 0)
    ORDER BY COALESCE(cs.current_streak, 0) DESC, COALESCE(bs.best_streak, 0) DESC
    LIMIT p_limit
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', lb.id, 'full_name', lb.full_name, 'profile_image', lb.profile_image,
      'current_streak', lb.current_streak, 'best_streak', lb.best_streak,
      'days_last_30', lb.days_last_30
    )
  ), '[]'::jsonb) INTO v_result FROM leaderboard lb;

  RETURN jsonb_build_object('leaderboard', v_result, 'generated_at', NOW());
END;
$$;
