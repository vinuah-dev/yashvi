-- ============================================================
-- GYM CHALLENGES SYSTEM
-- ============================================================
-- Admins create time-bound challenges. Members participate.
-- Each challenge has its own leaderboard.
--
-- Challenge types:
--   streak       — longest consecutive attendance during challenge period
--   total_days   — most attendance days during challenge period
--   consistency  — highest attendance % (days attended / total days)
--   custom       — admin manually updates scores (for weight, reps, etc.)
-- ============================================================

-- 1. Challenges table
CREATE TABLE IF NOT EXISTS gym_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('streak', 'total_days', 'consistency', 'custom')),
  custom_unit TEXT, -- e.g. "kg", "reps", "minutes" — only for custom type
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_challenges_gym ON gym_challenges(gym_id);
CREATE INDEX IF NOT EXISTS idx_challenges_gym_active ON gym_challenges(gym_id, is_active);
CREATE INDEX IF NOT EXISTS idx_challenges_dates ON gym_challenges(gym_id, start_date, end_date);

-- 2. Challenge participants (for custom type — stores manual scores)
CREATE TABLE IF NOT EXISTS challenge_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES gym_challenges(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  score NUMERIC DEFAULT 0,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge
  ON challenge_participants(challenge_id);

-- RLS
ALTER TABLE gym_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON gym_challenges
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated" ON challenge_participants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- 3. Get all challenges for a gym
-- ============================================================
CREATE OR REPLACE FUNCTION get_gym_challenges(p_gym_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'description', c.description,
      'challenge_type', c.challenge_type,
      'custom_unit', c.custom_unit,
      'start_date', c.start_date,
      'end_date', c.end_date,
      'is_active', c.is_active,
      'created_at', c.created_at,
      'days_total', (c.end_date - c.start_date + 1),
      'days_remaining', GREATEST(0, c.end_date - CURRENT_DATE),
      'days_elapsed', LEAST(c.end_date - c.start_date + 1, GREATEST(0, CURRENT_DATE - c.start_date + 1)),
      'status', CASE
        WHEN CURRENT_DATE < c.start_date THEN 'upcoming'
        WHEN CURRENT_DATE > c.end_date THEN 'ended'
        ELSE 'active'
      END,
      'participant_count', (
        SELECT COUNT(DISTINCT CASE
          WHEN c.challenge_type = 'custom' THEN cp2.member_id
          ELSE a2.member_id
        END)
        FROM attendance a2
        LEFT JOIN challenge_participants cp2 ON cp2.challenge_id = c.id
        WHERE (a2.gym_id = p_gym_id AND a2.check_in_date BETWEEN c.start_date AND c.end_date)
           OR cp2.challenge_id = c.id
      )
    ) ORDER BY
      CASE WHEN CURRENT_DATE BETWEEN c.start_date AND c.end_date THEN 0
           WHEN CURRENT_DATE < c.start_date THEN 1
           ELSE 2 END,
      c.start_date DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM gym_challenges c
  WHERE c.gym_id = p_gym_id;

  RETURN v_result;
END;
$$;


-- ============================================================
-- 4. Get challenge leaderboard
-- ============================================================
CREATE OR REPLACE FUNCTION get_challenge_leaderboard(
  p_challenge_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
  v_challenge RECORD;
BEGIN
  -- Get challenge details
  SELECT * INTO v_challenge FROM gym_challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Challenge not found');
  END IF;

  IF v_challenge.challenge_type = 'custom' THEN
    -- Custom: read from challenge_participants table
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'full_name', m.full_name,
        'profile_image', m.profile_image,
        'score', cp.score,
        'notes', cp.notes
      ) ORDER BY cp.score DESC
    ), '[]'::jsonb)
    INTO v_result
    FROM challenge_participants cp
    JOIN members m ON m.id = cp.member_id
    WHERE cp.challenge_id = p_challenge_id
    LIMIT p_limit;

  ELSIF v_challenge.challenge_type = 'streak' THEN
    -- Streak: longest consecutive days within challenge window
    WITH member_dates AS (
      SELECT DISTINCT a.member_id, a.check_in_date
      FROM attendance a
      WHERE a.gym_id = v_challenge.gym_id
        AND a.check_in_date BETWEEN v_challenge.start_date
          AND LEAST(v_challenge.end_date, CURRENT_DATE)
    ),
    date_gaps AS (
      SELECT member_id, check_in_date,
        check_in_date - (ROW_NUMBER() OVER (
          PARTITION BY member_id ORDER BY check_in_date
        ))::INT AS streak_group
      FROM member_dates
    ),
    best_streaks AS (
      SELECT member_id, MAX(cnt) AS best_streak
      FROM (
        SELECT member_id, streak_group, COUNT(*) AS cnt
        FROM date_gaps GROUP BY member_id, streak_group
      ) sub
      GROUP BY member_id
    )
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'full_name', m.full_name,
        'profile_image', m.profile_image,
        'score', bs.best_streak
      ) ORDER BY bs.best_streak DESC
    ), '[]'::jsonb)
    INTO v_result
    FROM best_streaks bs
    JOIN members m ON m.id = bs.member_id
    LIMIT p_limit;

  ELSIF v_challenge.challenge_type = 'total_days' THEN
    -- Total days attended within challenge window
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'full_name', m.full_name,
        'profile_image', m.profile_image,
        'score', sub.total_days
      ) ORDER BY sub.total_days DESC
    ), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT a.member_id, COUNT(DISTINCT a.check_in_date) AS total_days
      FROM attendance a
      WHERE a.gym_id = v_challenge.gym_id
        AND a.check_in_date BETWEEN v_challenge.start_date
          AND LEAST(v_challenge.end_date, CURRENT_DATE)
      GROUP BY a.member_id
    ) sub
    JOIN members m ON m.id = sub.member_id
    LIMIT p_limit;

  ELSIF v_challenge.challenge_type = 'consistency' THEN
    -- Consistency: % of days attended
    WITH day_counts AS (
      SELECT a.member_id,
        COUNT(DISTINCT a.check_in_date) AS days_attended,
        GREATEST(1, LEAST(v_challenge.end_date, CURRENT_DATE) - v_challenge.start_date + 1) AS total_days
      FROM attendance a
      WHERE a.gym_id = v_challenge.gym_id
        AND a.check_in_date BETWEEN v_challenge.start_date
          AND LEAST(v_challenge.end_date, CURRENT_DATE)
      GROUP BY a.member_id
    )
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'full_name', m.full_name,
        'profile_image', m.profile_image,
        'score', ROUND((dc.days_attended::NUMERIC / dc.total_days) * 100, 1),
        'days_attended', dc.days_attended,
        'total_days', dc.total_days
      ) ORDER BY (dc.days_attended::NUMERIC / dc.total_days) DESC
    ), '[]'::jsonb)
    INTO v_result
    FROM day_counts dc
    JOIN members m ON m.id = dc.member_id
    LIMIT p_limit;

  END IF;

  RETURN jsonb_build_object(
    'challenge', jsonb_build_object(
      'id', v_challenge.id,
      'title', v_challenge.title,
      'description', v_challenge.description,
      'challenge_type', v_challenge.challenge_type,
      'custom_unit', v_challenge.custom_unit,
      'start_date', v_challenge.start_date,
      'end_date', v_challenge.end_date,
      'status', CASE
        WHEN CURRENT_DATE < v_challenge.start_date THEN 'upcoming'
        WHEN CURRENT_DATE > v_challenge.end_date THEN 'ended'
        ELSE 'active'
      END,
      'days_remaining', GREATEST(0, v_challenge.end_date - CURRENT_DATE)
    ),
    'leaderboard', COALESCE(v_result, '[]'::jsonb),
    'generated_at', NOW()
  );
END;
$$;
