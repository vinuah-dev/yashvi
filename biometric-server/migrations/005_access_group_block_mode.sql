-- ============================================================
-- ACCESS-GROUP BLOCKING
--
-- Withholding access by deleting the user record also wipes the enrolled
-- finger, so a renewal needs either a stored template or a fresh enrollment.
-- This F22 never uploads its templates (its pushes carry OPERLOG only), which
-- left re-enrollment as the only option.
--
-- Access groups avoid that entirely: the device decides whether a matched
-- finger opens the gate from the group the user is in. Moving someone to the
-- no-access group refuses them while the finger stays enrolled, so renewal is
-- one command and nothing has to be re-enrolled.
--
-- IMPORTANT — device-side setup is required for this to do anything:
--   On the scanner: Menu -> Access Control -> Access Group Settings
--     Group 1  keep as the normal group that has access (default for users)
--     Group 2  set with NO valid time zone, so its members are always refused
--   Without that, moving a user to group 2 changes nothing.
--
-- Modes after this migration:
--   'group'    move to the no-access group  (default; finger kept)
--   'disable'  delete from device, restore the backed-up template on renewal
--   'delete'   delete from device, staff enrolls the finger again on renewal
--
-- Non-destructive: widens a constraint and changes a default. No rows are
-- deleted, and existing gyms keep whatever mode they already have.
-- Run AFTER 004_numeric_command_id.sql
-- ============================================================

ALTER TABLE gyms
DROP CONSTRAINT IF EXISTS gyms_biometric_block_mode_check;

ALTER TABLE gyms
ADD CONSTRAINT gyms_biometric_block_mode_check
CHECK (biometric_block_mode IN ('group', 'disable', 'delete'));

ALTER TABLE gyms
ALTER COLUMN biometric_block_mode SET DEFAULT 'group';

-- Gyms still on the old default were never deliberately set to 'disable' —
-- that was simply the only value available. Move them onto the mode that
-- actually works on a device which does not upload templates.
UPDATE gyms
SET biometric_block_mode = 'group'
WHERE biometric_block_mode = 'disable';
