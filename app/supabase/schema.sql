-- ============================================================
-- SHABIYA GYM MANAGEMENT - COMPLETE DATABASE SCHEMA
-- Supabase (PostgreSQL) - Serverless Backend
-- Generated: December 24, 2025
-- ============================================================

-- ============================================================
-- SECTION 1: CLEANUP (Drop existing objects if they exist)
-- ============================================================
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS member_diets CASCADE;
DROP TABLE IF EXISTS member_workouts CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS diet_plans CASCADE;
DROP TABLE IF EXISTS workout_plans CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS memberships CASCADE;
DROP TABLE IF EXISTS membership_plans CASCADE;
DROP TABLE IF EXISTS member_credentials CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS gyms CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop enum types
DROP TYPE IF EXISTS profile_role CASCADE;
DROP TYPE IF EXISTS membership_status CASCADE;
DROP TYPE IF EXISTS payment_mode CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS login_type CASCADE;
DROP TYPE IF EXISTS announcement_status CASCADE;

-- ============================================================
-- SECTION 2: CREATE ENUM TYPES
-- ============================================================

-- Profile roles for different user types
CREATE TYPE profile_role AS ENUM ('owner', 'admin', 'trainer', 'member', 'view_only');

-- Membership status tracking
CREATE TYPE membership_status AS ENUM ('active', 'expired', 'cancelled');

-- Payment methods accepted
CREATE TYPE payment_mode AS ENUM ('cash', 'upi', 'card', 'bank');

-- Payment completion status
CREATE TYPE payment_status AS ENUM ('paid', 'pending');

-- Login authentication type
CREATE TYPE login_type AS ENUM ('email', 'phone');

-- Announcement visibility status
CREATE TYPE announcement_status AS ENUM ('active', 'inactive');

-- ============================================================
-- SECTION 3: CREATE TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 3.1 PROFILES TABLE
-- Stores all user profiles (owners, admins, trainers, members)
-- Links to Supabase Auth via id
-- ------------------------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    password TEXT,
    role profile_role NOT NULL DEFAULT 'member',
    permissions JSONB DEFAULT '{"dashboard": true, "members": true, "attendance": true, "announcements": true, "finance": true, "analytics": true, "monitoring": true, "settings": true}'::jsonb,
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'User profiles for all roles - owner, admin, trainer, member, view_only';
COMMENT ON COLUMN profiles.email IS 'Email for admin/owner/trainer login';
COMMENT ON COLUMN profiles.password IS 'Password for admin/owner/trainer login (hash in production)';
COMMENT ON COLUMN profiles.permissions IS 'Feature permissions for admin role: {dashboard, members, attendance, announcements, finance, analytics, monitoring, settings}';
COMMENT ON COLUMN profiles.gym_id IS 'Gym assignment for admin/trainer roles';

-- ------------------------------------------------------------
-- 3.2 GYMS TABLE
-- Stores gym information with owner reference
-- ------------------------------------------------------------
CREATE TABLE gyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE gyms IS 'Gym/fitness center information';

-- ------------------------------------------------------------
-- 3.3 MEMBERS TABLE
-- Gym members with balance tracking for partial payments
-- ------------------------------------------------------------
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    profile_image TEXT,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    join_date DATE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE members IS 'Gym members with balance tracking';
COMMENT ON COLUMN members.balance IS 'Outstanding balance - positive means member owes money';

-- ------------------------------------------------------------
-- 3.4 MEMBER_CREDENTIALS TABLE
-- Login credentials for member app access
-- ------------------------------------------------------------
CREATE TABLE member_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    login_type login_type NOT NULL DEFAULT 'phone',
    login_value VARCHAR(255) NOT NULL,
    password TEXT NOT NULL,
    fcm_token TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE member_credentials IS 'Login credentials for member mobile app';
COMMENT ON COLUMN member_credentials.fcm_token IS 'Firebase Cloud Messaging token for push notifications';

-- ------------------------------------------------------------
-- 3.5 MEMBERSHIP_PLANS TABLE
-- Available membership plans for each gym
-- ------------------------------------------------------------
CREATE TABLE membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE membership_plans IS 'Available membership plans with pricing';

-- ------------------------------------------------------------
-- 3.6 MEMBERSHIPS TABLE
-- Member subscriptions to plans
-- ------------------------------------------------------------
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    custom_price DECIMAL(10, 2),
    due_amount DECIMAL(10, 2) DEFAULT 0,
    status membership_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Ensure end_date is after start_date
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

COMMENT ON TABLE memberships IS 'Member subscriptions to membership plans';

-- ------------------------------------------------------------
-- 3.7 ATTENDANCE TABLE
-- Daily check-in/check-out records
-- ------------------------------------------------------------
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIME NOT NULL DEFAULT CURRENT_TIME,
    check_out_time TIME,
    count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Prevent duplicate attendance per member per day
    CONSTRAINT unique_daily_attendance UNIQUE (member_id, check_in_date)
);

COMMENT ON TABLE attendance IS 'Daily attendance tracking for members';
COMMENT ON COLUMN attendance.count IS 'Number of times checked in on this day (for multi-session tracking)';

-- ------------------------------------------------------------
-- 3.8 PAYMENTS TABLE
-- Payment records with partial payment support
-- ------------------------------------------------------------
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_mode payment_mode NOT NULL DEFAULT 'cash',
    status payment_status NOT NULL DEFAULT 'paid',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE payments IS 'Payment transactions with partial payment support';

-- ------------------------------------------------------------
-- 3.9 WORKOUT_PLANS TABLE
-- Workout plans created by trainers
-- ------------------------------------------------------------
CREATE TABLE workout_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE workout_plans IS 'Workout plans created by trainers';

-- ------------------------------------------------------------
-- 3.10 MEMBER_WORKOUTS TABLE
-- Assigns workout plans to members
-- ------------------------------------------------------------
CREATE TABLE member_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    workout_plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Prevent duplicate assignments
    CONSTRAINT unique_member_workout UNIQUE (member_id, workout_plan_id)
);

COMMENT ON TABLE member_workouts IS 'Links members to their assigned workout plans';

-- ------------------------------------------------------------
-- 3.11 DIET_PLANS TABLE
-- Diet plans created by trainers
-- ------------------------------------------------------------
CREATE TABLE diet_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE diet_plans IS 'Diet plans created by trainers';

-- ------------------------------------------------------------
-- 3.12 MEMBER_DIETS TABLE
-- Assigns diet plans to members
-- ------------------------------------------------------------
CREATE TABLE member_diets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    diet_plan_id UUID NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Prevent duplicate assignments
    CONSTRAINT unique_member_diet UNIQUE (member_id, diet_plan_id)
);

COMMENT ON TABLE member_diets IS 'Links members to their assigned diet plans';

-- ------------------------------------------------------------
-- 3.13 ANNOUNCEMENTS TABLE
-- Gym announcements and notifications
-- ------------------------------------------------------------
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status announcement_status NOT NULL DEFAULT 'active',
    announced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE announcements IS 'Gym announcements and notifications to members';

-- ============================================================
-- SECTION 4: CREATE INDEXES
-- ============================================================

-- Gyms indexes
CREATE INDEX idx_gyms_owner_id ON gyms(owner_id);

-- Members indexes
CREATE INDEX idx_members_gym_id ON members(gym_id);
CREATE INDEX idx_members_phone ON members(phone);
CREATE INDEX idx_members_email ON members(email);

-- Member credentials indexes
CREATE INDEX idx_member_credentials_login_value ON member_credentials(login_value);

-- Membership plans indexes
CREATE INDEX idx_membership_plans_gym_id ON membership_plans(gym_id);
CREATE INDEX idx_membership_plans_is_active ON membership_plans(is_active);

-- Memberships indexes
CREATE INDEX idx_memberships_member_id ON memberships(member_id);
CREATE INDEX idx_memberships_gym_id ON memberships(gym_id);
CREATE INDEX idx_memberships_plan_id ON memberships(plan_id);
CREATE INDEX idx_memberships_status ON memberships(status);
CREATE INDEX idx_memberships_end_date ON memberships(end_date);

-- Attendance indexes
CREATE INDEX idx_attendance_gym_id ON attendance(gym_id);
CREATE INDEX idx_attendance_member_id ON attendance(member_id);
CREATE INDEX idx_attendance_check_in_date ON attendance(check_in_date);

-- Payments indexes
CREATE INDEX idx_payments_gym_id ON payments(gym_id);
CREATE INDEX idx_payments_member_id ON payments(member_id);
CREATE INDEX idx_payments_membership_id ON payments(membership_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Workout plans indexes
CREATE INDEX idx_workout_plans_gym_id ON workout_plans(gym_id);
CREATE INDEX idx_workout_plans_trainer_id ON workout_plans(trainer_id);

-- Member workouts indexes
CREATE INDEX idx_member_workouts_member_id ON member_workouts(member_id);
CREATE INDEX idx_member_workouts_workout_plan_id ON member_workouts(workout_plan_id);

-- Diet plans indexes
CREATE INDEX idx_diet_plans_gym_id ON diet_plans(gym_id);
CREATE INDEX idx_diet_plans_trainer_id ON diet_plans(trainer_id);

-- Member diets indexes
CREATE INDEX idx_member_diets_member_id ON member_diets(member_id);
CREATE INDEX idx_member_diets_diet_plan_id ON member_diets(diet_plan_id);

-- Announcements indexes
CREATE INDEX idx_announcements_gym_id ON announcements(gym_id);
CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_expires_at ON announcements(expires_at);

-- ============================================================
-- SECTION 5: CREATE TRIGGER FUNCTIONS
-- ============================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gyms_updated_at
    BEFORE UPDATE ON gyms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_members_updated_at
    BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_member_credentials_updated_at
    BEFORE UPDATE ON member_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_membership_plans_updated_at
    BEFORE UPDATE ON membership_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memberships_updated_at
    BEFORE UPDATE ON memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_plans_updated_at
    BEFORE UPDATE ON workout_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_diet_plans_updated_at
    BEFORE UPDATE ON diet_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SECTION 6: SEED DUMMY DATA
-- ============================================================

-- We'll use DO block to create variables for UUIDs
DO $$
DECLARE
    -- Profile IDs
    owner_id UUID := gen_random_uuid();
    admin_id UUID := gen_random_uuid();
    trainer_id UUID := gen_random_uuid();
    
    -- Gym ID
    gym_id UUID := gen_random_uuid();
    
    -- Member IDs
    member1_id UUID := gen_random_uuid();
    member2_id UUID := gen_random_uuid();
    member3_id UUID := gen_random_uuid();
    
    -- Membership Plan IDs
    plan_monthly_id UUID := gen_random_uuid();
    plan_quarterly_id UUID := gen_random_uuid();
    
    -- Membership IDs
    membership1_id UUID := gen_random_uuid();
    
    -- Workout & Diet Plan IDs
    workout_plan_id UUID := gen_random_uuid();
    diet_plan_id UUID := gen_random_uuid();
    
BEGIN
    -- --------------------------------------------------------
    -- 6.1 INSERT PROFILES (Owner, Admin, Trainer)
    -- --------------------------------------------------------
    INSERT INTO profiles (id, first_name, last_name, phone, role, created_at)
    VALUES
        (owner_id, 'Rahul', 'Sharma', '+91-9876543210', 'owner', now()),
        (admin_id, 'Priya', 'Patel', '+91-9876543211', 'admin', now()),
        (trainer_id, 'Vikram', 'Singh', '+91-9876543212', 'trainer', now());
    
    -- --------------------------------------------------------
    -- 6.2 INSERT GYM
    -- --------------------------------------------------------
    INSERT INTO gyms (id, name, address, timezone, owner_id, updated_by)
    VALUES (
        gym_id,
        'Shabiya Fitness Center',
        '123 Fitness Street, Koramangala, Bangalore - 560034',
        'Asia/Kolkata',
        owner_id,
        owner_id
    );
    
    -- --------------------------------------------------------
    -- 6.3 INSERT MEMBERS
    -- --------------------------------------------------------
    INSERT INTO members (id, gym_id, full_name, phone, email, profile_image, balance, created_by, updated_by)
    VALUES
        -- Member 1: Has partial payment (owes 2000)
        (member1_id, gym_id, 'Arjun Kumar', '+91-9988776655', 'arjun.kumar@email.com', NULL, 2000.00, admin_id, admin_id),
        -- Member 2: Fully paid
        (member2_id, gym_id, 'Sneha Reddy', '+91-9988776656', 'sneha.reddy@email.com', NULL, 0.00, admin_id, admin_id),
        -- Member 3: New member
        (member3_id, gym_id, 'Karthik Nair', '+91-9988776657', 'karthik.nair@email.com', NULL, 0.00, admin_id, admin_id);
    
    -- --------------------------------------------------------
    -- 6.4 INSERT MEMBER CREDENTIALS
    -- --------------------------------------------------------
    INSERT INTO member_credentials (member_id, login_type, login_value, password, fcm_token, created_by)
    VALUES
        (member1_id, 'phone', '+91-9988776655', '$2b$10$examplehashedpassword1', NULL, admin_id),
        (member2_id, 'email', 'sneha.reddy@email.com', '$2b$10$examplehashedpassword2', NULL, admin_id),
        (member3_id, 'phone', '+91-9988776657', '$2b$10$examplehashedpassword3', NULL, admin_id);
    
    -- --------------------------------------------------------
    -- 6.5 INSERT MEMBERSHIP PLANS
    -- --------------------------------------------------------
    INSERT INTO membership_plans (id, gym_id, name, duration_days, price, is_active, updated_by)
    VALUES
        (plan_monthly_id, gym_id, 'Monthly Basic', 30, 2500.00, true, owner_id),
        (plan_quarterly_id, gym_id, 'Quarterly Premium', 90, 10000.00, true, owner_id);
    
    -- --------------------------------------------------------
    -- 6.6 INSERT MEMBERSHIPS
    -- --------------------------------------------------------
    INSERT INTO memberships (id, member_id, gym_id, plan_id, start_date, end_date, status, updated_by)
    VALUES
        -- Member 1: Active quarterly membership (partial payment example)
        (membership1_id, member1_id, gym_id, plan_quarterly_id, '2024-12-01', '2025-03-01', 'active', admin_id),
        -- Member 2: Active monthly membership
        (gen_random_uuid(), member2_id, gym_id, plan_monthly_id, '2024-12-15', '2025-01-14', 'active', admin_id),
        -- Member 3: Expired membership
        (gen_random_uuid(), member3_id, gym_id, plan_monthly_id, '2024-11-01', '2024-12-01', 'expired', admin_id);
    
    -- --------------------------------------------------------
    -- 6.7 INSERT PAYMENTS
    -- Partial payment example: Plan = 10000, Paid = 8000, Balance = 2000
    -- --------------------------------------------------------
    INSERT INTO payments (gym_id, member_id, membership_id, amount, payment_mode, status, paid_at, updated_by)
    VALUES
        -- Member 1: Partial payment (8000 out of 10000)
        (gym_id, member1_id, membership1_id, 5000.00, 'upi', 'paid', '2024-12-01 10:30:00+05:30', admin_id),
        (gym_id, member1_id, membership1_id, 3000.00, 'cash', 'paid', '2024-12-10 11:00:00+05:30', admin_id),
        -- Pending payment for remaining balance
        (gym_id, member1_id, membership1_id, 2000.00, 'upi', 'pending', NULL, admin_id),
        -- Member 2: Full payment
        (gym_id, member2_id, NULL, 2500.00, 'card', 'paid', '2024-12-15 09:00:00+05:30', admin_id);
    
    -- --------------------------------------------------------
    -- 6.8 INSERT ATTENDANCE RECORDS
    -- --------------------------------------------------------
    INSERT INTO attendance (gym_id, member_id, check_in_date, check_in_time, check_out_time, count)
    VALUES
        -- Member 1: Today's attendance
        (gym_id, member1_id, CURRENT_DATE, '06:30:00', '08:00:00', 1),
        -- Member 2: Yesterday's attendance
        (gym_id, member2_id, CURRENT_DATE - INTERVAL '1 day', '07:00:00', '08:30:00', 1);
    
    -- --------------------------------------------------------
    -- 6.9 INSERT WORKOUT PLANS
    -- --------------------------------------------------------
    INSERT INTO workout_plans (id, gym_id, trainer_id, title, updated_by)
    VALUES (
        workout_plan_id,
        gym_id,
        trainer_id,
        'Beginner Strength Training - 4 Week Program',
        trainer_id
    );
    
    -- --------------------------------------------------------
    -- 6.10 INSERT MEMBER WORKOUTS (Assign workout to members)
    -- --------------------------------------------------------
    INSERT INTO member_workouts (member_id, workout_plan_id)
    VALUES
        (member1_id, workout_plan_id),
        (member2_id, workout_plan_id);
    
    -- --------------------------------------------------------
    -- 6.11 INSERT DIET PLANS
    -- --------------------------------------------------------
    INSERT INTO diet_plans (id, gym_id, trainer_id, title, updated_by)
    VALUES (
        diet_plan_id,
        gym_id,
        trainer_id,
        'High Protein Weight Loss Diet',
        trainer_id
    );
    
    -- --------------------------------------------------------
    -- 6.12 INSERT MEMBER DIETS (Assign diet to members)
    -- --------------------------------------------------------
    INSERT INTO member_diets (member_id, diet_plan_id)
    VALUES
        (member1_id, diet_plan_id);
    
    -- --------------------------------------------------------
    -- 6.13 INSERT ANNOUNCEMENTS
    -- --------------------------------------------------------
    INSERT INTO announcements (gym_id, title, message, status, announced_at, expires_at, created_by, updated_by)
    VALUES
        -- Active announcement
        (
            gym_id,
            'New Year Fitness Challenge 2025!',
            'Join our 30-day New Year fitness challenge starting January 1st. Win exciting prizes and transform your health! Register at the front desk.',
            'active',
            now(),
            '2025-01-31 23:59:59+05:30',
            owner_id,
            owner_id
        ),
        -- Expired announcement
        (
            gym_id,
            'Gym Closed for Diwali',
            'The gym will remain closed on November 1st for Diwali celebrations. Wishing all our members a happy and healthy Diwali!',
            'inactive',
            '2024-10-28 00:00:00+05:30',
            '2024-11-02 00:00:00+05:30',
            owner_id,
            owner_id
        );
    
    RAISE NOTICE 'Seed data inserted successfully!';
    RAISE NOTICE 'Owner ID: %', owner_id;
    RAISE NOTICE 'Admin ID: %', admin_id;
    RAISE NOTICE 'Trainer ID: %', trainer_id;
    RAISE NOTICE 'Gym ID: %', gym_id;
    RAISE NOTICE 'Member 1 ID (with balance): %', member1_id;
    RAISE NOTICE 'Member 2 ID: %', member2_id;
    RAISE NOTICE 'Member 3 ID: %', member3_id;
    
END $$;

-- ============================================================
-- SECTION 7: VERIFICATION QUERIES
-- ============================================================

-- Verify data counts
SELECT 'profiles' AS table_name, COUNT(*) AS row_count FROM profiles
UNION ALL
SELECT 'gyms', COUNT(*) FROM gyms
UNION ALL
SELECT 'members', COUNT(*) FROM members
UNION ALL
SELECT 'member_credentials', COUNT(*) FROM member_credentials
UNION ALL
SELECT 'membership_plans', COUNT(*) FROM membership_plans
UNION ALL
SELECT 'memberships', COUNT(*) FROM memberships
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'attendance', COUNT(*) FROM attendance
UNION ALL
SELECT 'workout_plans', COUNT(*) FROM workout_plans
UNION ALL
SELECT 'member_workouts', COUNT(*) FROM member_workouts
UNION ALL
SELECT 'diet_plans', COUNT(*) FROM diet_plans
UNION ALL
SELECT 'member_diets', COUNT(*) FROM member_diets
UNION ALL
SELECT 'announcements', COUNT(*) FROM announcements
ORDER BY table_name;

-- Verify partial payment scenario
SELECT 
    m.full_name,
    m.balance AS outstanding_balance,
    mp.name AS plan_name,
    mp.price AS plan_price,
    COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) AS total_paid,
    mp.price - COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) AS remaining
FROM members m
JOIN memberships ms ON ms.member_id = m.id
JOIN membership_plans mp ON ms.plan_id = mp.id
LEFT JOIN payments p ON p.member_id = m.id AND p.membership_id = ms.id
GROUP BY m.id, m.full_name, m.balance, mp.name, mp.price
HAVING m.balance > 0;

-- ============================================================
-- SCHEMA CREATION COMPLETE!
-- ============================================================
-- 
-- Summary:
-- ✓ 6 Enum types created
-- ✓ 13 Tables created with proper FK relationships
-- ✓ 30+ Indexes created for optimal query performance
-- ✓ Triggers for automatic updated_at timestamp
-- ✓ Seed data with realistic dummy entries
-- ✓ Partial payment example (10000 plan, 8000 paid, 2000 balance)
-- 
-- Next Steps:
-- 1. Run this script in Supabase SQL Editor
-- 2. Configure Row Level Security (RLS) policies
-- 3. Set up Supabase Auth triggers for profile creation
-- 
-- ============================================================