-- ============================================================
-- SUPER ADMIN SYSTEM
-- ============================================================
-- superadmin role added to profiles.
-- superadmin can manage other admins (toggle access, add, remove).
-- superadmin has all permissions like owner.
-- Each superadmin is tied to a gym_id.
-- ============================================================

-- No new table needed — superadmin is just a role in profiles table.
-- Make sure the role column allows 'superadmin':
-- (If you have a CHECK constraint on role, update it)

-- Check if there's a constraint and drop it if exists
DO $$
BEGIN
  -- Try to drop existing constraint if any
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- You can set any existing profile to superadmin:
-- UPDATE profiles SET role = 'superadmin' WHERE id = 'YOUR_USER_ID';

-- ============================================================
-- Function: Get all admins for a gym (for superadmin to manage)
-- ============================================================
CREATE OR REPLACE FUNCTION get_gym_admins(p_gym_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'email', p.email,
      'phone', p.phone,
      'role', p.role,
      'permissions', p.permissions,
      'is_active', COALESCE(p.is_active, true),
      'created_at', p.created_at
    ) ORDER BY
      CASE p.role
        WHEN 'superadmin' THEN 0
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'view_only' THEN 3
        ELSE 4
      END,
      p.created_at ASC
  ), '[]'::jsonb)
  INTO v_result
  FROM profiles p
  WHERE p.gym_id = p_gym_id
    AND p.role IN ('superadmin', 'owner', 'admin', 'view_only');

  RETURN v_result;
END;
$$;

-- ============================================================
-- Function: Toggle admin access (activate/deactivate)
-- ============================================================
CREATE OR REPLACE FUNCTION toggle_admin_access(
  p_admin_id UUID,
  p_gym_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET is_active = p_is_active
  WHERE id = p_admin_id
    AND gym_id = p_gym_id
    AND role IN ('admin', 'view_only');  -- Can't deactivate superadmin/owner

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Admin not found or cannot be modified');
  END IF;

  RETURN jsonb_build_object('success', true, 'is_active', p_is_active);
END;
$$;

-- ============================================================
-- Function: Update admin permissions
-- ============================================================
CREATE OR REPLACE FUNCTION update_admin_permissions(
  p_admin_id UUID,
  p_gym_id UUID,
  p_permissions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET permissions = p_permissions
  WHERE id = p_admin_id
    AND gym_id = p_gym_id
    AND role = 'admin';  -- Only admin role has granular permissions

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Admin not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- Add is_active column if not exists
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
