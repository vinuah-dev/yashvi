-- RPC function to fetch all finance data in a single call
-- Replaces 5-6 separate queries on the finance page
CREATE OR REPLACE FUNCTION get_finance_data(
  p_gym_id UUID,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_business_tz TEXT DEFAULT 'Asia/Kolkata'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_payments JSONB;
  v_members_with_dues JSONB;
  v_expenses_total NUMERIC;
  v_payments_with_next_date JSONB;
  v_pending_trainer_installments JSONB;
  v_business_tz TEXT;
BEGIN
  v_business_tz := COALESCE(NULLIF(TRIM(p_business_tz), ''), 'Asia/Kolkata');

  -- 1. Fetch payments in period with member info and resolved collector names
  --    Replicates the OR condition: (paid_at in range) OR (paid_at IS NULL AND created_at in range)
  --    Collector name resolved via profiles table (same as gym_trainers→profiles + profiles fallback)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'amount', p.amount,
      'payment_mode', p.payment_mode,
      'status', p.status,
      'membership_id', p.membership_id,
      'paid_at', p.paid_at,
      'created_at', p.created_at,
      'transaction_gym_id', p.gym_id,
      'collected_by', p.collected_by,
      'collected_by_name', p.collected_by_name,
      'collector_gym_id', pr.gym_id,
      'member_full_name', mem.full_name,
      'member_phone', mem.phone,
      'collector_name', CASE 
        WHEN p.collected_by IS NOT NULL AND pr.id IS NOT NULL THEN 
          COALESCE(
            NULLIF(TRIM(COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, '')), ''),
            NULLIF(TRIM(COALESCE(p.collected_by_name, '')), ''),
            'Trainer'
          )
        ELSE NULLIF(TRIM(COALESCE(p.collected_by_name, '')), '')
      END
    ) ORDER BY p.created_at DESC
  ), '[]'::jsonb)
  INTO v_payments
  FROM payments p
  LEFT JOIN members mem ON mem.id = p.member_id
  LEFT JOIN profiles pr ON pr.id = p.collected_by AND pr.gym_id = p.gym_id
  WHERE p.gym_id = p_gym_id
    AND (
      (p.paid_at >= p_period_start AND p.paid_at <= p_period_end)
      OR 
      (p.paid_at IS NULL AND p.created_at >= p_period_start AND p.created_at <= p_period_end)
    );

  -- 2. Fetch members with balance > 0 (pending dues) with their memberships
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'full_name', m.full_name,
      'phone', m.phone,
      'balance', m.balance,
      'memberships', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', ms.id,
            'end_date', ms.end_date,
            'status', ms.status
          )
        ), '[]'::jsonb)
        FROM memberships ms
        WHERE ms.member_id = m.id
      )
    )
  ), '[]'::jsonb)
  INTO v_members_with_dues
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND m.balance > 0;

  -- 3. Fetch total expenses in period by expense_date (business timezone date boundaries)
  SELECT COALESCE(SUM(e.amount), 0)
  INTO v_expenses_total
  FROM expenses e
  WHERE e.gym_id = p_gym_id
    AND e.expense_date >= (p_period_start AT TIME ZONE v_business_tz)::DATE
    AND e.expense_date <= (p_period_end AT TIME ZONE v_business_tz)::DATE;

  -- 4. Fetch payments with next_payment_date for due date resolution
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', pp.id,
      'member_id', pp.member_id,
      'next_payment_date', pp.next_payment_date,
      'remaining_amount', pp.remaining_amount
    )
  ), '[]'::jsonb)
  INTO v_payments_with_next_date
  FROM payments pp
  WHERE pp.gym_id = p_gym_id
    AND pp.next_payment_date IS NOT NULL
    AND pp.remaining_amount > 0;

  -- 5. Fetch pending trainer installments from active PT assignments
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'assignment_id', tma.id,
      'member_id', m.id,
      'member_full_name', m.full_name,
      'member_phone', m.phone,
      'trainer_id', tma.trainer_id,
      'trainer_full_name', TRIM(COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, '')),
      'plan_name', tp.name,
      'plan_total_amount', tma.plan_total_amount,
      'total_paid_amount', tma.total_paid_amount,
      'pending_amount', tma.pending_amount,
      'next_payment_date', tma.next_payment_date,
      'plan_end_date', tma.plan_end_date
    ) ORDER BY COALESCE(tma.next_payment_date, tma.plan_end_date, CURRENT_DATE) ASC, tma.assigned_at DESC
  ), '[]'::jsonb)
  INTO v_pending_trainer_installments
  FROM trainer_member_assignments tma
  JOIN members m ON m.id = tma.member_id
  LEFT JOIN profiles pr ON pr.id = tma.trainer_id
  LEFT JOIN trainer_plans tp ON tp.id = tma.trainer_plan_id
  WHERE tma.gym_id = p_gym_id
    AND tma.is_active = true
    AND COALESCE(tma.pending_amount, 0) > 0;

  -- Build final result
  v_result := jsonb_build_object(
    'payments', v_payments,
    'members_with_dues', v_members_with_dues,
    'expenses_total', v_expenses_total,
    'payments_with_next_date', v_payments_with_next_date,
    'pending_trainer_installments', v_pending_trainer_installments
  );

  RETURN v_result;
END;
$$;
