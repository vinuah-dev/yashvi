-- RPC function to fetch all trainer management data in a single call
-- Replaces 6+ separate queries on the trainers settings page
-- Also handles auto-sync of profile trainers → gym_trainers rows
CREATE OR REPLACE FUNCTION get_trainers_list(
  p_gym_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_trainers JSONB;
  v_stats JSONB;
BEGIN
  -- Step 1: Auto-sync — create gym_trainers rows for any profile trainers
  --         that are missing from the gym_trainers table
  INSERT INTO gym_trainers (gym_id, profile_id, is_active, hire_date)
  SELECT p_gym_id, p.id, true, CURRENT_DATE
  FROM profiles p
  WHERE p.role = 'trainer'
    AND p.gym_id = p_gym_id
    AND NOT EXISTS (
      SELECT 1 FROM gym_trainers gt
      WHERE gt.gym_id = p_gym_id AND gt.profile_id = p.id
    );

  -- Step 2: Fetch all trainers with profile info + counts in one shot
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', gt.id,
      'profile_id', gt.profile_id,
      'specialization', gt.specialization,
      'bio', gt.bio,
      'monthly_salary', gt.monthly_salary,
      'is_active', gt.is_active,
      'hire_date', gt.hire_date,
      'created_at', gt.created_at,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'email', p.email,
      'phone', p.phone,
      'assigned_members', (
        SELECT COUNT(*)::int
        FROM trainer_member_assignments tma
        WHERE tma.trainer_id = gt.profile_id
          AND tma.gym_id = p_gym_id
          AND tma.is_active = true
      ),
      'diet_plans', (
        SELECT COUNT(*)::int
        FROM diet_plans dp
        WHERE dp.trainer_id = gt.profile_id
          AND dp.gym_id = p_gym_id
      ),
      'workout_plans', (
        SELECT COUNT(*)::int
        FROM workout_plans wp
        WHERE wp.trainer_id = gt.profile_id
          AND wp.gym_id = p_gym_id
      )
    ) ORDER BY gt.created_at DESC
  ), '[]'::jsonb)
  INTO v_trainers
  FROM gym_trainers gt
  JOIN profiles p ON p.id = gt.profile_id
  WHERE gt.gym_id = p_gym_id;

  -- Step 3: Calculate aggregate stats
  SELECT jsonb_build_object(
    'total', (
      SELECT COUNT(*)::int
      FROM gym_trainers gt2
      WHERE gt2.gym_id = p_gym_id
    ),
    'active', (
      SELECT COUNT(*)::int
      FROM gym_trainers gt2
      WHERE gt2.gym_id = p_gym_id AND gt2.is_active = true
    ),
    'total_assignments', (
      SELECT COUNT(*)::int
      FROM trainer_member_assignments tma2
      WHERE tma2.gym_id = p_gym_id AND tma2.is_active = true
    )
  )
  INTO v_stats;

  -- Build final result
  v_result := jsonb_build_object(
    'trainers', v_trainers,
    'stats', v_stats
  );

  RETURN v_result;
END;
$$;
