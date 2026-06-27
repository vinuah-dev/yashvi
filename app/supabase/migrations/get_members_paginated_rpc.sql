-- RPC function to fetch paginated members with server-side search, status filter, and enrichment
-- Replaces the old get_members_list which fetched ALL members at once
CREATE OR REPLACE FUNCTION get_members_paginated(
  p_gym_id UUID,
  p_search TEXT DEFAULT '',
  p_status TEXT DEFAULT 'all',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20,
  p_user_id UUID DEFAULT NULL,
  p_is_trainer BOOLEAN DEFAULT FALSE,
  p_show_my_members BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_members JSONB;
  v_total_count INT;
  v_offset INT;
  v_search TEXT;
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  v_search := NULLIF(TRIM(COALESCE(p_search, '')), '');

  -- Count total matching members (same filters as data query)
  SELECT COUNT(*) INTO v_total_count
  FROM members m
  LEFT JOIN LATERAL (
    SELECT ms.id AS ms_id, ms.status AS ms_status, ms.end_date
    FROM memberships ms
    WHERE ms.member_id = m.id
    ORDER BY CASE WHEN ms.status = 'active' THEN 0 ELSE 1 END, ms.created_at DESC
    LIMIT 1
  ) lat_ms ON true
  WHERE m.gym_id = p_gym_id
    -- Search filter
    AND (v_search IS NULL OR
         m.full_name ILIKE '%' || v_search || '%' OR
         m.phone ILIKE '%' || v_search || '%' OR
         m.email ILIKE '%' || v_search || '%')
    -- Status filter
    AND (
      p_status IS NULL OR p_status = '' OR p_status = 'all' OR
      (p_status = 'active' AND lat_ms.ms_id IS NOT NULL
        AND lat_ms.ms_status = 'active' AND lat_ms.end_date >= CURRENT_DATE) OR
      (p_status = 'expired' AND lat_ms.ms_id IS NOT NULL
        AND NOT (lat_ms.ms_status = 'active' AND lat_ms.end_date >= CURRENT_DATE)) OR
      (p_status = 'inactive' AND lat_ms.ms_id IS NULL) OR
      (p_status = 'renewal' AND lat_ms.end_date IS NOT NULL
        AND lat_ms.end_date >= (CURRENT_DATE - 7)
        AND lat_ms.end_date <= (CURRENT_DATE + 7))
    )
    -- Trainer's own members filter
    AND (
      NOT p_show_my_members OR NOT p_is_trainer OR p_user_id IS NULL OR
      EXISTS (
        SELECT 1 FROM trainer_member_assignments tma
        WHERE tma.member_id = m.id AND tma.trainer_id = p_user_id
          AND tma.gym_id = p_gym_id AND tma.is_active = true
      )
    );

  -- Fetch paginated members with enriched data
  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_members
  FROM (
    SELECT jsonb_build_object(
      'id', m.id,
      'full_name', m.full_name,
      'profile_image', m.profile_image,
      'phone', m.phone,
      'email', m.email,
      'gym_id', m.gym_id,
      'balance', m.balance,
      'created_at', m.created_at,
      'join_date', m.join_date,
      'computed_status', CASE
        WHEN lat_ms.ms_id IS NOT NULL AND lat_ms.ms_status = 'active'
          AND lat_ms.end_date >= CURRENT_DATE THEN 'active'
        WHEN lat_ms.ms_id IS NOT NULL THEN 'expired'
        ELSE 'inactive'
      END,
      'plan_name', COALESCE(lat_ms.plan_name, 'No Plan'),
      'valid_till', lat_ms.end_date,
      'days_remaining', CASE
        WHEN lat_ms.end_date IS NOT NULL THEN (lat_ms.end_date - CURRENT_DATE)
        ELSE NULL
      END,
      'due_amount', GREATEST(0, COALESCE(lat_ms.total_amount, 0) - COALESCE(lat_paid.total_paid, 0)),
      'has_credentials', EXISTS (
        SELECT 1 FROM member_credentials mc WHERE mc.member_id = m.id
      ),
      'created_by_trainer_name', COALESCE(
        NULLIF(TRIM(COALESCE(m.created_by_name, '')), ''),
        (SELECT NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '')
         FROM profiles p WHERE p.id = m.created_by LIMIT 1)
      ),
      'trainer_assignment', CASE WHEN lat_ta.trainer_name IS NOT NULL THEN
        jsonb_build_object(
          'trainer_name', lat_ta.trainer_name,
          'plan_end_date', lat_ta.plan_end_date,
          'trainer_plan_days_remaining', CASE
            WHEN lat_ta.plan_end_date IS NOT NULL
              THEN (lat_ta.plan_end_date::DATE - CURRENT_DATE)
            ELSE NULL
          END
        )
      ELSE NULL END
    ) AS row_data
    FROM members m
    LEFT JOIN LATERAL (
      SELECT ms.id AS ms_id, ms.status AS ms_status, ms.end_date, ms.start_date,
             mp.name AS plan_name,
             COALESCE(ms.total_amount, ms.custom_price, mp.price, 0) AS total_amount
      FROM memberships ms
      LEFT JOIN membership_plans mp ON mp.id = ms.plan_id
      WHERE ms.member_id = m.id
      ORDER BY CASE WHEN ms.status = 'active' THEN 0 ELSE 1 END, ms.created_at DESC
      LIMIT 1
    ) lat_ms ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(p.amount), 0) AS total_paid
      FROM payments p
      WHERE p.membership_id = lat_ms.ms_id
        AND p.status = 'paid'
    ) lat_paid ON true
    LEFT JOIN LATERAL (
      SELECT tma.plan_end_date,
             NULLIF(TRIM(COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, '')), '') AS trainer_name
      FROM trainer_member_assignments tma
      LEFT JOIN profiles pr ON pr.id = tma.trainer_id
      WHERE tma.member_id = m.id AND tma.is_active = true
      LIMIT 1
    ) lat_ta ON true
    WHERE m.gym_id = p_gym_id
      AND (v_search IS NULL OR
           m.full_name ILIKE '%' || v_search || '%' OR
           m.phone ILIKE '%' || v_search || '%' OR
           m.email ILIKE '%' || v_search || '%')
      AND (
        p_status IS NULL OR p_status = '' OR p_status = 'all' OR
        (p_status = 'active' AND lat_ms.ms_id IS NOT NULL
          AND lat_ms.ms_status = 'active' AND lat_ms.end_date >= CURRENT_DATE) OR
        (p_status = 'expired' AND lat_ms.ms_id IS NOT NULL
          AND NOT (lat_ms.ms_status = 'active' AND lat_ms.end_date >= CURRENT_DATE)) OR
        (p_status = 'inactive' AND lat_ms.ms_id IS NULL) OR
        (p_status = 'renewal' AND lat_ms.end_date IS NOT NULL
          AND lat_ms.end_date >= (CURRENT_DATE - 7)
          AND lat_ms.end_date <= (CURRENT_DATE + 7))
      )
      AND (
        NOT p_show_my_members OR NOT p_is_trainer OR p_user_id IS NULL OR
        EXISTS (
          SELECT 1 FROM trainer_member_assignments tma
          WHERE tma.member_id = m.id AND tma.trainer_id = p_user_id
            AND tma.gym_id = p_gym_id AND tma.is_active = true
        )
      )
    ORDER BY CASE WHEN p_status = 'renewal' THEN lat_ms.end_date END ASC NULLS LAST,
             m.created_at DESC
    LIMIT p_page_size OFFSET v_offset
  ) sub;

  -- Build result
  v_result := jsonb_build_object(
    'members', v_members,
    'total_count', v_total_count,
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', CEIL(v_total_count::NUMERIC / p_page_size)
  );

  RETURN v_result;
END;
$$;
