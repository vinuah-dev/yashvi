"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { OWNER_PERMISSIONS } from "@/lib/constants/permissions";
import { supabase } from "@/lib/supabaseClient";

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
    if (raw) return JSON.parse(raw);

    const userRaw = localStorage.getItem("gymUser");
    if (!userRaw) return null;

    const storedUser = JSON.parse(userRaw);
    const storedGymId = storedUser?.role === "trainer"
      ? storedUser.gym_id || storedUser.gymId
      : null;

    if (!storedGymId) return null;

    const fallbackGym = {
      id: storedGymId,
      name: storedUser.gym_name || storedUser.gymName || "Trainer Gym",
    };

    localStorage.setItem("selectedGym", JSON.stringify(fallbackGym));
    return fallbackGym;
  } catch {
    return null;
  }
}

function resolvePermissions(role, userPermissions) {
  if (role === "superadmin" || role === "owner" || role === "view_only") return OWNER_PERMISSIONS;
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
  const pathname = usePathname();
  const role = user?.role || null;
  const userGymId = user?.gym_id || user?.gymId || null;
  const userGymName = user?.gym_name || user?.gymName || "Trainer Gym";

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

  // Re-sync from localStorage on EVERY route change.
  // This catches same-tab writes (login page → dashboard).
  // The `storage` event only fires for OTHER tabs, so without
  // this, after login the AuthContext still has user=null.
  useEffect(() => {
    const u = readUserFromStorage();
    const g = readGymFromStorage();
    
    // Only update if actually different to avoid unnecessary re-renders
    setUser((prev) => {
      if (prev?.id === u?.id && prev?.role === u?.role) return prev;
      return u;
    });
    setSelectedGymState((prev) => {
      if (prev?.id === g?.id) return prev;
      return g;
    });
  }, [pathname]);

  // Listen for storage changes (other tabs)
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

  useEffect(() => {
    if (role !== "trainer" || !userGymId || selectedGym?.id) return;

    let cancelled = false;

    const fallbackGym = {
      id: userGymId,
      name: userGymName,
    };

    const hydrateTrainerGym = async () => {
      try {
        const { data } = await supabase
          .from("gyms")
          .select("id, name, address, timezone, created_at, logo_url, plan:plan_type")
          .eq("id", userGymId)
          .maybeSingle();

        if (cancelled) return;

        const gym = data?.id ? data : fallbackGym;
        setSelectedGymState(gym);
        localStorage.setItem("selectedGym", JSON.stringify(gym));
      } catch (error) {
        console.error("Error hydrating trainer gym:", error);
        if (!cancelled) {
          setSelectedGymState(fallbackGym);
          localStorage.setItem("selectedGym", JSON.stringify(fallbackGym));
        }
      }
    };

    hydrateTrainerGym();

    return () => {
      cancelled = true;
    };
  }, [role, userGymId, userGymName, selectedGym?.id]);

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
  const permissions = useMemo(
    () => resolvePermissions(role, user?.permissions),
    [role, user?.permissions]
  );

  const derived = useMemo(() => ({
    isOwner: role === "owner",
    isSuperAdmin: role === "superadmin",
    isAdmin: role === "admin",
    isViewOnly: role === "view_only",
    isTrainer: role === "trainer",
    isMember: role === "member",
    canAccessAdmin: ["superadmin", "owner", "admin", "view_only", "trainer"].includes(role),
    canViewFinance: ["superadmin", "owner", "admin", "view_only"].includes(role),
    canViewMemberDues: ["superadmin", "owner", "admin", "trainer"].includes(role),
    canCreateTrainer: ["superadmin", "owner", "admin"].includes(role),
    canManageStaff: ["superadmin", "owner", "admin"].includes(role),
    canWrite: ["superadmin", "owner", "admin", "trainer", "member"].includes(role),
    canManageAdmins: role === "superadmin",
  }), [role]);

  const effectiveSelectedGym = useMemo(() => {
    if (selectedGym?.id) return selectedGym;
    if (role === "trainer" && userGymId) {
      return {
        id: userGymId,
        name: userGymName,
      };
    }
    return selectedGym;
  }, [role, selectedGym, userGymId, userGymName]);

  const value = useMemo(() => ({
    user,
    role,
    permissions,
    selectedGym: effectiveSelectedGym,
    isReady,
    setSelectedGym,
    updateUser,
    ...derived,
  }), [user, role, permissions, effectiveSelectedGym, isReady, setSelectedGym, updateUser, derived]);

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
