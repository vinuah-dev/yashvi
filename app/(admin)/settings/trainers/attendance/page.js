"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Trainer attendance now lives on /attendance behind the Member/Trainer switch,
// so it is no longer a separate Settings screen. This redirect keeps old links
// and bookmarks working instead of 404ing.
export default function TrainerAttendanceRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/attendance");
  }, [router]);

  return null;
}
