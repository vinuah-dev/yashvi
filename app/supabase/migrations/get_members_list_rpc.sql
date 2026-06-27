-- RPC function to fetch all members list data in a single call
-- Replaces 5-6 separate queries on the members list page
CREATE OR REPLACE FUNCTION get_members_list(
  p_gym_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_is_trainer BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_members JSONB;
  v_credentials JSONB;
  v_trainer_assignments JSONB;
  v_my_member_ids JSONB;
BEGIN
  -- 1. Fetch all members with their active/latest membership and plan info
  --    Also resolve created_by trainer names in one go
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'full_name', m.full_name,
      'phone', m.phone,
      'email', m.email,
      'gym_id', m.gym_id,
      'balance', m.balance,
      'profile_image', m.profile_image,
      'created_at', m.created_at,
      'created_by', m.created_by,
      'created_by_name', m.created_by_name,
      'creator_profile_name', CASE
        WHEN m.created_by IS NOT NULL THEN (
          SELECT NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '')
          FROM profiles p
          WHERE p.id = m.created_by
          LIMIT 1
        )
        ELSE NULL
      END,
      'memberships', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', ms.id,
            'plan_id', ms.plan_id,
            'start_date', ms.start_date,
            'end_date', ms.end_date,
            'status', ms.status,
            'membership_plans', jsonb_build_object(
              'id', mp.id,
              'name', mp.name,
              'price', mp.price,
              'duration_days', mp.duration_days
            )
          ) ORDER BY ms.created_at DESC
        ), '[]'::jsonb)
        FROM memberships ms
        LEFT JOIN membership_plans mp ON mp.id = ms.plan_id
        WHERE ms.member_id = m.id
      )
    ) ORDER BY m.created_at DESC
  ), '[]'::jsonb)
  INTO v_members
  FROM members m
  WHERE m.gym_id = p_gym_id;

  -- 2. Fetch all member IDs that have credentials
  SELECT COALESCE(jsonb_agg(mc.member_id), '[]'::jsonb)
  INTO v_credentials
  FROM member_credentials mc
  WHERE mc.member_id IN (
    SELECT id FROM members WHERE gym_id = p_gym_id
  );

  -- 3. Fetch active trainer assignments for all members in this gym
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'member_id', tma.member_id,
      'plan_end_date', tma.plan_end_date,
      'first_name', pr.first_name,
      'last_name', pr.last_name
    )
  ), '[]'::jsonb)
  INTO v_trainer_assignments
  FROM trainer_member_assignments tma
  LEFT JOIN profiles pr ON pr.id = tma.trainer_id
  WHERE tma.member_id IN (
    SELECT id FROM members WHERE gym_id = p_gym_id
  )
  AND tma.is_active = true;

  -- 4. If user is a trainer, fetch their assigned member IDs
  IF p_is_trainer AND p_user_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(tma.member_id), '[]'::jsonb)
    INTO v_my_member_ids
    FROM trainer_member_assignments tma
    WHERE tma.trainer_id = p_user_id
      AND tma.gym_id = p_gym_id
      AND tma.is_active = true;
  ELSE
    v_my_member_ids := '[]'::jsonb;
  END IF;

  -- Build final result
  v_result := jsonb_build_object(
    'members', v_members,
    'credentials', v_credentials,
    'trainer_assignments', v_trainer_assignments,
    'my_member_ids', v_my_member_ids
  );

  RETURN v_result;
END;
$$;
