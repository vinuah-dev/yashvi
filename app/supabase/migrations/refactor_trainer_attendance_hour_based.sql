-- ============================================================
-- REFACTOR TRAINER ATTENDANCE TO HOUR-BASED SESSIONS
-- - Replaces shift-based salary logic with hour-based payroll
-- - Uses trainer weekly schedule to calculate expected hours
-- - Keeps PT charges sourced from trainer_earnings
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'trainer_attendance'
      AND column_name = 'shift_number'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'trainer_attendance'
      AND column_name = 'session_number'
  ) THEN
    ALTER TABLE trainer_attendance
      RENAME COLUMN shift_number TO session_number;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'trainer_attendance'
      AND column_name = 'check_in_time'
  ) THEN
    ALTER TABLE trainer_attendance
      ADD COLUMN check_in_time TIME;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'trainer_attendance'
      AND column_name = 'check_out_time'
  ) THEN
    ALTER TABLE trainer_attendance
      ADD COLUMN check_out_time TIME;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_trainer_attendance_shift'
  ) THEN
    ALTER TABLE trainer_attendance
      DROP CONSTRAINT unique_trainer_attendance_shift;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_trainer_attendance_session'
  ) THEN
    ALTER TABLE trainer_attendance
      ADD CONSTRAINT unique_trainer_attendance_session
      UNIQUE (gym_id, trainer_id, attendance_date, session_number);
  END IF;
END $$;

COMMENT ON TABLE trainer_attendance IS 'Trainer attendance log with up to two work sessions per day';
COMMENT ON COLUMN trainer_attendance.session_number IS 'Session number for the day: 1 = morning session, 2 = evening session';
COMMENT ON COLUMN trainer_attendance.check_in_time IS 'Session check-in time';
COMMENT ON COLUMN trainer_attendance.check_out_time IS 'Session check-out time';

CREATE OR REPLACE FUNCTION get_trainer_expected_minutes_for_date(
  p_available_time_slots JSONB,
  p_work_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_day_name TEXT;
BEGIN
  v_day_name := CASE EXTRACT(ISODOW FROM p_work_date)
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
    ELSE 'Sunday'
  END;

  RETURN COALESCE(
    jsonb_array_length(COALESCE(p_available_time_slots -> v_day_name, '[]'::jsonb)),
    0
  ) * 60;
END;
$$;

CREATE OR REPLACE FUNCTION get_trainer_session_worked_minutes(
  p_check_in_time TIME,
  p_check_out_time TIME
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_check_in_time IS NULL AND p_check_out_time IS NULL THEN
    RETURN 60;
  END IF;

  IF p_check_in_time IS NULL OR p_check_out_time IS NULL OR p_check_out_time <= p_check_in_time THEN
    RETURN 0;
  END IF;

  RETURN FLOOR(EXTRACT(EPOCH FROM (p_check_out_time - p_check_in_time)) / 60)::INTEGER;
END;
$$;

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
      p.available_time_slots
    FROM gym_trainers gt
    JOIN profiles p ON p.id = gt.profile_id
    WHERE gt.gym_id = p_gym_id
  ),
  scheduled_days AS (
    SELECT
      tb.gym_trainer_id,
      tb.gym_id,
      tb.trainer_id,
      tb.specialization,
      tb.monthly_salary,
      tb.is_active,
      tb.hire_date,
      tb.first_name,
      tb.last_name,
      gs.work_date,
      get_trainer_expected_minutes_for_date(tb.available_time_slots, gs.work_date) AS expected_minutes
    FROM trainer_base tb
    CROSS JOIN LATERAL (
      SELECT generate_series(
        GREATEST(v_month_start, COALESCE(tb.hire_date, v_month_start)),
        v_month_end,
        INTERVAL '1 day'
      )::date AS work_date
    ) gs
  ),
  expected_schedule AS (
    SELECT
      gym_trainer_id,
      gym_id,
      trainer_id,
      specialization,
      monthly_salary,
      is_active,
      hire_date,
      first_name,
      last_name,
      COUNT(*) FILTER (WHERE expected_minutes > 0)::int AS working_days,
      COALESCE(SUM(expected_minutes), 0)::int AS expected_minutes_total
    FROM scheduled_days
    GROUP BY gym_trainer_id, gym_id, trainer_id, specialization, monthly_salary, is_active, hire_date, first_name, last_name
  ),
  worked_time AS (
    SELECT
      tb.gym_trainer_id,
      tb.trainer_id,
      COUNT(DISTINCT ta.attendance_date) FILTER (
        WHERE get_trainer_session_worked_minutes(ta.check_in_time, ta.check_out_time) > 0
      )::int AS worked_days,
      COALESCE(SUM(get_trainer_session_worked_minutes(ta.check_in_time, ta.check_out_time)), 0)::int AS worked_minutes_total
    FROM trainer_base tb
    LEFT JOIN trainer_attendance ta
      ON ta.gym_id = tb.gym_id
     AND ta.trainer_id = tb.trainer_id
     AND ta.attendance_date BETWEEN v_month_start AND v_month_end
    GROUP BY tb.gym_trainer_id, tb.trainer_id
  ),
  trainer_metrics AS (
    SELECT
      es.*,
      COALESCE(wt.worked_days, 0) AS worked_days,
      COALESCE(wt.worked_minutes_total, 0) AS worked_minutes_total,
      COALESCE(pt.pt_charges, 0)::numeric(12, 2) AS pt_charges,
      COALESCE(assignments.assigned_members, 0) AS assigned_members
    FROM expected_schedule es
    LEFT JOIN worked_time wt
      ON wt.gym_trainer_id = es.gym_trainer_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(te.trainer_amount), 0) AS pt_charges
      FROM trainer_earnings te
      WHERE te.gym_id = es.gym_id
        AND te.trainer_id = es.trainer_id
        AND te.created_at >= v_month_start::timestamp
        AND te.created_at < (v_month_end + INTERVAL '1 day')
    ) pt ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS assigned_members
      FROM trainer_member_assignments tma
      WHERE tma.gym_id = es.gym_id
        AND tma.trainer_id = es.trainer_id
        AND tma.is_active = true
    ) assignments ON TRUE
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
      working_days,
      worked_days,
      expected_minutes_total,
      worked_minutes_total,
      ROUND(expected_minutes_total::numeric / 60.0, 2) AS expected_hours,
      ROUND(worked_minutes_total::numeric / 60.0, 2) AS worked_hours,
      ROUND(
        CASE
          WHEN expected_minutes_total > 0 AND COALESCE(monthly_salary, 0) > 0
            THEN monthly_salary::numeric / (expected_minutes_total::numeric / 60.0)
          ELSE 0
        END,
        2
      ) AS hourly_salary,
      ROUND(
        CASE
          WHEN expected_minutes_total > 0 AND COALESCE(monthly_salary, 0) > 0
            THEN monthly_salary::numeric * worked_minutes_total::numeric / expected_minutes_total::numeric
          ELSE 0
        END,
        2
      ) AS salary_earned,
      ROUND(pt_charges, 2) AS pt_charges,
      ROUND(
        CASE
          WHEN expected_minutes_total > 0 AND COALESCE(monthly_salary, 0) > 0
            THEN monthly_salary::numeric * worked_minutes_total::numeric / expected_minutes_total::numeric
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
      'total_expected_hours', COALESCE(SUM(expected_hours), 0),
      'total_worked_hours', COALESCE(SUM(worked_hours), 0),
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
          'working_days', working_days,
          'worked_days', worked_days,
          'expected_hours', expected_hours,
          'worked_hours', worked_hours,
          'hourly_salary', hourly_salary,
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
      p.available_time_slots
    FROM gym_trainers gt
    JOIN profiles p ON p.id = gt.profile_id
    WHERE gt.gym_id = p_gym_id
      AND gt.id = p_trainer_id
  ),
  calendar_days AS (
    SELECT
      tb.gym_trainer_id,
      tb.gym_id,
      tb.trainer_id,
      tb.specialization,
      tb.monthly_salary,
      tb.is_active,
      tb.hire_date,
      tb.first_name,
      tb.last_name,
      tb.trainer_cost,
      gs.work_date,
      CASE EXTRACT(ISODOW FROM gs.work_date)
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
        ELSE 'Sunday'
      END AS weekday_name,
      COALESCE(tb.available_time_slots -> (
        CASE EXTRACT(ISODOW FROM gs.work_date)
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
          ELSE 'Sunday'
        END
      ), '[]'::jsonb) AS expected_slots,
      get_trainer_expected_minutes_for_date(tb.available_time_slots, gs.work_date) AS expected_minutes
    FROM trainer_base tb
    CROSS JOIN LATERAL (
      SELECT generate_series(
        GREATEST(v_month_start, COALESCE(tb.hire_date, v_month_start)),
        v_month_end,
        INTERVAL '1 day'
      )::date AS work_date
    ) gs
  ),
  session_rows AS (
    SELECT
      ta.id,
      ta.gym_id,
      ta.trainer_id,
      ta.attendance_date,
      ta.session_number,
      ta.check_in_time,
      ta.check_out_time,
      ta.notes,
      ta.marked_at,
      ta.marked_by,
      get_trainer_session_worked_minutes(ta.check_in_time, ta.check_out_time) AS worked_minutes
    FROM trainer_attendance ta
    JOIN trainer_base tb
      ON tb.gym_id = ta.gym_id
     AND tb.trainer_id = ta.trainer_id
    WHERE ta.attendance_date BETWEEN v_month_start AND v_month_end
  ),
  daily_attendance AS (
    SELECT
      cd.work_date AS attendance_date,
      cd.weekday_name,
      cd.expected_slots,
      cd.expected_minutes,
      COALESCE(SUM(sr.worked_minutes), 0)::int AS worked_minutes,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', sr.id,
            'session_number', sr.session_number,
            'check_in_time', TO_CHAR(sr.check_in_time, 'HH24:MI'),
            'check_out_time', TO_CHAR(sr.check_out_time, 'HH24:MI'),
            'notes', sr.notes,
            'marked_at', sr.marked_at,
            'marked_by', sr.marked_by,
            'worked_minutes', sr.worked_minutes
          )
          ORDER BY sr.session_number ASC
        ) FILTER (WHERE sr.id IS NOT NULL),
        '[]'::jsonb
      ) AS sessions
    FROM calendar_days cd
    LEFT JOIN session_rows sr
      ON sr.attendance_date = cd.work_date
    GROUP BY cd.work_date, cd.weekday_name, cd.expected_slots, cd.expected_minutes
  ),
  metrics AS (
    SELECT
      tb.gym_trainer_id,
      tb.trainer_id,
      CONCAT_WS(' ', tb.first_name, tb.last_name) AS trainer_name,
      tb.specialization,
      tb.monthly_salary,
      tb.trainer_cost,
      tb.is_active,
      COUNT(*) FILTER (WHERE da.expected_minutes > 0)::int AS working_days,
      COUNT(*) FILTER (WHERE da.worked_minutes > 0)::int AS worked_days,
      COALESCE(SUM(da.expected_minutes), 0)::int AS expected_minutes_total,
      COALESCE(SUM(da.worked_minutes), 0)::int AS worked_minutes_total,
      COALESCE(pt.pt_charges, 0)::numeric(12, 2) AS pt_charges
    FROM trainer_base tb
    JOIN daily_attendance da ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(te.trainer_amount), 0) AS pt_charges
      FROM trainer_earnings te
      WHERE te.gym_id = tb.gym_id
        AND te.trainer_id = tb.trainer_id
        AND te.created_at >= v_month_start::timestamp
        AND te.created_at < (v_month_end + INTERVAL '1 day')
    ) pt ON TRUE
    GROUP BY tb.gym_trainer_id, tb.trainer_id, tb.first_name, tb.last_name, tb.specialization, tb.monthly_salary, tb.trainer_cost, tb.is_active, pt.pt_charges
  )
  SELECT jsonb_build_object(
    'trainer', jsonb_build_object(
      'gym_trainer_id', metrics.gym_trainer_id,
      'trainer_id', metrics.trainer_id,
      'trainer_name', metrics.trainer_name,
      'specialization', metrics.specialization,
      'monthly_salary', metrics.monthly_salary,
      'trainer_cost', metrics.trainer_cost,
      'is_active', metrics.is_active
    ),
    'month', jsonb_build_object(
      'month_start', v_month_start,
      'month_end', v_month_end,
      'label', TO_CHAR(v_month_start, 'Mon YYYY'),
      'working_days', metrics.working_days,
      'expected_hours', ROUND(metrics.expected_minutes_total::numeric / 60.0, 2)
    ),
    'summary', jsonb_build_object(
      'working_days', metrics.working_days,
      'worked_days', metrics.worked_days,
      'expected_hours', ROUND(metrics.expected_minutes_total::numeric / 60.0, 2),
      'worked_hours', ROUND(metrics.worked_minutes_total::numeric / 60.0, 2),
      'hourly_salary', ROUND(
        CASE
          WHEN metrics.expected_minutes_total > 0 AND COALESCE(metrics.monthly_salary, 0) > 0
            THEN metrics.monthly_salary::numeric / (metrics.expected_minutes_total::numeric / 60.0)
          ELSE 0
        END,
        2
      ),
      'salary_earned', ROUND(
        CASE
          WHEN metrics.expected_minutes_total > 0 AND COALESCE(metrics.monthly_salary, 0) > 0
            THEN metrics.monthly_salary::numeric * metrics.worked_minutes_total::numeric / metrics.expected_minutes_total::numeric
          ELSE 0
        END,
        2
      ),
      'pt_charges', ROUND(metrics.pt_charges, 2),
      'total_payable', ROUND(
        CASE
          WHEN metrics.expected_minutes_total > 0 AND COALESCE(metrics.monthly_salary, 0) > 0
            THEN metrics.monthly_salary::numeric * metrics.worked_minutes_total::numeric / metrics.expected_minutes_total::numeric
          ELSE 0
        END + metrics.pt_charges,
        2
      )
    ),
    'attendance_days', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'attendance_date', da.attendance_date,
          'weekday_name', da.weekday_name,
          'expected_slots', da.expected_slots,
          'expected_minutes', da.expected_minutes,
          'expected_hours', ROUND(da.expected_minutes::numeric / 60.0, 2),
          'worked_minutes', da.worked_minutes,
          'worked_hours', ROUND(da.worked_minutes::numeric / 60.0, 2),
          'daily_salary', ROUND(
            CASE
              WHEN metrics.expected_minutes_total > 0 AND COALESCE(metrics.monthly_salary, 0) > 0
                THEN metrics.monthly_salary::numeric * da.worked_minutes::numeric / metrics.expected_minutes_total::numeric
              ELSE 0
            END,
            2
          ),
          'sessions', da.sessions
        )
        ORDER BY da.attendance_date DESC
      )
      FROM daily_attendance da
      WHERE da.expected_minutes > 0 OR jsonb_array_length(da.sessions) > 0
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
      'label', TO_CHAR(v_month_start, 'Mon YYYY'),
      'working_days', 0,
      'expected_hours', 0
    ),
    'summary', jsonb_build_object(
      'working_days', 0,
      'worked_days', 0,
      'expected_hours', 0,
      'worked_hours', 0,
      'hourly_salary', 0,
      'salary_earned', 0,
      'pt_charges', 0,
      'total_payable', 0
    ),
    'attendance_days', '[]'::jsonb,
    'pt_sessions', '[]'::jsonb
  ));
END;
$$;