-- ============================================================
-- AUTOMATED CLEANUP FOR EXPIRED RECEIPTS
-- PostgreSQL Function + pg_cron setup for Supabase
-- ============================================================

-- This function cleans up expired receipts from the database
-- Note: Storage file deletion needs to be handled separately via Edge Function
CREATE OR REPLACE FUNCTION cleanup_expired_receipts()
RETURNS json AS $$
DECLARE
    deleted_records INTEGER := 0;
    expired_files TEXT[] := '{}';
    receipt_record RECORD;
BEGIN
    -- Get list of files to delete (for logging/external deletion)
    FOR receipt_record IN 
        SELECT file_path FROM payment_receipts 
        WHERE expires_at < now()
    LOOP
        expired_files := array_append(expired_files, receipt_record.file_path);
    END LOOP;

    -- Delete expired receipt records from database
    DELETE FROM payment_receipts 
    WHERE expires_at < now();
    
    GET DIAGNOSTICS deleted_records = ROW_COUNT;
    
    RETURN json_build_object(
        'deleted_count', deleted_records,
        'expired_files', expired_files,
        'cleaned_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ENABLE pg_cron EXTENSION (if not already enabled)
-- Run this once in Supabase Dashboard -> SQL Editor
-- ============================================================
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- SCHEDULE DAILY CLEANUP JOB
-- Runs every day at 3:00 AM UTC
-- ============================================================
-- SELECT cron.schedule(
--     'cleanup-expired-receipts',
--     '0 3 * * *',  -- Daily at 3 AM UTC
--     $$SELECT cleanup_expired_receipts()$$
-- );

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('cleanup-expired-receipts');

COMMENT ON FUNCTION cleanup_expired_receipts() IS 'Deletes payment receipts older than 7 days';
