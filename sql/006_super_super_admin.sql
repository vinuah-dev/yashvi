-- ============================================================
-- STEP 1: Super Super Admin (SSA) Feature Control System
-- ============================================================

-- 1. SSA credentials table (completely separate from profiles)
CREATE TABLE IF NOT EXISTS super_super_admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT 'Super Admin',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- 2. Master list of all feature modules
CREATE TABLE IF NOT EXISTS feature_modules (
  id VARCHAR(50) PRIMARY KEY,          -- e.g. 'shop', 'health_tracker'
  label VARCHAR(100) NOT NULL,         -- e.g. 'Shop & Products'
  description TEXT,
  icon VARCHAR(50),                    -- lucide icon name
  category VARCHAR(50) DEFAULT 'member', -- 'member' | 'admin'
  is_active BOOLEAN DEFAULT true,      -- SSA can globally disable
  sort_order INTEGER DEFAULT 0
);

-- 3. Per-gym feature access (gym = super admin's workspace)
CREATE TABLE IF NOT EXISTS gym_feature_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  module_id VARCHAR(50) NOT NULL REFERENCES feature_modules(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,
  notes TEXT,                          -- SSA can leave a note (e.g. "Disabled: payment pending")
  UNIQUE(gym_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_gym_feature_access_gym ON gym_feature_access(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_feature_access_module ON gym_feature_access(module_id);

-- Enable RLS
ALTER TABLE super_super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_feature_access ENABLE ROW LEVEL SECURITY;

-- Permissive policies (API uses service role key)
CREATE POLICY "Allow all on super_super_admins" ON super_super_admins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on feature_modules" ON feature_modules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on gym_feature_access" ON gym_feature_access FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. Seed: all feature modules
-- ============================================================
INSERT INTO feature_modules (id, label, description, icon, category, sort_order) VALUES
  ('shop',           'Shop & Products',    'Product listings, cart, orders, points redemption', 'ShoppingBag', 'member', 1),
  ('health_tracker', 'Health Tracker',     'Weight, workout, nutrition logs + AI coach',         'Activity',    'member', 2),
  ('leaderboard',    'Leaderboard',        'Member streak and points leaderboard',                'Trophy',      'member', 3),
  ('challenges',     'Challenges',         'Fitness challenges and rewards',                      'Zap',         'member', 4),
  ('diet',           'Diet Plans',         'AI-powered diet plans for members',                   'Apple',       'member', 5),
  ('knowledge',      'Knowledge Base',     'Fitness articles and guides',                         'BookOpen',    'member', 6),
  ('workout',        'Workout Plans',      'Assigned workout plans for members',                  'Dumbbell',    'member', 7),
  ('attendance',     'Attendance',         'Member attendance tracking',                          'CalendarCheck','member',8),
  ('finance',        'Finance & Payments', 'Payment tracking, dues, reports',                     'CreditCard',  'admin',  9),
  ('notifications',  'Push Notifications', 'Firebase push notifications to members',              'Bell',        'admin',  10),
  ('referral',       'Referral System',    'Member referral and bonus points',                    'Users',       'admin',  11)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Seed: SSA default account
-- Password: SuperAdmin@123 (bcrypt hash)
-- CHANGE THIS IMMEDIATELY after first login!
-- ============================================================
INSERT INTO super_super_admins (email, password_hash, name)
VALUES (
  'ssa@shabiya.com',
  '$2b$10$rOzJqFqFqFqFqFqFqFqFquSSA_PLACEHOLDER_CHANGE_THIS',
  'Super Super Admin'
) ON CONFLICT (email) DO NOTHING;
