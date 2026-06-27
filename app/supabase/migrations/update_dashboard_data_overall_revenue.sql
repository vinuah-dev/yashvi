-- Update dashboard RPC to include all-time overall revenue
CREATE OR REPLACE FUNCTION get_dashboard_data(
  p_gym_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_members JSONB;
  v_attendance JSONB;
  v_payments JSONB;
  v_overall_revenue NUMERIC;
  v_today DATE := CURRENT_DATE;
  v_first_of_month DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
BEGIN
  -- 1. Fetch all members with memberships and plan prices
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'full_name', m.full_name,
      'phone', m.phone,
      'balance', m.balance,
      'created_at', m.created_at,
      'memberships', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', ms.id,
            'status', ms.status,
            'end_date', ms.end_date,
            'membership_plans', jsonb_build_object(
              'price', mp.price
            )
          )
        ), '[]'::jsonb)
        FROM memberships ms
        LEFT JOIN membership_plans mp ON mp.id = ms.plan_id
        WHERE ms.member_id = m.id
      )
    )
  ), '[]'::jsonb)
  INTO v_members
  FROM members m
  WHERE m.gym_id = p_gym_id;

  -- 2. Fetch today's attendance with member names
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'check_in_time', a.check_in_time,
      'check_out_time', a.check_out_time,
      'membership_status', a.membership_status,
      'member_name', mem.full_name
    ) ORDER BY a.check_in_time DESC
  ), '[]'::jsonb)
  INTO v_attendance
  FROM attendance a
  LEFT JOIN members mem ON mem.id = a.member_id
  WHERE a.gym_id = p_gym_id
    AND a.check_in_date = v_today;

  -- 3. Fetch this month's payments with member names (used for recent payment activity)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'amount', p.amount,
      'created_at', p.created_at,
      'collected_by', p.collected_by,
      'collected_by_name', p.collected_by_name,
      'member_name', mem.full_name
    ) ORDER BY p.created_at DESC
  ), '[]'::jsonb)
  INTO v_payments
  FROM payments p
  LEFT JOIN members mem ON mem.id = p.member_id
  WHERE p.gym_id = p_gym_id
    AND p.created_at >= v_first_of_month;

  -- 4. Fetch overall revenue (all-time)
  SELECT COALESCE(SUM(p.amount), 0)
  INTO v_overall_revenue
  FROM payments p
  WHERE p.gym_id = p_gym_id;

  -- Build final result
  v_result := jsonb_build_object(
    'members', v_members,
    'attendance', v_attendance,
    'payments', v_payments,
    'overall_revenue', v_overall_revenue
  );

  RETURN v_result;
END;
$$;
