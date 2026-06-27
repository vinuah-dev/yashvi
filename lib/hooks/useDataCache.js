"use client";

import useSWR from "swr";
import { supabase } from "../supabaseClient";

// Generic fetcher for Supabase queries
const fetcher = async (key) => {
  const { table, query, gymId, options = {} } = JSON.parse(key);
  
  let queryBuilder = supabase.from(table).select(query);
  
  if (gymId) {
    queryBuilder = queryBuilder.eq("gym_id", gymId);
  }
  
  if (options.order) {
    queryBuilder = queryBuilder.order(options.order.column, { ascending: options.order.ascending ?? false });
  }
  
  if (options.eq) {
    Object.entries(options.eq).forEach(([column, value]) => {
      queryBuilder = queryBuilder.eq(column, value);
    });
  }
  
  if (options.limit) {
    queryBuilder = queryBuilder.limit(options.limit);
  }
  
  const { data, error } = await queryBuilder;
  
  if (error) throw error;
  return data;
};

// SWR configuration for optimal caching
const defaultConfig = {
  revalidateOnFocus: false, // Don't refetch when window regains focus
  revalidateOnReconnect: true, // Refetch when connection is restored
  dedupingInterval: 60000, // Dedupe requests within 1 minute
  keepPreviousData: true, // Keep showing old data while fetching new
  errorRetryCount: 3, // Retry failed requests 3 times
};

// Hook for fetching members with caching
export function useMembers(gymId, options = {}) {
  const key = gymId
    ? JSON.stringify({
        table: "members",
        query: `
          id,
          full_name,
          phone,
          email,
          balance,
          gym_id,
          created_at,
          memberships (
            id,
            plan_id,
            start_date,
            end_date,
            status,
            membership_plans (
              name,
              price,
              duration_days
            )
          )
        `,
        gymId,
        options: {
          order: { column: "created_at", ascending: false },
        },
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    ...defaultConfig,
    ...options,
  });

  return {
    members: data || [],
    isLoading,
    isValidating, // True when revalidating in background
    error,
    refresh: mutate, // Call this to force refresh
  };
}

// Hook for fetching attendance with caching
export function useAttendance(gymId, date, options = {}) {
  const key = gymId && date
    ? JSON.stringify({
        table: "attendance",
        query: `
          id,
          member_id,
          check_in_time,
          check_out_time,
          count,
          members (
            id,
            full_name,
            phone
          )
        `,
        gymId,
        options: {
          eq: { check_in_date: date },
          order: { column: "check_in_time", ascending: false },
        },
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    ...defaultConfig,
    ...options,
  });

  return {
    attendance: data || [],
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}

// Hook for fetching membership plans with caching
export function useMembershipPlans(gymId, options = {}) {
  const key = gymId
    ? JSON.stringify({
        table: "membership_plans",
        query: "*",
        gymId,
        options: {
          order: { column: "name", ascending: true },
        },
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    ...defaultConfig,
    ...options,
  });

  return {
    plans: data || [],
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}

// Hook for fetching announcements with caching
export function useAnnouncements(gymId, options = {}) {
  const key = gymId
    ? JSON.stringify({
        table: "announcements",
        query: "*",
        gymId,
        options: {
          order: { column: "created_at", ascending: false },
        },
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    ...defaultConfig,
    ...options,
  });

  return {
    announcements: data || [],
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}

// Hook for fetching expenses with caching
export function useExpenses(gymId, options = {}) {
  const key = gymId
    ? JSON.stringify({
        table: "expenses",
        query: "*",
        gymId,
        options: {
          order: { column: "expense_date", ascending: false },
        },
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    ...defaultConfig,
    ...options,
  });

  return {
    expenses: data || [],
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}

// Hook for fetching transactions/payments with caching
export function useTransactions(gymId, options = {}) {
  const key = gymId
    ? JSON.stringify({
        table: "payments",
        query: `
          *,
          members (
            id,
            full_name,
            phone
          )
        `,
        gymId,
        options: {
          order: { column: "payment_date", ascending: false },
        },
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    ...defaultConfig,
    ...options,
  });

  return {
    transactions: data || [],
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}

// Hook for fetching gym settings with caching
export function useGymSettings(gymId, options = {}) {
  const key = gymId
    ? JSON.stringify({
        table: "gyms",
        query: "*",
        options: {
          eq: { id: gymId },
          limit: 1,
        },
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    ...defaultConfig,
    ...options,
  });

  return {
    gym: data?.[0] || null,
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}

// Hook for fetching staff with caching
export function useStaff(gymId, options = {}) {
  const key = gymId
    ? JSON.stringify({
        table: "staff",
        query: "*",
        gymId,
        options: {
          order: { column: "created_at", ascending: false },
        },
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    ...defaultConfig,
    ...options,
  });

  return {
    staff: data || [],
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}

// Hook for fetching workout plans with caching
export function useWorkoutPlans(gymId, options = {}) {
  const key = gymId
    ? JSON.stringify({
        table: "workout_plans",
        query: "*",
        gymId,
        options: {
          order: { column: "name", ascending: true },
        },
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    ...defaultConfig,
    ...options,
  });

  return {
    workoutPlans: data || [],
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}

// Hook for fetching diet plans with caching
export function useDietPlans(gymId, options = {}) {
  const key = gymId
    ? JSON.stringify({
        table: "diet_plans",
        query: "*",
        gymId,
        options: {
          order: { column: "name", ascending: true },
        },
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    ...defaultConfig,
    ...options,
  });

  return {
    dietPlans: data || [],
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}

// Generic hook for custom queries with caching
export function useSupabaseQuery(table, query, gymId, customOptions = {}, swrOptions = {}) {
  const key = table
    ? JSON.stringify({
        table,
        query,
        gymId,
        options: customOptions,
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    ...defaultConfig,
    ...swrOptions,
  });

  return {
    data: data || [],
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}

// Utility to invalidate/refresh all cache for a gym
export function useInvalidateGymCache() {
  const { mutate } = useSWR(null);
  
  return (gymId) => {
    // This will revalidate all keys that match the gymId
    mutate(
      (key) => {
        if (!key) return false;
        try {
          const parsed = JSON.parse(key);
          return parsed.gymId === gymId;
        } catch {
          return false;
        }
      },
      undefined,
      { revalidate: true }
    );
  };
}
