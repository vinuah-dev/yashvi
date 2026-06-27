"use client";

import { SWRConfig } from "swr";

// Global SWR configuration
const swrConfig = {
  // Keep data fresh for 5 minutes
  dedupingInterval: 5 * 60 * 1000,
  
  // Don't refetch on window focus to reduce unnecessary requests
  revalidateOnFocus: false,
  
  // Refetch when network reconnects
  revalidateOnReconnect: true,
  
  // Keep showing stale data while fetching new data
  keepPreviousData: true,
  
  // Error retry configuration
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  
  // Cache provider using localStorage for persistence
  provider: () => {
    // Check if we're in the browser
    if (typeof window === "undefined") {
      return new Map();
    }

    // Initialize cache from localStorage
    const map = new Map();
    
    try {
      const stored = localStorage.getItem("swr-cache");
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        
        // Only restore data that's less than 10 minutes old
        Object.entries(parsed).forEach(([key, value]) => {
          if (value.timestamp && now - value.timestamp < 10 * 60 * 1000) {
            map.set(key, value.data);
          }
        });
      }
    } catch (e) {
      console.warn("Failed to restore SWR cache:", e);
    }

    // Save cache to localStorage periodically
    const saveToStorage = () => {
      try {
        const cacheData = {};
        map.forEach((value, key) => {
          // Only cache successful data (not errors)
          if (value && !value.error) {
            cacheData[key] = {
              data: value,
              timestamp: Date.now(),
            };
          }
        });
        localStorage.setItem("swr-cache", JSON.stringify(cacheData));
      } catch (e) {
        console.warn("Failed to save SWR cache:", e);
      }
    };

    // Save cache every 30 seconds
    const interval = setInterval(saveToStorage, 30000);

    // Save on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", saveToStorage);
    }

    // Cleanup function
    const originalClear = map.clear.bind(map);
    map.clear = () => {
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", saveToStorage);
        localStorage.removeItem("swr-cache");
      }
      originalClear();
    };

    return map;
  },
};

export function SWRProvider({ children }) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
