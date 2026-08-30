-- ============================================================
-- NUMERIC COMMAND IDs
--
-- The ADMS reply format is  C:<ID>:<COMMAND>  and the device parses <ID> as a
-- 64-bit integer, echoing it back as ID=<n> when it reports the result.
--
-- We were sending the row's UUID primary key, so the device saw an unparseable
-- id, never ran the command, and never confirmed it. Every block looked queued
-- and sent while the fingerprint stayed on the scanner.
--
-- cmd_no gives each command the integer the protocol expects. The UUID stays
-- the primary key; cmd_no is only what goes on the wire.
--
-- Non-destructive: adds a column and backfills existing rows from the sequence.
-- Run AFTER 003_biometric_access_control.sql
-- ============================================================

ALTER TABLE biometric_device_commands
ADD COLUMN IF NOT EXISTS cmd_no BIGSERIAL;

-- The device only ever hands back cmd_no, so lookups go through it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_biometric_device_commands_cmd_no
ON biometric_device_commands(cmd_no);
