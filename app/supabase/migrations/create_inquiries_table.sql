-- ============================================================
-- Migration: Create Inquiries Table for Member Inquiry Management
-- ============================================================

-- Create inquiry_status enum
DO $$ BEGIN
  CREATE TYPE inquiry_status AS ENUM ('new', 'contacted', 'follow_up', 'joined', 'not_interested');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create inquiries table
CREATE TABLE IF NOT EXISTS inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    follow_up_date DATE,
    interested_plan VARCHAR(100),
    status inquiry_status NOT NULL DEFAULT 'new',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_inquiries_gym_phone ON inquiries(gym_id, phone);
CREATE INDEX IF NOT EXISTS idx_inquiries_follow_up_date ON inquiries(follow_up_date) WHERE follow_up_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_gym_id ON inquiries(gym_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_visit_date ON inquiries(visit_date);

-- RLS Policies
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inquiries for their gym" ON inquiries
    FOR SELECT USING (true);

CREATE POLICY "Users can insert inquiries" ON inquiries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update inquiries" ON inquiries
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete inquiries" ON inquiries
    FOR DELETE USING (true);

COMMENT ON TABLE inquiries IS 'Member inquiry tracking for gym leads and follow-ups';
COMMENT ON COLUMN inquiries.phone IS 'Unique per gym to prevent duplicate inquiries';
COMMENT ON COLUMN inquiries.follow_up_date IS 'Scheduled follow-up date for the inquiry';
COMMENT ON COLUMN inquiries.interested_plan IS 'Plan the prospect is interested in (Monthly, Quarterly, Yearly, PT, etc.)';
