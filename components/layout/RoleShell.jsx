"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Apple,
  Activity,
  BookOpen,
  CalendarCheck,
  Dumbbell,
  Home,
  ShoppingBag,
  Settings,
  Trophy,
  User,
  Users,
} from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";

const memberNavItems = [
  { href: "/user/dashboard", label: "Home", icon: Home },
  { href: "/health-tracker", label: "Health", icon: Activity },
  { href: "/workout", label: "Workout", icon: Dumbbell },
  { href: "/diet", label: "Diet", icon: Apple },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/knowledge", label: "Know", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: User },
];

const trainerNavItems = [
  { href: "/trainer/dashboard", label: "Home", icon: Home },
  { href: "/members", label: "Members", icon: Users },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/settings/diet-plans", label: "Diet", icon: Apple },
  { href: "/settings/workout-plans", label: "Workout", icon: Dumbbell },
  { href: "/admin/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

const memberPrefetchPaths = [
  "/user/dashboard",
  "/health-tracker",
  "/workout",
  "/diet",
  "/leaderboard",
  "/shop",
  "/knowledge",
  "/profile",
  "/my-attendance",
  "/schedule",
  "/user/announcements",
];

function DesktopNav({ role }) {
  const pathname = usePathname();
  const [gymName, setGymName] = useState("");
  const navItems = role === "trainer" ? trainerNavItems : memberNavItems;
  const homePath = navItems[0]?.href;

  useEffect(() => {
    let cancelled = false;

    const fetchGym = async (gymId) => {
      if (!gymId) return false;
      const { supabase } = await import("@/lib/supabaseClient");
      const { data } = await supabase
        .from("gyms")
        .select("name, logo_url")
        .eq("id", gymId)
        .maybeSingle();

      if (!cancelled && data) {
        setGymName(data.name || "");
        return true;
      }

      return false;
    };

    const resolveGymBrand = async () => {
      const storedGym = localStorage.getItem("selectedGym");
      if (storedGym) {
        try {
          const gym = JSON.parse(storedGym);
          setGymName(gym.name || "");
          if (await fetchGym(gym.id)) return;
        } catch (error) {
          console.error("Error parsing selectedGym", error);
        }
      }

      const storedUser = localStorage.getItem("gymUser");
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          setGymName(user.gym_name || user.gymName || "");
          if (await fetchGym(user.gym_id || user.gymId)) return;
        } catch (error) {
          console.error("Error parsing gymUser", error);
        }
      }

      const storedMember = localStorage.getItem("member");
      if (storedMember) {
        try {
          const member = JSON.parse(storedMember);
          if (await fetchGym(member.gym_id || member.gymId)) return;

          const { supabase } = await import("@/lib/supabaseClient");
          const { data } = await supabase
            .from("members")
            .select("gym_id")
            .eq("id", member.id)
            .maybeSingle();
          await fetchGym(data?.gym_id);
        } catch (error) {
          console.error("Error fetching member gym logo", error);
        }
      }
    };

    resolveGymBrand();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="hidden md:block sticky top-0 z-[90] border-b-[5px] border-black bg-white px-6 py-4 shadow-[0_8px_0_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
        <Link href={homePath} className="flex items-center gap-3">
          <img
            src="/icons/ss-hexagon.svg"
            alt="SS hexagon"
            className="h-11 w-11 shrink-0"
          />
          <div
            className={`flex min-w-0 items-center gap-2 ${
              role === "trainer"
                ? ""
                : "rounded-2xl border border-orange-300 bg-[#f0813d] px-3 py-2 shadow-[0_8px_20px_rgba(240,129,61,0.24)]"
            }`}
          >
            <p className="truncate text-sm font-black uppercase tracking-widest text-black">
              {gymName || (role === "trainer" ? "Trainer Portal" : "Member Portal")}
            </p>
            {role !== "trainer" && (
              <span className="shrink-0 rounded-lg bg-black px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white">
                Member
              </span>
            )}
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== homePath && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition duration-150 ${
                  active
                    ? "bg-[#f0813d] text-black shadow-[0_12px_30px_rgba(240,129,61,0.24)]"
                    : "text-[#897267] hover:bg-[#f0813d]/10 hover:text-[#1a1c1c]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export default function RoleShell({ children, role }) {
  const isTrainer = role === "trainer";
  const router = useRouter();

  useEffect(() => {
    const paths = isTrainer
      ? trainerNavItems.map((item) => item.href)
      : memberPrefetchPaths;
    const prefetchRoutes = () => {
      paths.forEach((path) => router.prefetch(path));
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(prefetchRoutes, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timerId = window.setTimeout(prefetchRoutes, 250);
    return () => window.clearTimeout(timerId);
  }, [isTrainer, router]);

  return (
    <div
      className={`fixed inset-0 overflow-hidden font-sans md:static md:min-h-screen md:overflow-visible ${
        isTrainer
          ? "trainer-balanced-theme bg-[#ece7e3]"
          : "member-rank-theme bg-[#f3f4f6] text-[#1a1c1c]"
      }`}
    >
      <DesktopNav role={role} />
      <div
        className={`mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden md:h-auto md:min-h-[calc(100vh-80px)] md:max-w-6xl md:overflow-visible md:bg-transparent md:px-6 md:py-6 ${
          isTrainer ? "bg-[#ece7e3]" : "bg-[#f3f4f6]"
        }`}
      >
        <div className="app-content-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 no-scrollbar md:overflow-visible md:pb-8">
          {children}
        </div>
        <BottomNav role={role} />
      </div>
    </div>
  );
}
