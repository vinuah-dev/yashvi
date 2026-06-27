"use client";

import { useEffect } from "react";
import { useMembers, useMembershipPlans, useAnnouncements } from "@/lib/hooks/useDataCache";

/**
 * DataPrefetcher - Preloads common data when the app mounts
 * This component renders nothing but triggers data fetching in the background
 * so that when users navigate to different pages, data is already cached.
 */
export function DataPrefetcher({ gymId }) {
  // Prefetch members data (used on Members, Attendance, Finance pages)
  useMembers(gymId, { 
    revalidateOnMount: true,
    revalidateIfStale: true,
  });

  // Prefetch membership plans (used on Members, Add Member pages)
  useMembershipPlans(gymId, {
    revalidateOnMount: true,
    revalidateIfStale: true,
  });

  // Prefetch announcements (used on Dashboard, Announcements pages)
  useAnnouncements(gymId, {
    revalidateOnMount: true,
    revalidateIfStale: true,
  });

  return null; // This component doesn't render anything
}

/**
 * Hook to get the current gym from localStorage
 * Can be used anywhere in the app to get the selected gym
 */
export function useSelectedGym() {
  const getGym = () => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("selectedGym");
    return stored ? JSON.parse(stored) : null;
  };

  return getGym();
}
