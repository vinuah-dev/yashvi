-- Add VIEW_ONLY role to profile_role enum and ensure default visibility permissions.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'profile_role'
      AND e.enumlabel = 'view_only'
  ) THEN
    -- already present
    NULL;
  ELSE
    ALTER TYPE profile_role ADD VALUE 'view_only';
  END IF;
END $$;

-- VIEW_ONLY should keep full visibility permissions (read-only enforced in API layer).
UPDATE profiles
SET permissions = COALESCE(
  permissions,
  '{"dashboard": true, "members": true, "attendance": true, "announcements": true, "finance": true, "analytics": true, "monitoring": true, "settings": true, "inquiries": true}'::jsonb
)
WHERE role = 'view_only';
