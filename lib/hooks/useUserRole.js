"use client";

import { useAuthContext } from "@/contexts/AuthContext";

/**
 * Drop-in replacement for useUserRole that reads from AuthContext
 * instead of making a separate IndexedDB/localStorage read.
 * 
 * Returns the same API as the original hook for backwards compatibility.
 */
export function useUserRole() {
  const ctx = useAuthContext();

  return {
    role: ctx.role,
    user: ctx.user,
    loading: !ctx.isReady,
    isOwner: ctx.isOwner,
    isAdmin: ctx.isAdmin,
    isViewOnly: ctx.isViewOnly,
    isTrainer: ctx.isTrainer,
    isMember: ctx.isMember,
    canAccessAdmin: ctx.canAccessAdmin,
    canViewFinance: ctx.canViewFinance,
    canViewMemberDues: ctx.canViewMemberDues,
    canCreateTrainer: ctx.canCreateTrainer,
    canManageStaff: ctx.canManageStaff,
    canWrite: ctx.canWrite,
    refetchRole: () => {}, // No-op: context auto-updates
  };
}
