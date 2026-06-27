-- ============================================================
-- REFERRAL + SHOP + POINTS-AS-DISCOUNT SYSTEM
-- ============================================================

-- ─── 1. REFERRAL SYSTEM ─────────────────────────────────────
-- Each member's UUID (members.id) is their referral code.
-- Add referral tracking columns to members table.

ALTER TABLE members ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES members(id);
ALTER TABLE members ADD COLUMN IF NOT EXISTS referral_count INT DEFAULT 0;

-- Referral settings per gym (admin configurable)
CREATE TABLE IF NOT EXISTS referral_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE UNIQUE,
  points_per_referral INT DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE referral_settings DISABLE ROW LEVEL SECURITY;

-- Function: Process a referral (called when new member is added with referral code)
CREATE OR REPLACE FUNCTION process_referral(
  p_gym_id UUID,
  p_new_member_id UUID,
  p_referrer_id UUID,
  p_changed_by UUID DEFAULT NULL,
  p_changed_by_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_points INT;
  v_referrer_name TEXT;
  v_new_member_name TEXT;
BEGIN
  -- Check referrer exists and belongs to same gym
  SELECT full_name INTO v_referrer_name
  FROM members WHERE id = p_referrer_id AND gym_id = p_gym_id;

  IF v_referrer_name IS NULL THEN
    RETURN jsonb_build_object('error', 'Referrer not found in this gym');
  END IF;

  -- Prevent self-referral
  IF p_new_member_id = p_referrer_id THEN
    RETURN jsonb_build_object('error', 'Cannot refer yourself');
  END IF;

  -- Check if already referred
  SELECT full_name INTO v_new_member_name
  FROM members WHERE id = p_new_member_id AND gym_id = p_gym_id;

  -- Get points per referral from settings
  SELECT COALESCE(rs.points_per_referral, 50) INTO v_points
  FROM referral_settings rs WHERE rs.gym_id = p_gym_id;

  IF v_points IS NULL THEN v_points := 50; END IF;

  -- Update new member's referred_by
  UPDATE members SET referred_by = p_referrer_id WHERE id = p_new_member_id;

  -- Increment referrer's referral count
  UPDATE members SET referral_count = COALESCE(referral_count, 0) + 1 WHERE id = p_referrer_id;

  -- Give points to referrer
  UPDATE members SET points = COALESCE(points, 0) + v_points WHERE id = p_referrer_id;

  -- Log in points history
  INSERT INTO points_history (gym_id, member_id, points_change, new_total, reason, changed_by, changed_by_name)
  VALUES (
    p_gym_id,
    p_referrer_id,
    v_points,
    (SELECT points FROM members WHERE id = p_referrer_id),
    'Referral bonus: ' || COALESCE(v_new_member_name, 'New member') || ' joined',
    p_changed_by,
    p_changed_by_name
  );

  RETURN jsonb_build_object(
    'success', true,
    'referrer_name', v_referrer_name,
    'points_awarded', v_points
  );
END;
$$;


-- ─── 2. SHOP SYSTEM ─────────────────────────────────────────

-- Shop items table
CREATE TABLE IF NOT EXISTS shop_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  category TEXT DEFAULT 'general',
  stock INT DEFAULT -1,  -- -1 = unlimited
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_items_gym ON shop_items(gym_id, is_active);
ALTER TABLE shop_items DISABLE ROW LEVEL SECURITY;

-- Shop orders table
CREATE TABLE IF NOT EXISTS shop_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  items JSONB NOT NULL, -- [{item_id, name, price, qty}]
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  points_used INT DEFAULT 0,
  points_discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'completed', -- completed, cancelled
  notes TEXT,
  processed_by UUID,
  processed_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_orders_gym ON shop_orders(gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_orders_member ON shop_orders(member_id, created_at DESC);
ALTER TABLE shop_orders DISABLE ROW LEVEL SECURITY;

-- Points-to-currency conversion setting
-- Add to referral_settings (reuse as gym_reward_settings)
ALTER TABLE referral_settings ADD COLUMN IF NOT EXISTS points_to_currency_ratio NUMERIC(10,4) DEFAULT 1.0;
-- 1 point = 1 rupee by default. Admin can set to 0.5 (1 point = ₹0.50) etc.


-- ─── 3. SHOP FUNCTIONS ──────────────────────────────────────

-- Get all shop items for a gym
CREATE OR REPLACE FUNCTION get_shop_items(p_gym_id UUID, p_active_only BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', si.id,
      'name', si.name,
      'description', si.description,
      'price', si.price,
      'image_url', si.image_url,
      'category', si.category,
      'stock', si.stock,
      'is_active', si.is_active,
      'created_at', si.created_at
    ) ORDER BY si.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM shop_items si
  WHERE si.gym_id = p_gym_id
    AND (NOT p_active_only OR si.is_active = true);

  RETURN v_result;
END;
$$;

-- Process shop order with points discount
CREATE OR REPLACE FUNCTION process_shop_order(
  p_gym_id UUID,
  p_member_id UUID,
  p_items JSONB,        -- [{item_id, qty}]
  p_points_to_use INT DEFAULT 0,
  p_processed_by UUID DEFAULT NULL,
  p_processed_by_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_subtotal NUMERIC(10,2) := 0;
  v_points_discount NUMERIC(10,2) := 0;
  v_total NUMERIC(10,2) := 0;
  v_ratio NUMERIC(10,4) := 1.0;
  v_member_points INT;
  v_actual_points_used INT := 0;
  v_order_items JSONB := '[]'::jsonb;
  v_item RECORD;
  v_order_id UUID;
BEGIN
  -- Get member's current points
  SELECT COALESCE(points, 0) INTO v_member_points FROM members WHERE id = p_member_id AND gym_id = p_gym_id;

  -- Get points-to-currency ratio
  SELECT COALESCE(rs.points_to_currency_ratio, 1.0) INTO v_ratio
  FROM referral_settings rs WHERE rs.gym_id = p_gym_id;

  -- Calculate subtotal from items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, qty INT)
  LOOP
    DECLARE
      v_shop_item RECORD;
    BEGIN
      SELECT * INTO v_shop_item FROM shop_items WHERE id = v_item.item_id AND gym_id = p_gym_id AND is_active = true;

      IF v_shop_item IS NULL THEN
        RETURN jsonb_build_object('error', 'Item not found: ' || v_item.item_id);
      END IF;

      -- Check stock
      IF v_shop_item.stock >= 0 AND v_shop_item.stock < v_item.qty THEN
        RETURN jsonb_build_object('error', 'Not enough stock for: ' || v_shop_item.name);
      END IF;

      v_subtotal := v_subtotal + (v_shop_item.price * v_item.qty);

      -- Build order items array
      v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
        'item_id', v_shop_item.id,
        'name', v_shop_item.name,
        'price', v_shop_item.price,
        'qty', v_item.qty
      ));

      -- Decrease stock if not unlimited
      IF v_shop_item.stock >= 0 THEN
        UPDATE shop_items SET stock = stock - v_item.qty WHERE id = v_item.item_id;
      END IF;
    END;
  END LOOP;

  -- Calculate points discount
  IF p_points_to_use > 0 AND v_member_points > 0 THEN
    v_actual_points_used := LEAST(p_points_to_use, v_member_points);
    v_points_discount := LEAST(v_actual_points_used * v_ratio, v_subtotal); -- Can't discount more than subtotal
    v_actual_points_used := CEIL(v_points_discount / v_ratio); -- Recalculate actual points needed
  END IF;

  v_total := GREATEST(0, v_subtotal - v_points_discount);

  -- Create order
  INSERT INTO shop_orders (gym_id, member_id, items, subtotal, points_used, points_discount, total, notes, processed_by, processed_by_name)
  VALUES (p_gym_id, p_member_id, v_order_items, v_subtotal, v_actual_points_used, v_points_discount, v_total, p_notes, p_processed_by, p_processed_by_name)
  RETURNING id INTO v_order_id;

  -- Deduct points from member
  IF v_actual_points_used > 0 THEN
    UPDATE members SET points = GREATEST(0, COALESCE(points, 0) - v_actual_points_used) WHERE id = p_member_id;

    -- Log points deduction
    INSERT INTO points_history (gym_id, member_id, points_change, new_total, reason, changed_by, changed_by_name)
    VALUES (
      p_gym_id, p_member_id, -v_actual_points_used,
      (SELECT points FROM members WHERE id = p_member_id),
      'Shop purchase (Order #' || LEFT(v_order_id::TEXT, 8) || ')',
      p_processed_by, p_processed_by_name
    );
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'subtotal', v_subtotal,
    'points_used', v_actual_points_used,
    'points_discount', v_points_discount,
    'total', v_total,
    'items', v_order_items
  );
END;
$$;

-- Get member's order history
CREATE OR REPLACE FUNCTION get_member_orders(p_member_id UUID, p_limit INT DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', so.id,
      'items', so.items,
      'subtotal', so.subtotal,
      'points_used', so.points_used,
      'points_discount', so.points_discount,
      'total', so.total,
      'status', so.status,
      'created_at', so.created_at
    ) ORDER BY so.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM shop_orders so
  WHERE so.member_id = p_member_id
  LIMIT p_limit;

  RETURN v_result;
END;
$$;
