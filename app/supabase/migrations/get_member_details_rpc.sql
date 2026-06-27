-- RPC function to fetch all member details in a single call
-- Replaces 7-8 separate queries on the member/[id] page
CREATE OR REPLACE FUNCTION get_member_details(
  p_member_id UUID,
  p_gym_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member RECORD;
  v_result JSONB;
  v_memberships JSONB;
  v_payments JSONB;
  v_attendance JSONB;
  v_diet_plans JSONB;
  v_workout_plans JSONB;
  v_trainer JSONB;
  v_trainer_schedule JSONB;
  v_next_payment JSONB;
  v_latest_membership_id UUID;
  v_latest_total_amount NUMERIC := 0;
  v_latest_paid_amount NUMERIC := 0;
  v_latest_due_amount NUMERIC := 0;
BEGIN
  -- 1. Fetch member basic info
  SELECT id, full_name, phone, email, balance, profile_image, 
         join_date, created_at, created_by_name, gym_id
  INTO v_member
  FROM members
  WHERE id = p_member_id AND gym_id = p_gym_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Member not found');
  END IF;

  -- 2. Fetch memberships with plan details
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'plan_id', m.plan_id,
      'start_date', m.start_date,
      'end_date', m.end_date,
      'status', m.status,
      'custom_price', m.custom_price,
      'total_amount', COALESCE(m.total_amount, m.custom_price, mp.price, 0),
      'due_amount', m.due_amount,
      'created_at', m.created_at,
      'membership_plans', jsonb_build_object(
        'id', mp.id,
        'name', mp.name,
        'price', mp.price,
        'duration_days', mp.duration_days
      )
    ) ORDER BY m.created_at DESC
  ), '[]'::jsonb)
  INTO v_memberships
  FROM memberships m
  LEFT JOIN membership_plans mp ON mp.id = m.plan_id
  WHERE m.member_id = p_member_id;

  SELECT m.id, COALESCE(m.total_amount, m.custom_price, mp.price, 0)
  INTO v_latest_membership_id, v_latest_total_amount
  FROM memberships m
  LEFT JOIN membership_plans mp ON mp.id = m.plan_id
  WHERE m.member_id = p_member_id
  ORDER BY m.created_at DESC
  LIMIT 1;

  IF v_latest_membership_id IS NOT NULL THEN
    SELECT COALESCE(SUM(p.amount), 0)
    INTO v_latest_paid_amount
    FROM payments p
    WHERE p.membership_id = v_latest_membership_id
      AND p.status = 'paid';
  END IF;

  v_latest_due_amount := GREATEST(0, COALESCE(v_latest_total_amount, 0) - COALESCE(v_latest_paid_amount, 0));

  -- 3. Fetch all payments
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'amount', p.amount,
      'payment_mode', p.payment_mode,
      'notes', p.notes,
      'status', p.status,
      'membership_id', p.membership_id,
      'paid_at', p.paid_at,
      'created_at', p.created_at,
      'next_payment_date', p.next_payment_date
    ) ORDER BY p.created_at DESC
  ), '[]'::jsonb)
  INTO v_payments
  FROM payments p
  WHERE p.member_id = p_member_id;

  -- 4. Fetch last 10 attendance records
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'check_in_date', a.check_in_date,
      'check_in_time', a.check_in_time,
      'check_out_time', a.check_out_time
    ) ORDER BY a.check_in_date DESC
  ), '[]'::jsonb)
  INTO v_attendance
  FROM (
    SELECT check_in_date, check_in_time, check_out_time
    FROM attendance
    WHERE member_id = p_member_id
    ORDER BY check_in_date DESC
    LIMIT 10
  ) a;

  -- 5. Fetch assigned diet plans
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', md.id,
      'assigned_at', md.assigned_at,
      'diet_plans', jsonb_build_object(
        'id', dp.id,
        'title', dp.title,
        'description', dp.description,
        'member_id', dp.member_id,
        'is_template', dp.is_template
      )
    ) ORDER BY md.assigned_at DESC
  ), '[]'::jsonb)
  INTO v_diet_plans
  FROM member_diets md
  LEFT JOIN diet_plans dp ON dp.id = md.diet_plan_id
  WHERE md.member_id = p_member_id;

  -- 6. Fetch assigned workout plans
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', mw.id,
      'assigned_at', mw.assigned_at,
      'workout_plans', jsonb_build_object(
        'id', wp.id,
        'title', wp.title,
        'description', wp.description,
        'member_id', wp.member_id
      )
    ) ORDER BY mw.assigned_at DESC
  ), '[]'::jsonb)
  INTO v_workout_plans
  FROM member_workouts mw
  LEFT JOIN workout_plans wp ON wp.id = mw.workout_plan_id
  WHERE mw.member_id = p_member_id;

  -- 7. Fetch assigned trainer with profile
  SELECT jsonb_build_object(
    'assignment_id', tma.id,
    'trainer_id', tma.trainer_id,
    'plan_end_date', tma.plan_end_date,
    'plan_start_date', tma.plan_start_date,
    'trainer_plan_id', tma.trainer_plan_id,
    'plan_name', tp.name,
    'plan_total_amount', tma.plan_total_amount,
    'total_paid_amount', tma.total_paid_amount,
    'pending_amount', tma.pending_amount,
    'next_payment_date', tma.next_payment_date,
    'first_name', pr.first_name,
    'last_name', pr.last_name,
    'phone', pr.phone
  )
  INTO v_trainer
  FROM trainer_member_assignments tma
  LEFT JOIN trainer_plans tp ON tp.id = tma.trainer_plan_id
  LEFT JOIN profiles pr ON pr.id = tma.trainer_id
  WHERE tma.member_id = p_member_id
    AND tma.is_active = true
  LIMIT 1;

  -- 8. Fetch trainer bookings/schedule (only if trainer assigned)
  IF v_trainer IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'day', tb.day,
        'time_slot', tb.time_slot
      ) ORDER BY tb.day
    ), '[]'::jsonb)
    INTO v_trainer_schedule
    FROM trainer_bookings tb
    WHERE tb.member_id = p_member_id
      AND tb.gym_id = p_gym_id
      AND tb.is_active = true;
  ELSE
    v_trainer_schedule := '[]'::jsonb;
  END IF;

  -- 9. Get next payment info (pending payment with next_payment_date)
  SELECT jsonb_build_object(
    'next_payment_date', p.next_payment_date,
    'remaining_amount', v_latest_due_amount
  )
  INTO v_next_payment
  FROM payments p
  WHERE p.member_id = p_member_id
    AND p.next_payment_date IS NOT NULL
    AND p.status = 'pending'
  ORDER BY p.created_at DESC
  LIMIT 1;

  -- Build final result
  v_result := jsonb_build_object(
    'member', jsonb_build_object(
      'id', v_member.id,
      'full_name', v_member.full_name,
      'phone', v_member.phone,
      'email', v_member.email,
      'balance', v_member.balance,
      'profile_image', v_member.profile_image,
      'join_date', v_member.join_date,
      'created_at', v_member.created_at,
      'created_by_name', v_member.created_by_name,
      'gym_id', v_member.gym_id
    ),
    'memberships', v_memberships,
    'payments', v_payments,
    'attendance', v_attendance,
    'diet_plans', v_diet_plans,
    'workout_plans', v_workout_plans,
    'trainer', v_trainer,
    'trainer_schedule', v_trainer_schedule,
    'next_payment', v_next_payment
  );

  RETURN v_result;
END;
$$;
