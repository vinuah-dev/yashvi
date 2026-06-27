-- RPC function to add a member with membership, payment, and credentials in a single transaction
-- This ensures atomicity: either all records are created or none are.

CREATE OR REPLACE FUNCTION add_member_with_membership(
  p_gym_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL,
  p_balance NUMERIC DEFAULT 0,
  p_join_date DATE DEFAULT CURRENT_DATE,
  p_created_by UUID DEFAULT NULL,
  p_created_by_name TEXT DEFAULT NULL,
  p_self_plan_edit_access BOOLEAN DEFAULT FALSE,
  p_profile_image TEXT DEFAULT NULL,
  -- Membership fields
  p_plan_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT NULL,
  p_membership_status TEXT DEFAULT 'active',
  p_custom_price NUMERIC DEFAULT NULL,
  p_due_amount NUMERIC DEFAULT 0,
  -- Payment fields
  p_payment_amount NUMERIC DEFAULT 0,
  p_payment_mode TEXT DEFAULT 'cash',
  p_paid_at TIMESTAMPTZ DEFAULT NOW(),
  p_payment_notes TEXT DEFAULT NULL,
  p_collected_by UUID DEFAULT NULL,
  p_collected_by_name TEXT DEFAULT NULL,
  p_next_payment_date DATE DEFAULT NULL,
  p_remaining_amount NUMERIC DEFAULT NULL,
  -- Credentials fields
  p_login_value TEXT DEFAULT NULL,
  p_default_password TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id UUID;
  v_membership_id UUID;
  v_payment_id UUID;
  v_result JSONB;
  v_collector_gym_id UUID;
  v_collector_name TEXT;
  v_plan_price NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_due_amount NUMERIC := 0;
BEGIN
  -- 1. Check for existing member with same phone in same gym
  PERFORM 1 FROM members WHERE gym_id = p_gym_id AND phone = p_phone;
  IF FOUND THEN
    -- Return the existing member's name in the error for better UX
    DECLARE
      v_existing_name TEXT;
    BEGIN
      SELECT full_name INTO v_existing_name FROM members WHERE gym_id = p_gym_id AND phone = p_phone LIMIT 1;
      RAISE EXCEPTION 'DUPLICATE_PHONE:%', COALESCE(v_existing_name, 'Unknown');
    END;
  END IF;

  -- 2. Insert member
  INSERT INTO members (
    gym_id, full_name, phone, email, balance, join_date,
    created_by, created_by_name, self_plan_edit_access, profile_image
  ) VALUES (
    p_gym_id, p_full_name, p_phone, p_email, p_balance, p_join_date,
    p_created_by, p_created_by_name, p_self_plan_edit_access, p_profile_image
  )
  RETURNING id INTO v_member_id;

  SELECT COALESCE(mp.price, 0)
  INTO v_plan_price
  FROM membership_plans mp
  WHERE mp.id = p_plan_id;

  v_total_amount := COALESCE(p_custom_price, v_plan_price, 0);

  IF p_payment_amount > v_total_amount THEN
    RAISE EXCEPTION 'PAYMENT_EXCEEDS_MEMBERSHIP_TOTAL';
  END IF;

  v_due_amount := GREATEST(0, v_total_amount - COALESCE(p_payment_amount, 0));

  -- 3. Insert membership
  INSERT INTO memberships (
    member_id, gym_id, plan_id, start_date, end_date,
    status, updated_by, due_amount, custom_price, total_amount
  ) VALUES (
    v_member_id, p_gym_id, p_plan_id, p_start_date, p_end_date,
    p_membership_status::membership_status, p_created_by, v_due_amount, p_custom_price, v_total_amount
  )
  RETURNING id INTO v_membership_id;

  -- 4. Insert payment (only if amount > 0)
  IF p_payment_amount > 0 THEN
    IF p_collected_by IS NOT NULL THEN
      SELECT
        pr.gym_id,
        NULLIF(TRIM(COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, '')), '')
      INTO v_collector_gym_id, v_collector_name
      FROM profiles pr
      WHERE pr.id = p_collected_by;

      IF v_collector_gym_id IS NULL OR v_collector_gym_id <> p_gym_id THEN
        RAISE EXCEPTION 'INVALID_COLLECTOR_GYM';
      END IF;
    ELSE
      v_collector_gym_id := NULL;
      v_collector_name := NULL;
    END IF;

    INSERT INTO payments (
      gym_id, member_id, membership_id, amount, payment_mode,
      status, paid_at, notes, updated_by,
      collected_by, collected_by_name,
      next_payment_date, remaining_amount
    ) VALUES (
      p_gym_id, v_member_id, v_membership_id, p_payment_amount, p_payment_mode::payment_mode,
      'paid'::payment_status, p_paid_at, p_payment_notes, p_created_by,
      p_collected_by, COALESCE(v_collector_name, p_collected_by_name),
      p_next_payment_date, p_remaining_amount
    )
    RETURNING id INTO v_payment_id;
  END IF;

  -- 5. Insert member credentials (non-fatal — if this fails, member is still created)
  BEGIN
    IF p_login_value IS NOT NULL AND p_default_password IS NOT NULL THEN
      INSERT INTO member_credentials (
        member_id, login_type, login_value, password, created_by
      ) VALUES (
        v_member_id, 'phone'::login_type, p_login_value, p_default_password, p_created_by
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Credentials creation failed, but we don't rollback the transaction
    RAISE NOTICE 'Credentials creation skipped: %', SQLERRM;
  END;

  -- Build result
  v_result := jsonb_build_object(
    'member_id', v_member_id,
    'membership_id', v_membership_id,
    'payment_id', v_payment_id
  );

  RETURN v_result;
END;
$$;
