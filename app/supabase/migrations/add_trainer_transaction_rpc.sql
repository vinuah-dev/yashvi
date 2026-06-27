-- RPC function to add a trainer with profile + gym_trainers in a single transaction.
-- If any step fails the entire operation is rolled back automatically.

CREATE OR REPLACE FUNCTION add_trainer_with_gym(
  -- Profile fields
  p_gym_id          UUID,
  p_first_name      TEXT,
  p_last_name       TEXT,
  p_email           TEXT,
  p_phone           TEXT,
  p_password        TEXT,
  -- gym_trainers fields
  p_specialization  TEXT    DEFAULT NULL,
  p_bio             TEXT    DEFAULT NULL,
  p_monthly_salary  INTEGER DEFAULT NULL,
  p_created_by      UUID   DEFAULT NULL,
  -- Schedule fields on profiles
  p_available_days       TEXT[]  DEFAULT NULL,
  p_available_time_slots JSONB   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id     UUID;
  v_gym_trainer_id UUID;
  v_result         JSONB;
BEGIN
  -- 1. Check for duplicate email within the same gym
  PERFORM 1 FROM profiles
    WHERE email = LOWER(p_email) AND gym_id = p_gym_id;
  IF FOUND THEN
    RAISE EXCEPTION 'DUPLICATE_EMAIL:A user with this email already exists in this gym';
  END IF;

  -- 2. Check for duplicate phone within the same gym
  PERFORM 1 FROM profiles
    WHERE phone = p_phone AND gym_id = p_gym_id;
  IF FOUND THEN
    RAISE EXCEPTION 'DUPLICATE_PHONE:A user with this phone number already exists in this gym';
  END IF;

  -- 3. Insert into profiles
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

  -- 4. Insert into gym_trainers (association table)
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

  -- 5. Build result
  v_result := jsonb_build_object(
    'profile_id',     v_profile_id,
    'gym_trainer_id', v_gym_trainer_id
  );

  RETURN v_result;

  -- If anything above throws, the whole transaction is rolled back automatically.
END;
$$;
