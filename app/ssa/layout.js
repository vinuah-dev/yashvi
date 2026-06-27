"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function SSALayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Login page doesn't need auth check
    if (pathname === "/ssa/login") {
      setChecking(false);
      return;
    }

    const token = localStorage.getItem("ssa_token");
    if (!token) {
      router.replace("/ssa/login");
      return;
    }

    fetch("/api/ssa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", token }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.valid) {
          localStorage.removeItem("ssa_token");
          localStorage.removeItem("ssa_user");
          router.replace("/ssa/login");
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        router.replace("/ssa/login");
      });
  }, [pathname]);

  if (checking && pathname !== "/ssa/login") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
