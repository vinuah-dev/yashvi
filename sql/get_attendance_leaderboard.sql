-- ============================================================
-- LEADERBOARD: Attendance Streak Calculator
-- ============================================================
-- Calculates current streak (consecutive days) and best streak
-- for all members of a gym. Returns top members sorted by
-- current streak descending.
--
-- A "streak" = consecutive calendar days with at least 1 check-in.
-- Today counts. Yesterday must exist for streak > 1.
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
    -- Get distinct check-in dates per member
    SELECT DISTINCT a.member_id, a.check_in_date
    FROM attendance a
    WHERE a.gym_id = p_gym_id
      AND a.check_in_date >= CURRENT_DATE - INTERVAL '365 days'
  ),
  date_gaps AS (
    -- For each member, find gaps between consecutive dates
    SELECT
      member_id,
      check_in_date,
      check_in_date - (ROW_NUMBER() OVER (
        PARTITION BY member_id ORDER BY check_in_date
      ))::INT AS streak_group
    FROM member_dates
  ),
  streaks AS (
    -- Calculate each streak's length and end date
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
    -- Current streak = the streak that includes today or yesterday
    SELECT
      member_id,
      streak_length AS current_streak
    FROM streaks
    WHERE streak_end >= CURRENT_DATE - 1
      AND streak_end <= CURRENT_DATE
  ),
  best_streaks AS (
    -- Best streak ever for each member
    SELECT
      member_id,
      MAX(streak_length) AS best_streak
    FROM streaks
    GROUP BY member_id
  ),
  total_days AS (
    -- Total attendance days (last 30 days)
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
    WHERE m.gym_id = p_gym_id
      AND (COALESCE(cs.current_streak, 0) > 0 OR COALESCE(bs.best_streak, 0) > 0)
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
