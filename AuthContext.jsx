"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { OWNER_PERMISSIONS } from "@/lib/constants/permissions";

const AuthContext = createContext(null);

// ─── Lightweight sync read (no IndexedDB) ──────────────────
// IndexedDB is async and slow (~10-50ms per read).
// localStorage is sync and ~0.1ms. We read localStorage ONCE
// and share via context. The SessionRestoration component
// already syncs IndexedDB → localStorage on app start.
function readUserFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("gymUser");
    if (!raw) return null;
    const user = JSON.parse(raw);
    // Check expiry
    const expiry = localStorage.getItem("gymUserExpiry");
    if (expiry && Date.now() > parseInt(expiry, 10)) {
      localStorage.removeItem("gymUser");
      localStorage.removeItem("gymUserExpiry");
      localStorage.removeItem("selectedGym");
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

function readGymFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("selectedGym");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function resolvePermissions(role, userPermissions) {
  if (role === "owner" || role === "view_only") return OWNER_PERMISSIONS;
  if (role === "admin" && userPermissions) return userPermissions;
  if (role === "trainer") {
    return {
      dashboard: true,
      members: true,
      attendance: true,
      announcements: true,
      finance: false,
      analytics: true,
      monitoring: true,
      settings: true,
      inquiries: true,
    };
  }
  if (role === "member") {
    return {
      dashboard: true,
      profile: true,
      schedule: true,
      diet: true,
      workout: true,
      announcements: true,
    };
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readUserFromStorage());
  const [selectedGym, setSelectedGymState] = useState(() => readGymFromStorage());
  const [isReady, setIsReady] = useState(() => typeof window !== "undefined");

  // On mount, mark ready (covers SSR hydration)
  useEffect(() => {
    if (!isReady) {
      const u = readUserFromStorage();
      const g = readGymFromStorage();
      setUser(u);
      setSelectedGymState(g);
      setIsReady(true);
    }
  }, [isReady]);

  // Listen for storage changes (other tabs, SessionRestoration updates)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "gymUser") {
        setUser(e.newValue ? JSON.parse(e.newValue) : null);
      }
      if (e.key === "selectedGym") {
        setSelectedGymState(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSelectedGym = useCallback((gym) => {
    setSelectedGymState(gym);
    if (gym) {
      localStorage.setItem("selectedGym", JSON.stringify(gym));
    } else {
      localStorage.removeItem("selectedGym");
    }
  }, []);

  const updateUser = useCallback((newUser) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem("gymUser", JSON.stringify(newUser));
    } else {
      localStorage.removeItem("gymUser");
      localStorage.removeItem("gymUserExpiry");
      localStorage.removeItem("selectedGym");
      setSelectedGymState(null);
    }
  }, []);

  // Derived values — computed once, shared everywhere
  const role = user?.role || null;
  const permissions = useMemo(
    () => resolvePermissions(role, user?.permissions),
    [role, user?.permissions]
  );

  const derived = useMemo(() => ({
    isOwner: role === "owner",
    isAdmin: role === "admin",
    isViewOnly: role === "view_only",
    isTrainer: role === "trainer",
    isMember: role === "member",
    canAccessAdmin: ["owner", "admin", "view_only", "trainer"].includes(role),
    canViewFinance: ["owner", "admin", "view_only"].includes(role),
    canViewMemberDues: ["owner", "admin", "trainer"].includes(role),
    canCreateTrainer: ["owner", "admin"].includes(role),
    canManageStaff: ["owner", "admin"].includes(role),
    canWrite: ["owner", "admin", "trainer", "member"].includes(role),
  }), [role]);

  const value = useMemo(() => ({
    user,
    role,
    permissions,
    selectedGym,
    isReady,
    setSelectedGym,
    updateUser,
    ...derived,
  }), [user, role, permissions, selectedGym, isReady, setSelectedGym, updateUser, derived]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
