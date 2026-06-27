-- Example queries for trainer assignment history + PT payments
-- (Reference only — not applied as a migration.)

-- Active assignment for a member
-- SELECT * FROM trainer_member_assignments
-- WHERE gym_id = :gym_id AND member_id = :member_id AND is_active = TRUE;

-- Full history for a member (newest first)
-- SELECT tma.*, p.first_name, p.last_name
-- FROM trainer_member_assignments tma
-- JOIN profiles p ON p.id = tma.trainer_id
-- WHERE tma.gym_id = :gym_id AND tma.member_id = :member_id
-- ORDER BY tma.start_date DESC NULLS LAST, tma.created_at DESC;

-- PT payments collected per assignment
-- SELECT assignment_id, SUM(amount) AS total_pt
-- FROM trainer_payments
-- WHERE gym_id = :gym_id AND member_id = :member_id
-- GROUP BY assignment_id;
