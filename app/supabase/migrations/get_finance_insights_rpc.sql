-- ============================================================
-- RPC: get_finance_insights
-- Returns all-time summary + month-wise breakdown for Finance Insights page
-- ============================================================
CREATE OR REPLACE FUNCTION get_finance_insights(
  p_gym_id UUID,
  p_month INTEGER,       -- 1-12
  p_year INTEGER          -- e.g. 2026
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_total_revenue NUMERIC;
  v_total_salary_paid NUMERIC;
  v_total_dues NUMERIC;
  v_avg_monthly_revenue NUMERIC;
  v_first_payment_date DATE;
  v_months_active NUMERIC;
  v_month_start DATE;
  v_month_end DATE;
  v_month_revenue NUMERIC;
  v_month_new_joins INTEGER;
  v_month_renewals INTEGER;
  v_month_active_members INTEGER;
  v_month_start_ts TIMESTAMPTZ;
  v_month_end_ts TIMESTAMPTZ;
  v_current_year INTEGER;
  v_current_month INTEGER;
  v_reporting_tz TEXT := 'Asia/Kolkata';
BEGIN
  -- ===================== ALL-TIME STATS =====================

  -- 1. Total Revenue (all time) - sum of all payments
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_revenue
  FROM payments
  WHERE gym_id = p_gym_id
    AND status = 'paid';

  -- 2. Total Trainer Salary Paid (all time) - from trainer_earnings table
  SELECT COALESCE(SUM(trainer_amount), 0)
  INTO v_total_salary_paid
  FROM trainer_earnings
  WHERE gym_id = p_gym_id;

  -- 3. Total Pending Dues (all time) - sum of member balances > 0
  SELECT COALESCE(SUM(balance), 0)
  INTO v_total_dues
  FROM members
  WHERE gym_id = p_gym_id
    AND balance > 0;

  -- 4. Average Monthly Revenue
  --    Calculate months since first payment, then divide total revenue
  SELECT MIN(COALESCE(paid_at::date, created_at::date))
  INTO v_first_payment_date
  FROM payments
  WHERE gym_id = p_gym_id
    AND status = 'paid';

  IF v_first_payment_date IS NOT NULL THEN
    v_months_active := GREATEST(
      1,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_first_payment_date)) * 12 +
      EXTRACT(MONTH FROM AGE(CURRENT_DATE, v_first_payment_date)) + 1
    );
    v_avg_monthly_revenue := ROUND(v_total_revenue / v_months_active, 2);
  ELSE
    v_avg_monthly_revenue := 0;
  END IF;

  -- ===================== MONTH-WISE STATS =====================

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_month_start_ts := (v_month_start::timestamp AT TIME ZONE v_reporting_tz);
  v_month_end_ts := (((v_month_start + INTERVAL '1 month')::timestamp AT TIME ZONE v_reporting_tz) - INTERVAL '1 millisecond');
  v_current_year := EXTRACT(YEAR FROM (NOW() AT TIME ZONE v_reporting_tz));
  v_current_month := EXTRACT(MONTH FROM (NOW() AT TIME ZONE v_reporting_tz));

  IF p_year = v_current_year AND p_month = v_current_month THEN
    v_month_end_ts := LEAST(v_month_end_ts, NOW());
  END IF;

  -- 5. Month Revenue (same event-time semantics as /finance page)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_month_revenue
  FROM payments
  WHERE gym_id = p_gym_id
    AND status = 'paid'
    AND COALESCE(paid_at, created_at) >= v_month_start_ts
    AND COALESCE(paid_at, created_at) <= v_month_end_ts;

  -- 6. Month New Joins
  -- Count members whose FIRST paid membership payment falls in this month.
  -- This aligns joins with actual finance events and avoids join_date drift.
  SELECT COUNT(*)
  INTO v_month_new_joins
  FROM (
    SELECT p.member_id, MIN(COALESCE(p.paid_at, p.created_at)) AS first_paid_at
    FROM payments p
    WHERE p.gym_id = p_gym_id
      AND p.status = 'paid'
      AND p.member_id IS NOT NULL
      AND p.membership_id IS NOT NULL
    GROUP BY p.member_id
  ) first_paid
  WHERE first_paid.first_paid_at >= v_month_start_ts
    AND first_paid.first_paid_at <= v_month_end_ts;

  -- 7. Month Renewals - memberships created in the month that are NOT the first membership for that member
  SELECT COUNT(*)
  INTO v_month_renewals
  FROM memberships ms
  WHERE ms.gym_id = p_gym_id
    AND ms.created_at >= v_month_start_ts
    AND ms.created_at <= v_month_end_ts
    AND EXISTS (
      SELECT 1 FROM memberships ms2
      WHERE ms2.member_id = ms.member_id
        AND ms2.gym_id = p_gym_id
        AND ms2.id != ms.id
        AND ms2.created_at < ms.created_at
    );

  -- 8. Month Active Members - members with an active membership overlapping the month
  SELECT COUNT(DISTINCT ms.member_id)
  INTO v_month_active_members
  FROM memberships ms
  WHERE ms.gym_id = p_gym_id
    AND ms.start_date <= v_month_end
    AND ms.end_date >= v_month_start
    AND ms.status = 'active';

  -- ===================== BUILD RESULT =====================

  v_result := jsonb_build_object(
    'total_revenue_all_time', v_total_revenue,
    'total_salary_paid_all_time', v_total_salary_paid,
    'total_dues_all_time', v_total_dues,
    'net_profit_all_time', v_total_revenue - v_total_salary_paid,
    'avg_monthly_revenue', v_avg_monthly_revenue,
    'month_revenue', v_month_revenue,
    'month_new_joins', v_month_new_joins,
    'month_renewals', v_month_renewals,
    'month_active_members', v_month_active_members,

    -- Detail: New Joins list (first paid membership payment in month)
    'month_new_joins_list', COALESCE((
      WITH first_paid AS (
        SELECT
          p.member_id,
          MIN(COALESCE(p.paid_at, p.created_at)) AS first_paid_at
        FROM payments p
        WHERE p.gym_id = p_gym_id
          AND p.status = 'paid'
          AND p.member_id IS NOT NULL
          AND p.membership_id IS NOT NULL
        GROUP BY p.member_id
      )
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id,
        'full_name', m.full_name,
        'phone', m.phone,
        'join_date', (fp.first_paid_at AT TIME ZONE v_reporting_tz)::date,
        'plan_name', COALESCE(mp.name, 'No Plan'),
        'end_date', ms.end_date,
        'payment_mode', first_membership_payment.payment_mode
      ) ORDER BY fp.first_paid_at DESC)
      FROM first_paid fp
      JOIN members m ON m.id = fp.member_id
      LEFT JOIN LATERAL (
        SELECT p1.membership_id, p1.payment_mode
        FROM payments p1
        WHERE p1.gym_id = p_gym_id
          AND p1.member_id = fp.member_id
          AND p1.status = 'paid'
          AND p1.membership_id IS NOT NULL
        ORDER BY COALESCE(p1.paid_at, p1.created_at) ASC
        LIMIT 1
      ) first_membership_payment ON TRUE
      LEFT JOIN memberships ms ON ms.id = first_membership_payment.membership_id
      LEFT JOIN membership_plans mp ON mp.id = ms.plan_id
      WHERE fp.first_paid_at >= v_month_start_ts
        AND fp.first_paid_at <= v_month_end_ts
    ), '[]'::jsonb),

    -- Detail: Revenue payments list
    'month_revenue_list', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'member_name', COALESCE(mem.full_name, 'Unknown'),
        'phone', mem.phone,
        'amount', p.amount,
        'payment_mode', p.payment_mode,
        'paid_at', COALESCE(p.paid_at, p.created_at)
      ) ORDER BY COALESCE(p.paid_at, p.created_at) DESC)
      FROM payments p
      LEFT JOIN members mem ON mem.id = p.member_id
      WHERE p.gym_id = p_gym_id
        AND p.status = 'paid'
        AND COALESCE(p.paid_at, p.created_at) >= v_month_start_ts
        AND COALESCE(p.paid_at, p.created_at) <= v_month_end_ts
    ), '[]'::jsonb),

    -- Detail: Renewals list
    'month_renewals_list', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ms.id,
        'member_name', COALESCE(mem.full_name, 'Unknown'),
        'phone', mem.phone,
        'plan_name', COALESCE(mp.name, 'N/A'),
        'start_date', ms.start_date,
        'end_date', ms.end_date,
        'renewed_at', ms.start_date,
        'created_at', ms.created_at
      ) ORDER BY ms.start_date DESC, ms.created_at DESC)
      FROM memberships ms
      JOIN members mem ON mem.id = ms.member_id
      LEFT JOIN membership_plans mp ON mp.id = ms.plan_id
      WHERE ms.gym_id = p_gym_id
        AND ms.start_date >= v_month_start_ts::date
        AND ms.start_date <= v_month_end_ts::date
        AND EXISTS (
          SELECT 1 FROM memberships ms2
          WHERE ms2.member_id = ms.member_id
            AND ms2.gym_id = p_gym_id
            AND ms2.id != ms.id
            AND COALESCE(ms2.start_date, ms2.created_at::date) < COALESCE(ms.start_date, ms.created_at::date)
        )
    ), '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;
