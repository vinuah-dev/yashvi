-- ============================================================
-- CREATE EXPENSES TABLE
-- For tracking gym expenses (rent, electricity, salaries, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    
    -- Expense details
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'rent', 
        'electricity', 
        'salary', 
        'equipment', 
        'maintenance', 
        'supplements', 
        'marketing', 
        'other'
    )),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_expenses_gym_id ON expenses(gym_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_gym_date ON expenses(gym_id, expense_date);

-- Add comment
COMMENT ON TABLE expenses IS 'Gym expenses tracking (rent, utilities, salaries, equipment, etc.)';

