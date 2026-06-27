"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useRouter } from "next/navigation";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Get initial user state (session is automatically restored from localStorage)
    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setUser(data?.user ?? null);
      } catch (error) {
        console.error("Error getting user:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const newUser = session?.user ?? null;
        setUser(newUser);
        
        if (event === "SIGNED_OUT") {
          router.push("/auth/login");
        } else if (event === "INITIAL_SESSION" && newUser) {
          // Session was restored from localStorage
          console.log("Session restored for:", newUser.name || newUser.email);
        }
      }
    );

    // Refresh session periodically (every 5 minutes) to extend expiry
    const refreshInterval = setInterval(() => {
      supabase.auth.refreshSession();
    }, 5 * 60 * 1000);

    return () => {
      listener?.subscription?.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [router]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/auth/login");
  }, [router]);

  const isAdmin = user?.role === "owner" || user?.role === "admin" || user?.role === "view_only";
  const isTrainer = user?.role === "trainer";
  const isMember = user?.role === "member";

  return { 
    user, 
    loading, 
    signOut,
    isAdmin,
    isTrainer,
    isMember,
    isAuthenticated: !!user 
  };
}
