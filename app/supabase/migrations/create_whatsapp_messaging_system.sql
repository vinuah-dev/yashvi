-- ============================================================
-- WhatsApp Messaging & Campaign Module
-- Migration for message templates and campaign tracking
-- ============================================================

-- ------------------------------------------------------------
-- 1. MESSAGE TEMPLATES TABLE
-- Stores reusable message templates with variable support
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general', -- general, expiry, birthday, campaign, reactivation
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE message_templates IS 'Reusable WhatsApp message templates with variable support';
COMMENT ON COLUMN message_templates.category IS 'Template category: general, expiry, birthday, campaign, reactivation';
COMMENT ON COLUMN message_templates.content IS 'Message content with variables like {Name}, {ExpiryDate}, {MembershipType}, {GymName}';

-- Indexes for message_templates
CREATE INDEX IF NOT EXISTS idx_message_templates_gym_id ON message_templates(gym_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_message_templates_is_active ON message_templates(is_active);

-- Trigger for updated_at
CREATE TRIGGER update_message_templates_updated_at
    BEFORE UPDATE ON message_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- 2. MESSAGE CAMPAIGNS TABLE
-- Tracks bulk messaging campaigns
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    filter_criteria JSONB DEFAULT '{}'::jsonb, -- Stores the filter used
    total_recipients INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    pending_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft', -- draft, in_progress, completed, paused
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

COMMENT ON TABLE message_campaigns IS 'Tracks bulk WhatsApp messaging campaigns';
COMMENT ON COLUMN message_campaigns.filter_criteria IS 'JSON storing the filter criteria used for member selection';
COMMENT ON COLUMN message_campaigns.status IS 'Campaign status: draft, in_progress, completed, paused';

-- Indexes for message_campaigns
CREATE INDEX IF NOT EXISTS idx_message_campaigns_gym_id ON message_campaigns(gym_id);
CREATE INDEX IF NOT EXISTS idx_message_campaigns_status ON message_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_message_campaigns_created_at ON message_campaigns(created_at DESC);

-- ------------------------------------------------------------
-- 3. CAMPAIGN RECIPIENTS TABLE
-- Tracks individual message status per recipient in a campaign
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES message_campaigns(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL, -- The personalized message for this recipient
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, skipped
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Each member can only be in a campaign once
    CONSTRAINT unique_campaign_member UNIQUE (campaign_id, member_id)
);

COMMENT ON TABLE campaign_recipients IS 'Individual recipients and their message status in a campaign';

-- Indexes for campaign_recipients
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_member_id ON campaign_recipients(member_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status);

-- ------------------------------------------------------------
-- 4. MESSAGE LOG TABLE
-- Logs all individual messages sent (for history/tracking)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES message_campaigns(id) ON DELETE SET NULL,
    template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    phone VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'manual', -- manual, campaign, scheduled
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE message_log IS 'Log of all WhatsApp messages sent for tracking';

-- Indexes for message_log
CREATE INDEX IF NOT EXISTS idx_message_log_gym_id ON message_log(gym_id);
CREATE INDEX IF NOT EXISTS idx_message_log_member_id ON message_log(member_id);
CREATE INDEX IF NOT EXISTS idx_message_log_sent_at ON message_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_log_message_type ON message_log(message_type);

-- ------------------------------------------------------------
-- 5. INSERT DEFAULT TEMPLATES
-- Pre-defined templates for common use cases
-- ------------------------------------------------------------
-- This will be inserted when a gym first accesses the messaging feature
-- (handled in application code to include gym_id)

-- ------------------------------------------------------------
-- 6. RPC FUNCTION: Get Members for Messaging
-- Returns filtered member list for messaging with relevant data
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_members_for_messaging(
    p_gym_id UUID,
    p_category VARCHAR DEFAULT 'all', -- all, active, inactive
    p_filter_type VARCHAR DEFAULT NULL,
    p_filter_value VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    member_id UUID,
    full_name VARCHAR,
    phone VARCHAR,
    email VARCHAR,
    membership_status VARCHAR,
    plan_name VARCHAR,
    expiry_date DATE,
    days_until_expiry INTEGER,
    last_visit_date DATE,
    days_since_visit INTEGER,
    join_date DATE,
    trainer_name VARCHAR
) AS $$
DECLARE
    today DATE := CURRENT_DATE;
BEGIN
    RETURN QUERY
    WITH member_data AS (
        SELECT 
            m.id AS m_id,
            m.full_name,
            m.phone,
            m.email,
            m.join_date,
            -- Get latest membership
            (SELECT ms.status::VARCHAR FROM memberships ms 
             WHERE ms.member_id = m.id 
             ORDER BY ms.end_date DESC LIMIT 1) AS membership_status,
            (SELECT mp.name FROM memberships ms 
             JOIN membership_plans mp ON ms.plan_id = mp.id
             WHERE ms.member_id = m.id 
             ORDER BY ms.end_date DESC LIMIT 1) AS plan_name,
            (SELECT ms.end_date FROM memberships ms 
             WHERE ms.member_id = m.id 
             ORDER BY ms.end_date DESC LIMIT 1) AS expiry_date,
            -- Get last attendance
            (SELECT a.check_in_date FROM attendance a 
             WHERE a.member_id = m.id 
             ORDER BY a.check_in_date DESC LIMIT 1) AS last_visit,
            -- Get trainer assignment
            (SELECT p.first_name || ' ' || p.last_name 
             FROM trainer_member_assignments tma
             JOIN profiles p ON tma.trainer_id = p.id
             WHERE tma.member_id = m.id AND tma.is_active = true
             LIMIT 1) AS trainer_name
        FROM members m
        WHERE m.gym_id = p_gym_id
    )
    SELECT 
        md.m_id AS member_id,
        md.full_name::VARCHAR,
        md.phone::VARCHAR,
        md.email::VARCHAR,
        COALESCE(md.membership_status, 'inactive')::VARCHAR AS membership_status,
        md.plan_name::VARCHAR,
        md.expiry_date,
        CASE WHEN md.expiry_date IS NOT NULL 
             THEN (md.expiry_date - today)::INTEGER 
             ELSE NULL END AS days_until_expiry,
        md.last_visit AS last_visit_date,
        CASE WHEN md.last_visit IS NOT NULL 
             THEN (today - md.last_visit)::INTEGER 
             ELSE NULL END AS days_since_visit,
        md.join_date,
        md.trainer_name::VARCHAR
    FROM member_data md
    WHERE 
        -- Category filter
        CASE p_category
            WHEN 'active' THEN COALESCE(md.membership_status, 'inactive') = 'active'
            WHEN 'inactive' THEN COALESCE(md.membership_status, 'inactive') != 'active'
            ELSE TRUE
        END
        -- Additional filters based on type
        AND CASE 
            -- Expiry filters
            WHEN p_filter_type = 'expiry_3_days' THEN 
                md.expiry_date IS NOT NULL AND (md.expiry_date - today) BETWEEN 0 AND 3
            WHEN p_filter_type = 'expiry_7_days' THEN 
                md.expiry_date IS NOT NULL AND (md.expiry_date - today) BETWEEN 0 AND 7
            WHEN p_filter_type = 'expiry_15_days' THEN 
                md.expiry_date IS NOT NULL AND (md.expiry_date - today) BETWEEN 0 AND 15
            WHEN p_filter_type = 'expired' THEN 
                md.expiry_date IS NOT NULL AND md.expiry_date < today
            -- Visit filters
            WHEN p_filter_type = 'no_visit_7_days' THEN 
                md.last_visit IS NULL OR (today - md.last_visit) > 7
            WHEN p_filter_type = 'no_visit_15_days' THEN 
                md.last_visit IS NULL OR (today - md.last_visit) > 15
            WHEN p_filter_type = 'no_visit_30_days' THEN 
                md.last_visit IS NULL OR (today - md.last_visit) > 30
            WHEN p_filter_type = 'never_visited' THEN 
                md.last_visit IS NULL
            -- Join date filters
            WHEN p_filter_type = 'joined_7_days' THEN 
                md.join_date IS NOT NULL AND (today - md.join_date) <= 7
            WHEN p_filter_type = 'joined_30_days' THEN 
                md.join_date IS NOT NULL AND (today - md.join_date) <= 30
            -- High/low attendance (simplified - will use attendance count from last 30 days)
            WHEN p_filter_type = 'low_attendance' THEN 
                (SELECT COUNT(*) FROM attendance a 
                 WHERE a.member_id = md.m_id AND a.check_in_date >= today - INTERVAL '30 days') < 8
            WHEN p_filter_type = 'high_attendance' THEN 
                (SELECT COUNT(*) FROM attendance a 
                 WHERE a.member_id = md.m_id AND a.check_in_date >= today - INTERVAL '30 days') >= 15
            ELSE TRUE
        END
    ORDER BY md.full_name;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 7. RPC FUNCTION: Get Messaging Dashboard Stats
-- Returns stats for the messaging dashboard widgets
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_messaging_dashboard_stats(p_gym_id UUID)
RETURNS JSONB AS $$
DECLARE
    today DATE := CURRENT_DATE;
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'expiry_3_days', (
            SELECT COUNT(*) FROM memberships ms
            JOIN members m ON ms.member_id = m.id
            WHERE m.gym_id = p_gym_id 
            AND ms.status = 'active'
            AND ms.end_date BETWEEN today AND today + INTERVAL '3 days'
        ),
        'expiry_7_days', (
            SELECT COUNT(*) FROM memberships ms
            JOIN members m ON ms.member_id = m.id
            WHERE m.gym_id = p_gym_id 
            AND ms.status = 'active'
            AND ms.end_date BETWEEN today AND today + INTERVAL '7 days'
        ),
        'inactive_members', (
            SELECT COUNT(*) FROM members m
            WHERE m.gym_id = p_gym_id
            AND NOT EXISTS (
                SELECT 1 FROM memberships ms 
                WHERE ms.member_id = m.id AND ms.status = 'active'
            )
        ),
        'no_visit_7_days', (
            SELECT COUNT(*) FROM members m
            WHERE m.gym_id = p_gym_id
            AND EXISTS (SELECT 1 FROM memberships ms WHERE ms.member_id = m.id AND ms.status = 'active')
            AND (
                NOT EXISTS (SELECT 1 FROM attendance a WHERE a.member_id = m.id)
                OR (SELECT MAX(check_in_date) FROM attendance a WHERE a.member_id = m.id) < today - INTERVAL '7 days'
            )
        ),
        'new_joins_today', (
            SELECT COUNT(*) FROM members m
            WHERE m.gym_id = p_gym_id
            AND m.join_date = today
        ),
        'new_joins_7_days', (
            SELECT COUNT(*) FROM members m
            WHERE m.gym_id = p_gym_id
            AND m.join_date >= today - INTERVAL '7 days'
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 8. Enable RLS (Row Level Security) if needed
-- ------------------------------------------------------------
-- Note: Add RLS policies based on your security requirements
-- ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE message_campaigns ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;
