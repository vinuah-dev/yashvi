-- Support PT installment payments across multiple collections.
-- Stores the contracted PT amount and remaining due on the active assignment,
-- while individual collections continue to be recorded in trainer_earnings.

ALTER TABLE trainer_member_assignments
    ADD COLUMN IF NOT EXISTS plan_total_amount DECIMAL(10, 2);

ALTER TABLE trainer_member_assignments
    ADD COLUMN IF NOT EXISTS total_paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE trainer_member_assignments
    ADD COLUMN IF NOT EXISTS pending_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE trainer_member_assignments
    ADD COLUMN IF NOT EXISTS next_payment_date DATE;

COMMENT ON COLUMN trainer_member_assignments.plan_total_amount IS 'Final PT plan amount agreed for this assignment, including custom pricing';
COMMENT ON COLUMN trainer_member_assignments.total_paid_amount IS 'Total PT amount collected so far across all installments';
COMMENT ON COLUMN trainer_member_assignments.pending_amount IS 'Remaining PT amount still due for this assignment';
COMMENT ON COLUMN trainer_member_assignments.next_payment_date IS 'Next planned collection date for the remaining PT due';

UPDATE trainer_member_assignments tma
SET
    plan_total_amount = COALESCE(
        tma.plan_total_amount,
        (SELECT tp.price FROM trainer_plans tp WHERE tp.id = tma.trainer_plan_id),
        (SELECT SUM(te.total_amount) FROM trainer_earnings te WHERE te.assignment_id = tma.id),
        0
    ),
    total_paid_amount = COALESCE(
        (SELECT SUM(te.total_amount) FROM trainer_earnings te WHERE te.assignment_id = tma.id),
        tma.total_paid_amount,
        0
    );

UPDATE trainer_member_assignments
SET pending_amount = GREATEST(COALESCE(plan_total_amount, 0) - COALESCE(total_paid_amount, 0), 0)
WHERE pending_amount IS NULL OR pending_amount <> GREATEST(COALESCE(plan_total_amount, 0) - COALESCE(total_paid_amount, 0), 0);

CREATE INDEX IF NOT EXISTS idx_trainer_member_assignments_gym_next_payment
    ON trainer_member_assignments (gym_id, next_payment_date)
    WHERE is_active = true AND next_payment_date IS NOT NULL AND pending_amount > 0;