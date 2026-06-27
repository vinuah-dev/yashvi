"use client";

import { useAuthContext } from "@/contexts/AuthContext";

/**
 * Drop-in replacement for usePermissions that reads from AuthContext
 * instead of making a separate IndexedDB/localStorage read.
 */
export function usePermissions() {
  const ctx = useAuthContext();

  return {
    permissions: ctx.permissions,
    loading: !ctx.isReady,
    userRole: ctx.role,
    refetchPermissions: () => {}, // No-op: context auto-updates
  };
}
