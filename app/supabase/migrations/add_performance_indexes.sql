-- ============================================================
-- PERFORMANCE INDEXES MIGRATION
-- Shabiya Gym Management
-- Created: March 3, 2026
-- 
-- Purpose: Add composite & covering indexes to speed up
--          the most frequent query patterns across RPCs,
--          API routes, admin pages, and customer pages.
--
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================


-- ************************************************************
-- 1. ATTENDANCE — Heavily queried table
-- ************************************************************

-- Dashboard: WHERE gym_id = ? AND check_in_date = CURRENT_DATE
-- Analytics: WHERE gym_id = ? AND check_in_date BETWEEN ? AND ?
-- This composite replaces separate idx_attendance_gym_id + idx_attendance_check_in_date
CREATE INDEX IF NOT EXISTS idx_attendance_gym_checkin_date
    ON attendance (gym_id, check_in_date);

-- Member detail: WHERE member_id = ? ORDER BY check_in_date DESC LIMIT 10
CREATE INDEX IF NOT EXISTS idx_attendance_member_checkin_desc
    ON attendance (member_id, check_in_date DESC);

-- Analytics page: WHERE gym_id = ? AND check_in_date = ? — count per day
-- Already covered by idx_attendance_gym_checkin_date above

-- Dashboard: ORDER BY check_in_time DESC for today's attendance list
CREATE INDEX IF NOT EXISTS idx_attendance_gym_date_time
    ON attendance (gym_id, check_in_date, check_in_time DESC);


-- ************************************************************
-- 2. PAYMENTS — Finance data, dashboard, insights
-- ************************************************************

-- Finance data RPC: WHERE gym_id = ? AND paid_at BETWEEN ? AND ?
-- Finance insights: WHERE gym_id = ? AND status = 'paid' AND paid_at range
CREATE INDEX IF NOT EXISTS idx_payments_gym_paid_at
    ON payments (gym_id, paid_at);

-- Finance insights: WHERE gym_id = ? AND status = 'paid' — SUM(amount)
CREATE INDEX IF NOT EXISTS idx_payments_gym_status_paid_at
    ON payments (gym_id, status, paid_at);

-- Member detail & transactions: WHERE member_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_payments_member_created_desc
    ON payments (member_id, created_at DESC);

-- Dashboard: WHERE gym_id = ? AND created_at >= first_of_month
CREATE INDEX IF NOT EXISTS idx_payments_gym_created_at
    ON payments (gym_id, created_at);

-- Finance data: WHERE gym_id = ? AND next_payment_date IS NOT NULL AND remaining_amount > 0
CREATE INDEX IF NOT EXISTS idx_payments_gym_next_payment
    ON payments (gym_id, next_payment_date)
    WHERE next_payment_date IS NOT NULL AND remaining_amount > 0;

-- Finance data: fallback query — WHERE paid_at IS NULL AND created_at BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_payments_gym_null_paid_at
    ON payments (gym_id, created_at)
    WHERE paid_at IS NULL;


-- ************************************************************
-- 3. MEMBERSHIPS — Members list, analytics, finance insights
-- ************************************************************

-- Finance insights: WHERE gym_id = ? AND status = 'active' AND start_date <= ? AND end_date >= ?
-- Analytics: active member count
CREATE INDEX IF NOT EXISTS idx_memberships_gym_status_dates
    ON memberships (gym_id, status, start_date, end_date);

-- Members list & member detail: WHERE member_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_memberships_member_created_desc
    ON memberships (member_id, created_at DESC);

-- Finance insights: renewals — WHERE gym_id = ? AND created_at BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_memberships_gym_created_at
    ON memberships (gym_id, created_at);

-- Expiring soon queries (cron, notifications): WHERE status = 'active' AND end_date BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_memberships_active_end_date
    ON memberships (end_date)
    WHERE status = 'active';


-- ************************************************************
-- 4. MEMBERS — Core table, almost every page
-- ************************************************************

-- Finance insights: WHERE gym_id = ? AND balance > 0
CREATE INDEX IF NOT EXISTS idx_members_gym_balance_due
    ON members (gym_id)
    WHERE balance > 0;

-- Finance insights: WHERE gym_id = ? AND join_date BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_members_gym_join_date
    ON members (gym_id, join_date);

-- Members list: WHERE gym_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_members_gym_created_desc
    ON members (gym_id, created_at DESC);

-- Member creation duplicate check: WHERE gym_id = ? AND phone = ?
CREATE INDEX IF NOT EXISTS idx_members_gym_phone
    ON members (gym_id, phone);

-- Full-name search (ILIKE): use pg_trgm if available
-- This GIN index speeds up ILIKE '%search%' or full_name searches
DO $$
BEGIN
    -- Try to create pg_trgm extension (may already exist)
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    
    -- Create GIN trigram index for member name search
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_members_full_name_trgm') THEN
        CREATE INDEX idx_members_full_name_trgm
            ON members USING gin (full_name gin_trgm_ops);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_trgm extension not available, skipping trigram index for members.full_name';
END;
$$;


-- ************************************************************
-- 5. PROFILES — Trainer lookups, auth
-- ************************************************************

-- Trainer listing: WHERE role = 'trainer' AND gym_id = ?
CREATE INDEX IF NOT EXISTS idx_profiles_role_gym
    ON profiles (role, gym_id);

-- Admin/trainer login duplicate check: WHERE email = ? AND gym_id = ?
CREATE INDEX IF NOT EXISTS idx_profiles_email_gym
    ON profiles (email, gym_id)
    WHERE email IS NOT NULL;

-- Admin/trainer login: WHERE phone = ? AND gym_id = ?
CREATE INDEX IF NOT EXISTS idx_profiles_phone_gym
    ON profiles (phone, gym_id)
    WHERE phone IS NOT NULL;


-- ************************************************************
-- 6. ANNOUNCEMENTS — Admin + customer pages
-- ************************************************************

-- Listing: WHERE gym_id = ? AND status = 'active' ORDER BY announced_at DESC
CREATE INDEX IF NOT EXISTS idx_announcements_gym_status_announced
    ON announcements (gym_id, status, announced_at DESC);


-- ************************************************************
-- 7. TRAINER_MEMBER_ASSIGNMENTS — Members list, member detail
-- ************************************************************

-- Members list (trainer view): WHERE trainer_id = ? AND gym_id = ? AND is_active = true
CREATE INDEX IF NOT EXISTS idx_tma_trainer_gym_active
    ON trainer_member_assignments (trainer_id, gym_id)
    WHERE is_active = true;

-- Members list: WHERE member_id IN (...) AND is_active = true
CREATE INDEX IF NOT EXISTS idx_tma_member_active
    ON trainer_member_assignments (member_id)
    WHERE is_active = true;


-- ************************************************************
-- 8. TRAINER_BOOKINGS — Schedule, slot check
-- ************************************************************

-- Member detail: WHERE member_id = ? AND gym_id = ? AND is_active = true
CREATE INDEX IF NOT EXISTS idx_trainer_bookings_member_gym_active
    ON trainer_bookings (member_id, gym_id)
    WHERE is_active = true;


-- ************************************************************
-- 9. TRAINER_EARNINGS — Trainer detail page
-- ************************************************************

-- Trainer detail: WHERE assignment_id IN (...)
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_assignment_id
    ON trainer_earnings (assignment_id);

-- Trainer earnings list: WHERE trainer_id = ? AND gym_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_trainer_gym_created
    ON trainer_earnings (trainer_id, gym_id, created_at DESC);


-- ************************************************************
-- 10. TRAINER_PLANS — Trainer management page
-- ************************************************************

-- Listing: WHERE trainer_id = ? AND gym_id = ? AND is_active = true
CREATE INDEX IF NOT EXISTS idx_trainer_plans_trainer_gym_active
    ON trainer_plans (trainer_id, gym_id)
    WHERE is_active = true;


-- ************************************************************
-- 11. GYM_TRAINERS — Trainer management
-- ************************************************************

-- Listing: WHERE gym_id = ? AND is_active = true
CREATE INDEX IF NOT EXISTS idx_gym_trainers_gym_active
    ON gym_trainers (gym_id)
    WHERE is_active = true;


-- ************************************************************
-- 12. EXPENSES — Finance data
-- ************************************************************

-- Finance data: WHERE gym_id = ? AND expense_date BETWEEN ? AND ?
-- Already has idx_expenses_gym_date(gym_id, expense_date) — good

-- Monthly category breakdown (analytics)
CREATE INDEX IF NOT EXISTS idx_expenses_gym_date_category
    ON expenses (gym_id, expense_date, category);


-- ************************************************************
-- 13. INQUIRIES — Inquiries page
-- ************************************************************

-- Listing: WHERE gym_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_inquiries_gym_created_desc
    ON inquiries (gym_id, created_at DESC);

-- Follow-up filter: WHERE gym_id = ? AND status = ? ORDER BY follow_up_date
CREATE INDEX IF NOT EXISTS idx_inquiries_gym_status
    ON inquiries (gym_id, status);


-- ************************************************************
-- 14. MEMBER_CREDENTIALS — Auth, members list check
-- ************************************************************

-- Members list: WHERE member_id IN (...) — already has UNIQUE on member_id
-- Login: WHERE login_value = ? — already has idx_member_credentials_login_value
-- No additional indexes needed


-- ************************************************************
-- 15. MEMBER_WORKOUTS — Customer dashboard, member detail
-- ************************************************************

-- Customer dashboard: WHERE member_id = ? ORDER BY assigned_at DESC
CREATE INDEX IF NOT EXISTS idx_member_workouts_member_assigned_desc
    ON member_workouts (member_id, assigned_at DESC);


-- ************************************************************
-- 16. MEMBER_DIETS — Customer dashboard, member detail
-- ************************************************************

-- Customer dashboard: WHERE member_id = ? ORDER BY assigned_at DESC
CREATE INDEX IF NOT EXISTS idx_member_diets_member_assigned_desc
    ON member_diets (member_id, assigned_at DESC);


-- ************************************************************
-- 17. WORKOUT_PLANS — Plan listing, detail page
-- ************************************************************

-- Listing: WHERE gym_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_workout_plans_gym_created_desc
    ON workout_plans (gym_id, created_at DESC);

-- Member-specific plans: WHERE member_id = ?
-- Already has idx_workout_plans_member_id — good


-- ************************************************************
-- 18. DIET_PLANS — Plan listing, detail page
-- ************************************************************

-- Listing: WHERE gym_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_diet_plans_gym_created_desc
    ON diet_plans (gym_id, created_at DESC);

-- Member-specific plans: WHERE member_id = ?
-- Already has idx_diet_plans_member_id — good


-- ************************************************************
-- 19. PAYMENT_RECEIPTS — Receipt lookup
-- ************************************************************

-- Member receipts: WHERE member_id = ? AND gym_id = ?
CREATE INDEX IF NOT EXISTS idx_payment_receipts_member_gym
    ON payment_receipts (member_id, gym_id);

-- Cleanup job: WHERE expires_at < now()
-- Already has idx_payment_receipts_expires_at — good


-- ************************************************************
-- 20. FCM_TOKENS — Notification push
-- ************************************************************

-- Push lookup: WHERE user_id = ? AND account_type = ?
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_account
    ON fcm_tokens (user_id, account_type);


-- ************************************************************
-- 21. NOTIFICATION_LOGS — Notification history
-- ************************************************************

-- User notification history: WHERE user_id = ? ORDER BY sent_at DESC
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_sent_desc
    ON notification_logs (user_id, sent_at DESC);


-- ************************************************************
-- 22. MEMBERSHIP_PLANS — Plan listing
-- ************************************************************

-- Active plans: WHERE gym_id = ? AND is_active = true
CREATE INDEX IF NOT EXISTS idx_membership_plans_gym_active
    ON membership_plans (gym_id)
    WHERE is_active = true;


-- ************************************************************
-- 23. BIOMETRIC TABLES
-- ************************************************************

-- Attendance logs: dedup check — WHERE gym_id = ? AND user_id = ? AND timestamp range
-- Using composite index on (gym_id, user_id) for dedup checks
-- Timestamp filtering handled by existing idx_attendance_logs_timestamp
CREATE INDEX IF NOT EXISTS idx_attendance_logs_gym_user
    ON attendance_logs (gym_id, user_id);

-- Device commands pending: WHERE device_sn = ? AND status = 'PENDING'
CREATE INDEX IF NOT EXISTS idx_device_commands_device_pending
    ON device_commands (device_sn)
    WHERE status = 'PENDING';


-- ************************************************************
-- STATS UPDATE
-- ************************************************************
-- After creating many indexes, update table statistics
-- so the query planner can use them effectively

ANALYZE profiles;
ANALYZE gyms;
ANALYZE members;
ANALYZE member_credentials;
ANALYZE membership_plans;
ANALYZE memberships;
ANALYZE attendance;
ANALYZE payments;
ANALYZE workout_plans;
ANALYZE workout_plan_days;
ANALYZE workout_exercises;
ANALYZE member_workouts;
ANALYZE diet_plans;
ANALYZE diet_plan_days;
ANALYZE diet_meals;
ANALYZE diet_meal_items;
ANALYZE member_diets;
ANALYZE announcements;
ANALYZE gym_amenities;
ANALYZE member_amenities;
ANALYZE trainer_bookings;
ANALYZE expenses;
ANALYZE inquiries;
ANALYZE payment_receipts;
ANALYZE gym_trainers;
ANALYZE trainer_member_assignments;
ANALYZE trainer_plans;
ANALYZE trainer_earnings;
ANALYZE notification_settings;
ANALYZE fcm_tokens;
ANALYZE notification_logs;


-- ============================================================
-- SUMMARY OF INDEXES CREATED (39 new indexes)
-- ============================================================
--
-- ATTENDANCE (3):
--   idx_attendance_gym_checkin_date (gym_id, check_in_date)
--   idx_attendance_member_checkin_desc (member_id, check_in_date DESC)
--   idx_attendance_gym_date_time (gym_id, check_in_date, check_in_time DESC)
--
-- PAYMENTS (6):
--   idx_payments_gym_paid_at (gym_id, paid_at)
--   idx_payments_gym_status_paid_at (gym_id, status, paid_at)
--   idx_payments_member_created_desc (member_id, created_at DESC)
--   idx_payments_gym_created_at (gym_id, created_at)
--   idx_payments_gym_next_payment (gym_id, next_payment_date) [partial]
--   idx_payments_gym_null_paid_at (gym_id, created_at) [WHERE paid_at IS NULL]
--
-- MEMBERSHIPS (4):
--   idx_memberships_gym_status_dates (gym_id, status, start_date, end_date)
--   idx_memberships_member_created_desc (member_id, created_at DESC)
--   idx_memberships_gym_created_at (gym_id, created_at)
--   idx_memberships_active_end_date (end_date) [WHERE status = 'active']
--
-- MEMBERS (4+1):
--   idx_members_gym_balance_due (gym_id) [WHERE balance > 0]
--   idx_members_gym_join_date (gym_id, join_date)
--   idx_members_gym_created_desc (gym_id, created_at DESC)
--   idx_members_gym_phone (gym_id, phone)
--   idx_members_full_name_trgm (full_name) [GIN trigram - if pg_trgm available]
--
-- PROFILES (3):
--   idx_profiles_role_gym (role, gym_id)
--   idx_profiles_email_gym (email, gym_id) [WHERE email IS NOT NULL]
--   idx_profiles_phone_gym (phone, gym_id) [WHERE phone IS NOT NULL]
--
-- ANNOUNCEMENTS (1):
--   idx_announcements_gym_status_announced (gym_id, status, announced_at DESC)
--
-- TRAINER_MEMBER_ASSIGNMENTS (2):
--   idx_tma_trainer_gym_active (trainer_id, gym_id) [WHERE is_active = true]
--   idx_tma_member_active (member_id) [WHERE is_active = true]
--
-- TRAINER_BOOKINGS (1):
--   idx_trainer_bookings_member_gym_active (member_id, gym_id) [WHERE is_active = true]
--
-- TRAINER_EARNINGS (2):
--   idx_trainer_earnings_assignment_id (assignment_id)
--   idx_trainer_earnings_trainer_gym_created (trainer_id, gym_id, created_at DESC)
--
-- TRAINER_PLANS (1):
--   idx_trainer_plans_trainer_gym_active (trainer_id, gym_id) [WHERE is_active = true]
--
-- GYM_TRAINERS (1):
--   idx_gym_trainers_gym_active (gym_id) [WHERE is_active = true]
--
-- EXPENSES (1):
--   idx_expenses_gym_date_category (gym_id, expense_date, category)
--
-- INQUIRIES (2):
--   idx_inquiries_gym_created_desc (gym_id, created_at DESC)
--   idx_inquiries_gym_status (gym_id, status)
--
-- MEMBER_WORKOUTS (1):
--   idx_member_workouts_member_assigned_desc (member_id, assigned_at DESC)
--
-- MEMBER_DIETS (1):
--   idx_member_diets_member_assigned_desc (member_id, assigned_at DESC)
--
-- WORKOUT_PLANS (1):
--   idx_workout_plans_gym_created_desc (gym_id, created_at DESC)
--
-- DIET_PLANS (1):
--   idx_diet_plans_gym_created_desc (gym_id, created_at DESC)
--
-- PAYMENT_RECEIPTS (1):
--   idx_payment_receipts_member_gym (member_id, gym_id)
--
-- FCM_TOKENS (1):
--   idx_fcm_tokens_user_account (user_id, account_type)
--
-- NOTIFICATION_LOGS (1):
--   idx_notification_logs_user_sent_desc (user_id, sent_at DESC)
--
-- MEMBERSHIP_PLANS (1):
--   idx_membership_plans_gym_active (gym_id) [WHERE is_active = true]
--
-- ATTENDANCE_LOGS (1):
--   idx_attendance_logs_gym_user (gym_id, user_id)
--
-- DEVICE_COMMANDS (1):
--   idx_device_commands_device_pending (device_sn) [WHERE status = 'PENDING']
--
-- ============================================================
