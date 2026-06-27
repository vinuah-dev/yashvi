-- RPC function to fetch all trainer detail data in a single call
-- Replaces 8+ separate queries on the trainer detail page
CREATE OR REPLACE FUNCTION get_trainer_details(
  p_trainer_id UUID,
  p_gym_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_trainer JSONB;
  v_profile_id UUID;
  v_assigned_members JSONB;
  v_activity_log JSONB;
  v_trainer_plans JSONB;
  v_trainer_earnings JSONB;
  v_earnings_summary JSONB;
BEGIN
  -- Step 1: Fetch trainer + profile info
  SELECT jsonb_build_object(
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
    'password', p.password,
    'trainer_cost', p.trainer_cost,
    'available_days', p.available_days,
    'available_time_slots', p.available_time_slots
  ),
  gt.profile_id
  INTO v_trainer, v_profile_id
  FROM gym_trainers gt
  JOIN profiles p ON p.id = gt.profile_id
  WHERE gt.id = p_trainer_id
    AND gt.gym_id = p_gym_id;

  -- If trainer not found, return null
  IF v_trainer IS NULL THEN
    RETURN jsonb_build_object('trainer', NULL);
  END IF;

  -- Step 2: Fetch assigned members with plan info + earnings + membership status
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'assignment_id', tma.id,
      'member_id', tma.member_id,
      'assigned_at', tma.assigned_at,
      'notes', tma.notes,
      'is_active', tma.is_active,
      'trainer_plan_id', tma.trainer_plan_id,
      'plan_start_date', tma.plan_start_date,
      'plan_end_date', tma.plan_end_date,
      'plan_name', tp.name,
      'plan_price', tp.price,
      'plan_duration_days', tp.duration_days,
      'plan_total_amount', tma.plan_total_amount,
      'total_paid_amount', tma.total_paid_amount,
      'pending_amount', tma.pending_amount,
      'next_payment_date', tma.next_payment_date,
      'member_name', m.full_name,
      'member_phone', m.phone,
      'member_profile_image', m.profile_image,
      'membership_status', (
        SELECT ms.status
        FROM memberships ms
        WHERE ms.member_id = tma.member_id
        ORDER BY ms.created_at DESC
        LIMIT 1
      ),
      'membership_end_date', (
        SELECT ms.end_date
        FROM memberships ms
        WHERE ms.member_id = tma.member_id
        ORDER BY ms.created_at DESC
        LIMIT 1
      ),
      'paid_amount', COALESCE(tma.total_paid_amount, 0)
    ) ORDER BY tma.assigned_at DESC
  ), '[]'::jsonb)
  INTO v_assigned_members
  FROM trainer_member_assignments tma
  JOIN members m ON m.id = tma.member_id
  LEFT JOIN trainer_plans tp ON tp.id = tma.trainer_plan_id
  WHERE tma.trainer_id = v_profile_id
    AND tma.gym_id = p_gym_id
    AND tma.is_active = true;

  -- Step 3: Fetch activity log (diet, workout, member assignments, payments — last 15 each)
  SELECT COALESCE(jsonb_agg(activity ORDER BY activity->>'date' DESC), '[]'::jsonb)
  INTO v_activity_log
  FROM (
    -- Diet assignments by this trainer
    (
      SELECT jsonb_build_object(
        'id', 'diet-' || md.id,
        'type', 'diet',
        'action', 'Assigned diet plan',
        'member_name', m.full_name,
        'details', dp.title,
        'date', md.assigned_at
      ) AS activity
      FROM member_diets md
      JOIN members m ON m.id = md.member_id
      LEFT JOIN diet_plans dp ON dp.id = md.diet_plan_id
      WHERE md.assigned_by_trainer_id = v_profile_id
      LIMIT 15
    )

    UNION ALL

    -- Workout assignments by this trainer
    (
      SELECT jsonb_build_object(
        'id', 'workout-' || mw.id,
        'type', 'workout',
        'action', 'Assigned workout plan',
        'member_name', m.full_name,
        'details', wp.title,
        'date', mw.assigned_at
      ) AS activity
      FROM member_workouts mw
      JOIN members m ON m.id = mw.member_id
      LEFT JOIN workout_plans wp ON wp.id = mw.workout_plan_id
      WHERE mw.assigned_by_trainer_id = v_profile_id
      LIMIT 15
    )

    UNION ALL

    -- Member assignment/unassignment events
    (
      SELECT jsonb_build_object(
        'id', 'member-' || tma2.id,
        'type', 'member_assignment',
        'action', CASE WHEN tma2.is_active THEN 'Member assigned' ELSE 'Member unassigned' END,
        'member_name', m.full_name,
        'details', NULL::text,
        'date', tma2.assigned_at
      ) AS activity
      FROM trainer_member_assignments tma2
      JOIN members m ON m.id = tma2.member_id
      WHERE tma2.trainer_id = v_profile_id
        AND tma2.gym_id = p_gym_id
      LIMIT 15
    )

    UNION ALL

    -- Payments collected by this trainer
    (
      SELECT jsonb_build_object(
        'id', 'payment-' || pay.id,
        'type', 'payment',
        'action', 'Collected payment',
        'member_name', m.full_name,
        'details', '₹' || TRIM(TO_CHAR(pay.amount, '99,99,999')),
        'date', pay.created_at
      ) AS activity
      FROM payments pay
      JOIN members m ON m.id = pay.member_id
      WHERE pay.gym_id = p_gym_id
        AND pay.status = 'paid'
        AND pay.collected_by = v_profile_id
      LIMIT 15
    )
  ) sub;

  -- Step 4: Fetch trainer plans with subscriber counts
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', tp.id,
      'name', tp.name,
      'description', tp.description,
      'duration_days', tp.duration_days,
      'price', tp.price,
      'is_active', tp.is_active,
      'created_at', tp.created_at,
      'updated_at', tp.updated_at,
      'subscribers', (
        SELECT COUNT(*)::int
        FROM trainer_member_assignments tma3
        WHERE tma3.trainer_plan_id = tp.id
          AND tma3.trainer_id = v_profile_id
          AND tma3.gym_id = p_gym_id
          AND tma3.is_active = true
      )
    ) ORDER BY tp.duration_days ASC
  ), '[]'::jsonb)
  INTO v_trainer_plans
  FROM trainer_plans tp
  WHERE tp.gym_id = p_gym_id
    AND tp.trainer_id = v_profile_id;

  -- Step 5: Fetch trainer earnings with member & plan info
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', te.id,
      'total_amount', te.total_amount,
      'trainer_amount', te.trainer_amount,
      'gym_amount', te.gym_amount,
      'payment_mode', te.payment_mode,
      'notes', te.notes,
      'created_at', te.created_at,
      'member_name', m.full_name,
      'member_phone', m.phone,
      'plan_name', tp.name,
      'plan_duration_days', tp.duration_days
    ) ORDER BY te.created_at DESC
  ), '[]'::jsonb)
  INTO v_trainer_earnings
  FROM trainer_earnings te
  JOIN members m ON m.id = te.member_id
  LEFT JOIN trainer_plans tp ON tp.id = te.trainer_plan_id
  WHERE te.gym_id = p_gym_id
    AND te.trainer_id = v_profile_id;

  -- Step 6: Calculate earnings summary
  SELECT jsonb_build_object(
    'total', COALESCE(SUM(te2.trainer_amount), 0),
    'this_month', COALESCE(SUM(
      CASE WHEN te2.created_at >= DATE_TRUNC('month', CURRENT_DATE)
        THEN te2.trainer_amount ELSE 0 END
    ), 0),
    'last_month', COALESCE(SUM(
      CASE WHEN te2.created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
           AND te2.created_at < DATE_TRUNC('month', CURRENT_DATE)
        THEN te2.trainer_amount ELSE 0 END
    ), 0)
  )
  INTO v_earnings_summary
  FROM trainer_earnings te2
  WHERE te2.gym_id = p_gym_id
    AND te2.trainer_id = v_profile_id;

  -- Build final result
  v_result := jsonb_build_object(
    'trainer', v_trainer,
    'assigned_members', v_assigned_members,
    'activity_log', v_activity_log,
    'trainer_plans', v_trainer_plans,
    'trainer_earnings', v_trainer_earnings,
    'earnings_summary', v_earnings_summary
  );

  RETURN v_result;
END;
$$;
