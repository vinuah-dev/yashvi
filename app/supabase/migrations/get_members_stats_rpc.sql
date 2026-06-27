-- RPC function to fetch member stats independently from the paginated list
-- This runs separately so stats don't refetch on page changes
CREATE OR REPLACE FUNCTION get_members_stats(
  p_gym_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_is_trainer BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INT;
  v_active INT;
  v_expired INT;
  v_dues INT;
  v_renewal INT;
  v_my_members INT := 0;
BEGIN
  -- Total members in the gym
  SELECT COUNT(*) INTO v_total
  FROM members WHERE gym_id = p_gym_id;

  -- Active: have at least one membership with status='active' AND end_date >= today
  SELECT COUNT(DISTINCT m.id) INTO v_active
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND EXISTS (
      SELECT 1 FROM memberships ms
      WHERE ms.member_id = m.id
        AND ms.status = 'active'
        AND ms.end_date >= CURRENT_DATE
    );

  -- Expired: have at least one membership but none that qualify as active
  SELECT COUNT(DISTINCT m.id) INTO v_expired
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND NOT EXISTS (
      SELECT 1 FROM memberships ms
      WHERE ms.member_id = m.id
        AND ms.status = 'active'
        AND ms.end_date >= CURRENT_DATE
    )
    AND EXISTS (
      SELECT 1 FROM memberships ms WHERE ms.member_id = m.id
    );

  -- Dues: latest membership due computed as total amount minus paid installments
  SELECT COUNT(*) INTO v_dues
  FROM members m
  LEFT JOIN LATERAL (
    SELECT ms.id,
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
    WHERE p.membership_id = lat_ms.id
      AND p.status = 'paid'
  ) lat_paid ON true
  WHERE m.gym_id = p_gym_id
    AND lat_ms.id IS NOT NULL
    AND GREATEST(0, COALESCE(lat_ms.total_amount, 0) - COALESCE(lat_paid.total_paid, 0)) > 0;

  -- Renewal: members whose latest membership end_date is within ±7 days of today
  SELECT COUNT(DISTINCT m.id) INTO v_renewal
  FROM members m
  INNER JOIN LATERAL (
    SELECT ms.end_date
    FROM memberships ms
    WHERE ms.member_id = m.id
    ORDER BY CASE WHEN ms.status = 'active' THEN 0 ELSE 1 END, ms.created_at DESC
    LIMIT 1
  ) lat_ms ON true
  WHERE m.gym_id = p_gym_id
    AND lat_ms.end_date IS NOT NULL
    AND lat_ms.end_date >= (CURRENT_DATE - 7)
    AND lat_ms.end_date <= (CURRENT_DATE + 7);

  -- My members count (for trainer role)
  IF p_is_trainer AND p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_my_members
    FROM trainer_member_assignments tma
    WHERE tma.trainer_id = p_user_id
      AND tma.gym_id = p_gym_id
      AND tma.is_active = true;
  END IF;

  RETURN jsonb_build_object(
    'total', v_total,
    'active', v_active,
    'expired', v_expired,
    'dues', v_dues,
    'renewal', v_renewal,
    'my_members', v_my_members
  );
END;
$$;
