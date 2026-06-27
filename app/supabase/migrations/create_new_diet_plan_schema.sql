-- ============================================================
-- NEW DIET PLAN SCHEMA MIGRATION
-- Replaces old diet_plans structure with detailed meal planning
-- ============================================================

-- Drop old tables if they exist (will be recreated with new structure)
DROP TABLE IF EXISTS diet_meal_items CASCADE;
DROP TABLE IF EXISTS diet_meals CASCADE;
DROP TABLE IF EXISTS diet_plan_days CASCADE;
DROP TABLE IF EXISTS member_diets CASCADE;
DROP TABLE IF EXISTS diet_plans CASCADE;

-- Drop old enum if exists
DROP TYPE IF EXISTS meal_type_enum CASCADE;

-- ============================================================
-- 1. CREATE ENUM TYPE FOR MEAL TYPES
-- ============================================================
CREATE TYPE meal_type_enum AS ENUM (
    'early_morning',
    'breakfast',
    'mid_morning',
    'lunch',
    'pre_workout',
    'post_workout',
    'evening_snack',
    'dinner',
    'bedtime'
);

-- ============================================================
-- 2. DIET_PLANS TABLE (Admin-created)
-- ============================================================
CREATE TABLE diet_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    is_template BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE diet_plans IS 'Diet plans created by admin for gym members';
COMMENT ON COLUMN diet_plans.is_template IS 'If true, this plan can be reused as a template';

-- ============================================================
-- 3. DIET_PLAN_DAYS TABLE (Monday → Sunday)
-- ============================================================
CREATE TABLE diet_plan_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diet_plan_id UUID NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    day_name VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(diet_plan_id, day_of_week)
);

COMMENT ON TABLE diet_plan_days IS 'Days of the week for each diet plan (1=Monday, 7=Sunday)';
COMMENT ON COLUMN diet_plan_days.day_of_week IS '1=Monday, 2=Tuesday, ..., 7=Sunday';

-- ============================================================
-- 4. DIET_MEALS TABLE (Meal types for each day)
-- ============================================================
CREATE TABLE diet_meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diet_plan_day_id UUID NOT NULL REFERENCES diet_plan_days(id) ON DELETE CASCADE,
    meal_type meal_type_enum NOT NULL,
    meal_time TIME,
    instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(diet_plan_day_id, meal_type)
);

COMMENT ON TABLE diet_meals IS 'Meal types (breakfast, lunch, etc.) for each day of the diet plan';

-- ============================================================
-- 5. DIET_MEAL_ITEMS TABLE (Food items for each meal)
-- ============================================================
CREATE TABLE diet_meal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diet_meal_id UUID NOT NULL REFERENCES diet_meals(id) ON DELETE CASCADE,
    food_name VARCHAR(150) NOT NULL,
    quantity VARCHAR(50),
    calories INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE diet_meal_items IS 'Individual food items within each meal';

-- ============================================================
-- 6. MEMBER_DIETS TABLE (Assign diet plan to member)
-- ============================================================
CREATE TABLE member_diets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    diet_plan_id UUID NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(member_id, diet_plan_id)
);

COMMENT ON TABLE member_diets IS 'Links members to their assigned diet plans';
COMMENT ON COLUMN member_diets.assigned_by IS 'Admin who assigned this diet plan';

-- ============================================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX idx_diet_plans_gym_id ON diet_plans(gym_id);
CREATE INDEX idx_diet_plans_created_by ON diet_plans(created_by);
CREATE INDEX idx_diet_plan_days_plan_id ON diet_plan_days(diet_plan_id);
CREATE INDEX idx_diet_meals_day_id ON diet_meals(diet_plan_day_id);
CREATE INDEX idx_diet_meal_items_meal_id ON diet_meal_items(diet_meal_id);
CREATE INDEX idx_member_diets_member_id ON member_diets(member_id);
CREATE INDEX idx_member_diets_plan_id ON member_diets(diet_plan_id);

-- ============================================================
-- 8. CREATE TRIGGER FOR UPDATED_AT
-- ============================================================
CREATE OR REPLACE FUNCTION update_diet_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_diet_plans_updated_at
    BEFORE UPDATE ON diet_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_diet_plans_updated_at();

