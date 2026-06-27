"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthContext } from "@/contexts/AuthContext";
import { hasRouteAccess } from "@/lib/constants/permissions";

/**
 * Optimized route protection — uses shared AuthContext
 * instead of reading IndexedDB separately.
 * Renders children immediately once auth is ready.
 */
export default function RouteProtection({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, permissions, isReady } = useAuthContext();
  const [authorized, setAuthorized] = useState(false);

  // Handle browser back/forward navigation and bfcache
  useEffect(() => {
    const checkAuthOnPageShow = (e) => {
      if (e.persisted) {
        const u = localStorage.getItem("gymUser");
        if (!u) window.location.replace("/auth/login");
      }
    };

    const checkAuthOnPopState = () => {
      const u = localStorage.getItem("gymUser");
      if (!u) window.location.replace("/auth/login");
    };

    window.addEventListener("pageshow", checkAuthOnPageShow);
    window.addEventListener("popstate", checkAuthOnPopState);

    return () => {
      window.removeEventListener("pageshow", checkAuthOnPageShow);
      window.removeEventListener("popstate", checkAuthOnPopState);
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;

    if (!role) {
      // Before redirecting, do a direct localStorage check.
      // After login, AuthContext may not have re-synced yet
      // (same-tab writes don't trigger storage events).
      const raw = localStorage.getItem("gymUser");
      if (raw) {
        // localStorage has user data but AuthContext hasn't caught up.
        // Don't redirect — AuthContext will re-sync on next render cycle.
        return;
      }
      router.replace("/auth/login");
      return;
    }

    const hasAccess = hasRouteAccess(permissions, pathname);

    if (!hasAccess) {
      router.replace("/admin/dashboard");
      return;
    }

    setAuthorized(true);
  }, [permissions, isReady, role, pathname, router]);

  if (!isReady || !authorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#f0813d] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
