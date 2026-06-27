-- Health Tracker: weight logs, workout logs, calorie logs

-- 1. Weight Logs (morning + night)
CREATE TABLE IF NOT EXISTS member_weight_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  weight_kg DECIMAL(5, 2) NOT NULL,
  log_type VARCHAR(10) NOT NULL CHECK (log_type IN ('morning', 'night')),
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weight_logs_member_date
  ON member_weight_logs(member_id, logged_at DESC);

-- 2. Workout Logs
CREATE TABLE IF NOT EXISTS member_workout_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  exercise_name VARCHAR(200) NOT NULL,
  sets INTEGER,
  reps INTEGER,
  duration_minutes INTEGER,
  calories_burned INTEGER,
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_member_date
  ON member_workout_logs(member_id, logged_at DESC);

-- 3. Calorie / Nutrition Logs
CREATE TABLE IF NOT EXISTS member_calorie_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_description TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein_g DECIMAL(6, 1),
  carbs_g DECIMAL(6, 1),
  fat_g DECIMAL(6, 1),
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calorie_logs_member_date
  ON member_calorie_logs(member_id, logged_at DESC);

-- Enable RLS
ALTER TABLE member_weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_calorie_logs ENABLE ROW LEVEL SECURITY;

-- Permissive policies (matching app pattern)
CREATE POLICY "Allow all on weight_logs" ON member_weight_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on workout_logs" ON member_workout_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on calorie_logs" ON member_calorie_logs FOR ALL USING (true) WITH CHECK (true);
