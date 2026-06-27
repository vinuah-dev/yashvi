"use client";

import { useEffect } from "react";
import BottomNav from "@/components/layout/BottomNav";
import RouteProtection from "@/components/shared/RouteProtectionOptimized";
import { runStartupCleanup } from "@/lib/receiptCleanup";
import { useAuthContext } from "@/contexts/AuthContext";

export default function AdminLayout({ children }) {
  const { role } = useAuthContext();

  // Run expired receipt cleanup once per day
  useEffect(() => {
    runStartupCleanup();
  }, []);

  // Trainers use admin routes, so keep "admin" for nav
  const navRole = role === "trainer" ? "admin" : (role || "admin");

  return (
    <RouteProtection>
      <div>
        {children}
        <BottomNav role={navRole} />
      </div>
    </RouteProtection>
  );
}
