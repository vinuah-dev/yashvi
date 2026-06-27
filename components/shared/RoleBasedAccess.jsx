"use client";

import { useUserRole } from '@/lib/hooks/useUserRole';

/**
 * Component to mask sensitive finance data for trainers
 * Shows actual value for admin/owner, shows ***** for trainers
 */
export function FinanceValue({ 
  value, 
  prefix = "₹", 
  suffix = "",
  className = "",
  maskText = "*****"
}) {
  const { canViewFinance, loading } = useUserRole();

  if (loading) {
    return <span className={className}>...</span>;
  }

  if (!canViewFinance) {
    return <span className={`${className} text-gray-400`}>{maskText}</span>;
  }

  // Format number with commas if it's a number
  const formattedValue = typeof value === 'number' 
    ? value.toLocaleString('en-IN')
    : value;

  return (
    <span className={className}>
      {prefix}{formattedValue}{suffix}
    </span>
  );
}

/**
 * Component to conditionally render content only for users who can view finance
 * Shows children for admin/owner, shows nothing or fallback for trainers
 */
export function FinanceGate({ 
  children, 
  fallback = null,
  showMasked = false,
  maskText = "*****"
}) {
  const { canViewFinance, loading } = useUserRole();

  if (loading) {
    return null;
  }

  if (!canViewFinance) {
    if (showMasked) {
      return <span className="text-gray-400">{maskText}</span>;
    }
    return fallback;
  }

  return <>{children}</>;
}

/**
 * Component to conditionally render content only for admin/owner (not trainer)
 * Useful for hiding "Add Trainer" buttons
 */
export function AdminOnlyGate({ 
  children, 
  fallback = null 
}) {
  const { canCreateTrainer, loading } = useUserRole();

  if (loading) {
    return null;
  }

  if (!canCreateTrainer) {
    return fallback;
  }

  return <>{children}</>;
}

/**
 * Component to show different content based on user role
 */
export function RoleBasedContent({ 
  adminContent, 
  trainerContent, 
  defaultContent = null 
}) {
  const { isOwner, isAdmin, isTrainer, loading } = useUserRole();

  if (loading) {
    return null;
  }

  if (isOwner || isAdmin) {
    return <>{adminContent}</>;
  }

  if (isTrainer) {
    return <>{trainerContent}</>;
  }

  return <>{defaultContent}</>;
}
