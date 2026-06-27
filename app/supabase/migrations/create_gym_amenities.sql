-- ============================================================
-- GYM AMENITIES MIGRATION
-- Tables for gym amenities management and member assignments
-- ============================================================

-- 1. GYM AMENITIES TABLE
-- Stores amenities a gym offers (locker, towel, parking, etc.)
CREATE TABLE IF NOT EXISTS gym_amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    cost DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE gym_amenities IS 'Amenities offered by a gym (locker, towel, parking, etc.)';
COMMENT ON COLUMN gym_amenities.cost IS 'Cost of the amenity in INR';

CREATE INDEX IF NOT EXISTS idx_gym_amenities_gym_id ON gym_amenities(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_amenities_active ON gym_amenities(gym_id, is_active);

-- 2. MEMBER AMENITIES TABLE
-- Tracks which amenities are assigned to which members
CREATE TABLE IF NOT EXISTS member_amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    amenity_id UUID NOT NULL REFERENCES gym_amenities(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE member_amenities IS 'Amenities assigned to members with payment tracking';

CREATE INDEX IF NOT EXISTS idx_member_amenities_gym_id ON member_amenities(gym_id);
CREATE INDEX IF NOT EXISTS idx_member_amenities_member_id ON member_amenities(member_id);
CREATE INDEX IF NOT EXISTS idx_member_amenities_amenity_id ON member_amenities(amenity_id);
CREATE INDEX IF NOT EXISTS idx_member_amenities_active ON member_amenities(gym_id, member_id, is_active);

-- Unique constraint: a member can only have one active assignment of the same amenity
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_amenities_unique_active
    ON member_amenities(gym_id, member_id, amenity_id) WHERE is_active = true;

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE gym_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_amenities ENABLE ROW LEVEL SECURITY;

-- gym_amenities policies
CREATE POLICY "gym_amenities_select" ON gym_amenities FOR SELECT USING (true);
CREATE POLICY "gym_amenities_insert" ON gym_amenities FOR INSERT WITH CHECK (true);
CREATE POLICY "gym_amenities_update" ON gym_amenities FOR UPDATE USING (true);
CREATE POLICY "gym_amenities_delete" ON gym_amenities FOR DELETE USING (true);

-- member_amenities policies
CREATE POLICY "member_amenities_select" ON member_amenities FOR SELECT USING (true);
CREATE POLICY "member_amenities_insert" ON member_amenities FOR INSERT WITH CHECK (true);
CREATE POLICY "member_amenities_update" ON member_amenities FOR UPDATE USING (true);
CREATE POLICY "member_amenities_delete" ON member_amenities FOR DELETE USING (true);
