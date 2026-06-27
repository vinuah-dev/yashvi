"use client";

import useSWR from "swr";
import { useAuthContext } from "@/contexts/AuthContext";

// ─── Shared fetcher ─────────────────────────────────────────
// All API routes use POST with JSON body. This fetcher sends
// the user ID in headers for the apiMiddleware to pick up.
async function apiFetcher([url, body, userId]) {
  const headers = { "Content-Type": "application/json" };
  if (userId) headers["x-user-id"] = String(userId);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = new Error("API request failed");
    err.status = res.status;
    try {
      const json = await res.json();
      err.message = json.error || err.message;
    } catch {}
    throw err;
  }

  const json = await res.json();
  return json.data;
}

// ─── Dashboard Data ─────────────────────────────────────────
export function useDashboardData(gymId) {
  const { user } = useAuthContext();
  const userId = user?.id || null;

  const key = gymId
    ? ["/api/dashboard/data", { p_gym_id: gymId, p_user_id: userId }, userId]
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, apiFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000, // 1 min dedup
    keepPreviousData: true,
  });

  return { data, error, isLoading, isValidating, mutate };
}

// ─── Members Stats ──────────────────────────────────────────
export function useMemberStats(gymId, isTrainer) {
  const { user } = useAuthContext();
  const userId = user?.id || null;

  const key = gymId
    ? [
        "/api/members/stats",
        {
          p_gym_id: gymId,
          p_user_id: userId,
          p_is_trainer: isTrainer || false,
        },
        userId,
      ]
    : null;

  const { data, error, isLoading, mutate } = useSWR(key, apiFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });

  return {
    stats: data
      ? {
          total: data.total || 0,
          active: data.active || 0,
          expired: data.expired || 0,
          dues: data.dues || 0,
          renewal: data.renewal || 0,
          my_members: data.my_members || 0,
        }
      : { total: 0, active: 0, expired: 0, dues: 0, renewal: 0, my_members: 0 },
    error,
    isLoading,
    mutate,
  };
}

// ─── Members List (paginated) ───────────────────────────────
export function useMembersList({
  gymId,
  search = "",
  status = "all",
  page = 1,
  pageSize = 20,
  isTrainer = false,
  showMyMembers = false,
}) {
  const { user } = useAuthContext();
  const userId = user?.id || null;

  const key = gymId
    ? [
        "/api/members/list",
        {
          p_gym_id: gymId,
          p_search: search,
          p_status: status,
          p_page: page,
          p_page_size: pageSize,
          p_user_id: userId,
          p_is_trainer: isTrainer,
          p_show_my_members: showMyMembers,
        },
        userId,
      ]
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, apiFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });

  return {
    members: data?.members || [],
    totalCount: data?.total_count || 0,
    totalPages: data?.total_pages || 1,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}

// ─── Member Details ─────────────────────────────────────────
export function useMemberDetails(memberId, gymId) {
  const key =
    memberId && gymId
      ? ["/api/members/details", { p_member_id: memberId, p_gym_id: gymId }, null]
      : null;

  const { data, error, isLoading, mutate } = useSWR(key, apiFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  return { data, error, isLoading, mutate };
}

// ─── Finance Data ───────────────────────────────────────────
export function useFinanceData(gymId, periodStart, periodEnd) {
  const { user } = useAuthContext();
  const userId = user?.id || null;

  const key =
    gymId && periodStart && periodEnd
      ? [
          "/api/finance/data",
          {
            p_gym_id: gymId,
            p_period_start: periodStart,
            p_period_end: periodEnd,
            p_business_tz:
              typeof Intl !== "undefined"
                ? Intl.DateTimeFormat().resolvedOptions().timeZone
                : "Asia/Kolkata",
          },
          userId,
        ]
      : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, apiFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });

  return { data, error, isLoading, isValidating, mutate };
}

// ─── Trainer History ────────────────────────────────────────
export function useTrainerHistory(memberId) {
  const { user } = useAuthContext();
  const userId = user?.id || null;

  // This endpoint uses GET with query params
  const key =
    memberId && userId
      ? [`trainer-history-${memberId}-${userId}`, memberId, userId]
      : null;

  const { data, error, isLoading } = useSWR(
    key,
    async () => {
      const res = await fetch(
        `/api/member/${memberId}/trainer-history?p_user_id=${encodeURIComponent(userId)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  return {
    assignments: data?.assignments || [],
    error,
    isLoading,
  };
}
