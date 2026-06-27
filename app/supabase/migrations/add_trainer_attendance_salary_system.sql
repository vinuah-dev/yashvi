-- ============================================================
-- TRAINER ATTENDANCE + PAYROLL SYSTEM
-- Adds monthly salary, shift-based attendance, PT-linked payroll reports
-- ============================================================

-- ============================================================
-- 1. ADD MONTHLY SALARY TO GYM TRAINERS
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'gym_trainers'
          AND column_name = 'monthly_salary'
    ) THEN
        ALTER TABLE gym_trainers
        ADD COLUMN monthly_salary INTEGER DEFAULT NULL;
    END IF;
END $$;

COMMENT ON COLUMN gym_trainers.monthly_salary IS 'Fixed monthly salary for the trainer in INR';

-- ============================================================
-- 2. TRAINER ATTENDANCE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS trainer_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    shift_number SMALLINT NOT NULL CHECK (shift_number IN (1, 2)),
    notes TEXT,
    marked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_trainer_attendance_shift UNIQUE (gym_id, trainer_id, attendance_date, shift_number)
);

COMMENT ON TABLE trainer_attendance IS 'Trainer attendance log with up to two shifts per day';
COMMENT ON COLUMN trainer_attendance.shift_number IS 'Shift number for the day: 1 = first shift, 2 = second shift';

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_trainer_attendance_gym_trainer_date
    ON trainer_attendance (gym_id, trainer_id, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_trainer_attendance_date
    ON trainer_attendance (attendance_date);

-- ============================================================
-- 4. UPDATED_AT TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS update_trainer_attendance_updated_at ON trainer_attendance;
CREATE TRIGGER update_trainer_attendance_updated_at
    BEFORE UPDATE ON trainer_attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. UPDATE EXISTING TRAINER RPCS TO RETURN MONTHLY SALARY
-- ============================================================
CREATE OR REPLACE FUNCTION add_trainer_with_gym(
  p_gym_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_password TEXT,
  p_specialization TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_monthly_salary INTEGER DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_available_days TEXT[] DEFAULT NULL,
  p_available_time_slots JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_gym_trainer_id UUID;
  v_result JSONB;
BEGIN
  PERFORM 1 FROM profiles
    WHERE email = LOWER(p_email) AND gym_id = p_gym_id;
  IF FOUND THEN
    RAISE EXCEPTION 'DUPLICATE_EMAIL:A user with this email already exists in this gym';
  END IF;

  PERFORM 1 FROM profiles
    WHERE phone = p_phone AND gym_id = p_gym_id;
  IF FOUND THEN
    RAISE EXCEPTION 'DUPLICATE_PHONE:A user with this phone number already exists in this gym';
  END IF;

  INSERT INTO profiles (
    first_name, last_name, email, phone, password,
    role, gym_id, available_days, available_time_slots
  ) VALUES (
    p_first_name,
    p_last_name,
    LOWER(p_email),
    p_phone,
    p_password,
    'trainer',
    p_gym_id,
    p_available_days,
    p_available_time_slots
  )
  RETURNING id INTO v_profile_id;

  INSERT INTO gym_trainers (
    gym_id, profile_id, specialization, bio, monthly_salary,
    is_active, hire_date, created_by
  ) VALUES (
    p_gym_id,
    v_profile_id,
    p_specialization,
    p_bio,
    CASE WHEN p_monthly_salary IS NOT NULL AND p_monthly_salary >= 0 THEN p_monthly_salary ELSE NULL END,
    TRUE,
    CURRENT_DATE,
    p_created_by
  )
  RETURNING id INTO v_gym_trainer_id;

  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'gym_trainer_id', v_gym_trainer_id
  );

  RETURN v_result;
END;
$$;

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
  INSERT INTO gym_trainers (gym_id, profile_id, is_active, hire_date)
  SELECT p_gym_id, p.id, true, CURRENT_DATE
  FROM profiles p
  WHERE p.role = 'trainer'
    AND p.gym_id = p_gym_id
    AND NOT EXISTS (
      SELECT 1 FROM gym_trainers gt
      WHERE gt.gym_id = p_gym_id AND gt.profile_id = p.id
    );

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

  v_result := jsonb_build_object(
    'trainers', v_trainers,
    'stats', v_stats
  );

  RETURN v_result;
END;
$$;

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

  IF v_trainer IS NULL THEN
    RETURN jsonb_build_object('trainer', NULL);
  END IF;

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
      'paid_amount', (
        SELECT te.total_amount
        FROM trainer_earnings te
        WHERE te.assignment_id = tma.id
        LIMIT 1
      )
    ) ORDER BY tma.assigned_at DESC
  ), '[]'::jsonb)
  INTO v_assigned_members
  FROM trainer_member_assignments tma
  JOIN members m ON m.id = tma.member_id
  LEFT JOIN trainer_plans tp ON tp.id = tma.trainer_plan_id
  WHERE tma.trainer_id = v_profile_id
    AND tma.gym_id = p_gym_id
    AND tma.is_active = true;

  SELECT COALESCE(jsonb_agg(activity ORDER BY activity->>'date' DESC), '[]'::jsonb)
  INTO v_activity_log
  FROM (
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
        AND pay.collected_by = v_profile_id
      LIMIT 15
    )
  ) sub;

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

-- ============================================================
-- 6. PAYROLL DASHBOARD RPC
-- ============================================================
CREATE OR REPLACE FUNCTION get_trainer_payroll_dashboard(
  p_gym_id UUID,
  p_month DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_start DATE := DATE_TRUNC('month', p_month)::date;
  v_month_end DATE := (DATE_TRUNC('month', p_month) + INTERVAL '1 month - 1 day')::date;
  v_result JSONB;
BEGIN
  WITH trainer_base AS (
    SELECT
      gt.id AS gym_trainer_id,
      gt.gym_id,
      gt.profile_id AS trainer_id,
      gt.specialization,
      gt.monthly_salary,
      gt.is_active,
      gt.hire_date,
      p.first_name,
      p.last_name,
      g.sunday_off
    FROM gym_trainers gt
    JOIN profiles p ON p.id = gt.profile_id
    JOIN gyms g ON g.id = gt.gym_id
    WHERE gt.gym_id = p_gym_id
  ),
  trainer_metrics AS (
    SELECT
      tb.*,
      COALESCE(att.attended_shifts, 0) AS attended_shifts,
      COALESCE(att.worked_days, 0) AS worked_days,
      ROUND(COALESCE(att.attended_shifts, 0)::numeric / 2.0, 2) AS attendance_days,
      COALESCE(pt.pt_charges, 0)::numeric(12, 2) AS pt_charges,
      COALESCE(assignments.assigned_members, 0) AS assigned_members,
      COALESCE(working_days.working_days, 0) AS working_days
    FROM trainer_base tb
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS attended_shifts,
        COUNT(DISTINCT ta.attendance_date)::int AS worked_days
      FROM trainer_attendance ta
      WHERE ta.gym_id = tb.gym_id
        AND ta.trainer_id = tb.trainer_id
        AND ta.attendance_date BETWEEN v_month_start AND v_month_end
    ) att ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(te.trainer_amount), 0) AS pt_charges
      FROM trainer_earnings te
      WHERE te.gym_id = tb.gym_id
        AND te.trainer_id = tb.trainer_id
        AND te.created_at >= v_month_start::timestamp
        AND te.created_at < (v_month_end + INTERVAL '1 day')
    ) pt ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS assigned_members
      FROM trainer_member_assignments tma
      WHERE tma.gym_id = tb.gym_id
        AND tma.trainer_id = tb.trainer_id
        AND tma.is_active = true
    ) assignments ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS working_days
      FROM generate_series(
        GREATEST(v_month_start, COALESCE(tb.hire_date, v_month_start)),
        v_month_end,
        INTERVAL '1 day'
      ) gs(day_date)
      WHERE NOT (EXTRACT(ISODOW FROM gs.day_date) = 7 AND tb.sunday_off)
    ) working_days ON TRUE
  ),
  final_rows AS (
    SELECT
      gym_trainer_id,
      trainer_id,
      CONCAT_WS(' ', first_name, last_name) AS trainer_name,
      specialization,
      is_active,
      assigned_members,
      monthly_salary,
      worked_days,
      attended_shifts,
      attendance_days,
      working_days,
      GREATEST(working_days - attendance_days, 0) AS absent_days,
      ROUND(
        CASE
          WHEN working_days > 0 AND COALESCE(monthly_salary, 0) > 0
            THEN (monthly_salary::numeric * attendance_days) / working_days
          ELSE 0
        END,
        2
      ) AS salary_earned,
      ROUND(pt_charges, 2) AS pt_charges,
      ROUND(
        CASE
          WHEN working_days > 0 AND COALESCE(monthly_salary, 0) > 0
            THEN (monthly_salary::numeric * attendance_days) / working_days
          ELSE 0
        END + pt_charges,
        2
      ) AS total_payable
    FROM trainer_metrics
  )
  SELECT jsonb_build_object(
    'month', jsonb_build_object(
      'month_start', v_month_start,
      'month_end', v_month_end,
      'label', TO_CHAR(v_month_start, 'Mon YYYY')
    ),
    'summary', jsonb_build_object(
      'trainers', COUNT(*)::int,
      'total_salary_earned', COALESCE(SUM(salary_earned), 0),
      'total_pt_charges', COALESCE(SUM(pt_charges), 0),
      'total_payable', COALESCE(SUM(total_payable), 0)
    ),
    'trainers', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'gym_trainer_id', gym_trainer_id,
          'trainer_id', trainer_id,
          'trainer_name', trainer_name,
          'specialization', specialization,
          'is_active', is_active,
          'assigned_members', assigned_members,
          'monthly_salary', monthly_salary,
          'worked_days', worked_days,
          'attended_shifts', attended_shifts,
          'attendance_days', attendance_days,
          'working_days', working_days,
          'absent_days', absent_days,
          'salary_earned', salary_earned,
          'pt_charges', pt_charges,
          'total_payable', total_payable
        )
        ORDER BY total_payable DESC, trainer_name ASC
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM final_rows;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 7. TRAINER ATTENDANCE DETAIL RPC
-- ============================================================
CREATE OR REPLACE FUNCTION get_trainer_attendance_summary(
  p_gym_id UUID,
  p_trainer_id UUID,
  p_month DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_start DATE := DATE_TRUNC('month', p_month)::date;
  v_month_end DATE := (DATE_TRUNC('month', p_month) + INTERVAL '1 month - 1 day')::date;
  v_result JSONB;
BEGIN
  WITH trainer_base AS (
    SELECT
      gt.id AS gym_trainer_id,
      gt.gym_id,
      gt.profile_id AS trainer_id,
      gt.specialization,
      gt.monthly_salary,
      gt.is_active,
      gt.hire_date,
      p.first_name,
      p.last_name,
      p.trainer_cost,
      g.sunday_off
    FROM gym_trainers gt
    JOIN profiles p ON p.id = gt.profile_id
    JOIN gyms g ON g.id = gt.gym_id
    WHERE gt.gym_id = p_gym_id
      AND gt.id = p_trainer_id
  ),
  metrics AS (
    SELECT
      tb.*,
      COALESCE(att.attended_shifts, 0) AS attended_shifts,
      COALESCE(att.worked_days, 0) AS worked_days,
      ROUND(COALESCE(att.attended_shifts, 0)::numeric / 2.0, 2) AS attendance_days,
      COALESCE(pt.pt_charges, 0)::numeric(12, 2) AS pt_charges,
      COALESCE(working_days.working_days, 0) AS working_days
    FROM trainer_base tb
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS attended_shifts,
        COUNT(DISTINCT ta.attendance_date)::int AS worked_days
      FROM trainer_attendance ta
      WHERE ta.gym_id = tb.gym_id
        AND ta.trainer_id = tb.trainer_id
        AND ta.attendance_date BETWEEN v_month_start AND v_month_end
    ) att ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(te.trainer_amount), 0) AS pt_charges
      FROM trainer_earnings te
      WHERE te.gym_id = tb.gym_id
        AND te.trainer_id = tb.trainer_id
        AND te.created_at >= v_month_start::timestamp
        AND te.created_at < (v_month_end + INTERVAL '1 day')
    ) pt ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS working_days
      FROM generate_series(
        GREATEST(v_month_start, COALESCE(tb.hire_date, v_month_start)),
        v_month_end,
        INTERVAL '1 day'
      ) gs(day_date)
      WHERE NOT (EXTRACT(ISODOW FROM gs.day_date) = 7 AND tb.sunday_off)
    ) working_days ON TRUE
  )
  SELECT jsonb_build_object(
    'trainer', jsonb_build_object(
      'gym_trainer_id', gym_trainer_id,
      'trainer_id', trainer_id,
      'trainer_name', CONCAT_WS(' ', first_name, last_name),
      'specialization', specialization,
      'monthly_salary', monthly_salary,
      'trainer_cost', trainer_cost,
      'is_active', is_active
    ),
    'month', jsonb_build_object(
      'month_start', v_month_start,
      'month_end', v_month_end,
      'label', TO_CHAR(v_month_start, 'Mon YYYY'),
      'working_days', working_days,
      'sunday_off', sunday_off
    ),
    'summary', jsonb_build_object(
      'worked_days', worked_days,
      'attended_shifts', attended_shifts,
      'attendance_days', attendance_days,
      'absent_days', GREATEST(working_days - attendance_days, 0),
      'salary_earned', ROUND(
        CASE
          WHEN working_days > 0 AND COALESCE(monthly_salary, 0) > 0
            THEN (monthly_salary::numeric * attendance_days) / working_days
          ELSE 0
        END,
        2
      ),
      'pt_charges', ROUND(pt_charges, 2),
      'total_payable', ROUND(
        CASE
          WHEN working_days > 0 AND COALESCE(monthly_salary, 0) > 0
            THEN (monthly_salary::numeric * attendance_days) / working_days
          ELSE 0
        END + pt_charges,
        2
      )
    ),
    'attendance', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ta.id,
          'attendance_date', ta.attendance_date,
          'shift_number', ta.shift_number,
          'notes', ta.notes,
          'marked_at', ta.marked_at,
          'marked_by', ta.marked_by
        )
        ORDER BY ta.attendance_date DESC, ta.shift_number ASC
      )
      FROM trainer_attendance ta
      JOIN trainer_base tb ON tb.trainer_id = ta.trainer_id AND tb.gym_id = ta.gym_id
      WHERE ta.gym_id = p_gym_id
        AND ta.trainer_id = tb.trainer_id
        AND ta.attendance_date BETWEEN v_month_start AND v_month_end
    ), '[]'::jsonb),
    'pt_sessions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', te.id,
          'member_id', te.member_id,
          'member_name', m.full_name,
          'session_date', te.created_at::date,
          'amount', te.trainer_amount,
          'notes', te.notes,
          'created_at', te.created_at,
          'plan_name', tp.name
        )
        ORDER BY te.created_at DESC
      )
      FROM trainer_earnings te
      JOIN members m ON m.id = te.member_id
      LEFT JOIN trainer_plans tp ON tp.id = te.trainer_plan_id
      JOIN trainer_base tb ON tb.trainer_id = te.trainer_id AND tb.gym_id = te.gym_id
      WHERE te.gym_id = p_gym_id
        AND te.trainer_id = tb.trainer_id
        AND te.created_at >= v_month_start::timestamp
        AND te.created_at < (v_month_end + INTERVAL '1 day')
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM metrics;

  RETURN COALESCE(v_result, jsonb_build_object(
    'trainer', NULL,
    'month', jsonb_build_object(
      'month_start', v_month_start,
      'month_end', v_month_end,
      'label', TO_CHAR(v_month_start, 'Mon YYYY')
    ),
    'summary', jsonb_build_object(
      'worked_days', 0,
      'attended_shifts', 0,
      'attendance_days', 0,
      'absent_days', 0,
      'salary_earned', 0,
      'pt_charges', 0,
      'total_payable', 0
    ),
    'attendance', '[]'::jsonb,
    'pt_sessions', '[]'::jsonb
  ));
END;
$$;