"use client";

import { supabase } from "./supabaseClient";

/**
 * Receipt Cleanup Utility
 * Handles automatic cleanup of expired receipts from database and storage
 */

/**
 * Clean up expired receipts
 * This function removes:
 * 1. Database records where expires_at < now
 * 2. Storage files for expired receipts
 * @returns {Promise<{success: boolean, deletedCount: number, errors: string[]}>}
 */
export const cleanupExpiredReceipts = async () => {
  const errors = [];
  let deletedCount = 0;

  try {
    // 1. Fetch expired receipts
    const { data: expiredReceipts, error: fetchError } = await supabase
      .from("payment_receipts")
      .select("id, file_path, receipt_number")
      .lt("expires_at", new Date().toISOString());

    if (fetchError) {
      console.error("Error fetching expired receipts:", fetchError);
      errors.push(`Fetch error: ${fetchError.message}`);
      return { success: false, deletedCount: 0, errors };
    }

    if (!expiredReceipts || expiredReceipts.length === 0) {
      console.log("No expired receipts to clean up");
      return { success: true, deletedCount: 0, errors };
    }

    console.log(`Found ${expiredReceipts.length} expired receipts to clean up`);

    // 2. Delete files from storage
    const filePaths = expiredReceipts
      .map(r => r.file_path)
      .filter(Boolean);

    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("payment-receipts")
        .remove(filePaths);

      if (storageError) {
        console.error("Error deleting files from storage:", storageError);
        errors.push(`Storage deletion error: ${storageError.message}`);
        // Continue with database cleanup even if storage fails
      } else {
        console.log(`Deleted ${filePaths.length} files from storage`);
      }
    }

    // 3. Delete records from database
    const expiredIds = expiredReceipts.map(r => r.id);
    const { error: deleteError } = await supabase
      .from("payment_receipts")
      .delete()
      .in("id", expiredIds);

    if (deleteError) {
      console.error("Error deleting expired records:", deleteError);
      errors.push(`Database deletion error: ${deleteError.message}`);
    } else {
      deletedCount = expiredReceipts.length;
      console.log(`Deleted ${deletedCount} expired receipt records`);
    }

    return {
      success: errors.length === 0,
      deletedCount,
      errors
    };
  } catch (error) {
    console.error("Cleanup error:", error);
    errors.push(`Unexpected error: ${error.message}`);
    return { success: false, deletedCount, errors };
  }
};

/**
 * Run cleanup on app start (if needed)
 * Call this in your main layout or on dashboard load
 */
export const runStartupCleanup = async () => {
  // Check if cleanup was run today
  const lastCleanup = localStorage.getItem("lastReceiptCleanup");
  const today = new Date().toDateString();

  if (lastCleanup === today) {
    console.log("Receipt cleanup already ran today");
    return;
  }

  console.log("Running scheduled receipt cleanup...");
  const result = await cleanupExpiredReceipts();

  if (result.success) {
    localStorage.setItem("lastReceiptCleanup", today);
    if (result.deletedCount > 0) {
      console.log(`Cleaned up ${result.deletedCount} expired receipts`);
    }
  } else {
    console.error("Cleanup completed with errors:", result.errors);
  }

  return result;
};

export default {
  cleanupExpiredReceipts,
  runStartupCleanup
};
