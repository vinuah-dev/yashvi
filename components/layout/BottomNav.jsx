
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  UserCog,
  CalendarCheck,
  Megaphone,
  CreditCard,
  Settings,
  User,
  Dumbbell,
  Apple,
  Bell,
  Trophy,
  ShoppingBag,
  BookOpen,
  Activity,
} from "lucide-react";

import { usePermissions } from "@/lib/hooks/usePermissions";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { hasPermission, PERMISSIONS } from "@/lib/constants/permissions";

const allAdminNavItems = [
  {
    href: "/admin/dashboard",
    label: "Home",
    icon: <Home className="w-[1.2rem] h-[1.2rem]" />,
    permission: PERMISSIONS.DASHBOARD,
  },
  {
    href: "/members",
    label: "Members",
    icon: <Users className="w-[1.2rem] h-[1.2rem]" />,
    permission: PERMISSIONS.MEMBERS,
  },
  {
    href: "/trainers",
    label: "Trainers",
    icon: <UserCog className="w-[1.2rem] h-[1.2rem]" />,
    permission: PERMISSIONS.SETTINGS,
    // Trainers used to sit inside Settings, gated by canCreateTrainer. Keeping
    // that gate here means promoting it to the main nav doesn't hand trainer
    // management to anyone who couldn't already reach it.
    requiresTrainerAccess: true,
  },
  {
    href: "/attendance",
    label: "Attendance",
    icon: <CalendarCheck className="w-[1.2rem] h-[1.2rem]" />,
    permission: PERMISSIONS.ATTENDANCE,
  },
  {
    href: "/finance",
    label: "Finance",
    icon: <CreditCard className="w-[1.2rem] h-[1.2rem]" />,
    permission: PERMISSIONS.FINANCE,
  },
  {
    href: "/admin/shop",
    label: "Shop",
    icon: <ShoppingBag className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/admin/knowledge",
    label: "Know",
    icon: <BookOpen className="w-[1.2rem] h-[1.2rem]" />,
    permission: PERMISSIONS.ANNOUNCEMENTS,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <Settings className="w-[1.2rem] h-[1.2rem]" />,
    permission: PERMISSIONS.SETTINGS,
  },
];

const trainerNavItems = [
  {
    href: "/trainer/dashboard",
    label: "Home",
    icon: <Home className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/members",
    label: "Members",
    icon: <Users className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/attendance",
    label: "Attend",
    icon: <CalendarCheck className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/settings/diet-plans",
    label: "Diet",
    icon: <Apple className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/settings/workout-plans",
    label: "Workout",
    icon: <Dumbbell className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/admin/knowledge",
    label: "Know",
    icon: <BookOpen className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <Settings className="w-[1.2rem] h-[1.2rem]" />,
  },
];

const customerNavItems = [
  {
    href: "/user/dashboard",
    label: "Home",
    icon: <Home className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/health-tracker",
    label: "Health",
    icon: <Activity className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/workout",
    label: "Workout",
    icon: <Dumbbell className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/diet",
    label: "Diet",
    icon: <Apple className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/leaderboard",
    label: "Ranks",
    icon: <Trophy className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/shop",
    label: "Shop",
    icon: <ShoppingBag className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/knowledge",
    label: "Know",
    icon: <BookOpen className="w-[1.2rem] h-[1.2rem]" />,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: <User className="w-[1.2rem] h-[1.2rem]" />,
  },
];

export default function BottomNav({ role = "admin" }) {
  const pathname = usePathname();
  const { permissions } = usePermissions();
  const { canCreateTrainer } = useUserRole();

  const getNavItems = () => {
    switch (role) {
      case "trainer":
        return trainerNavItems;

      case "customer":
      case "member":
        return customerNavItems;

      case "admin":
      case "owner":
        if (!permissions) {
          return allAdminNavItems.filter(
            (item) => !item.requiresTrainerAccess || canCreateTrainer,
          );
        }

        return allAdminNavItems.filter(
          (item) =>
            (!item.permission || hasPermission(permissions, item.permission)) &&
            (!item.requiresTrainerAccess || canCreateTrainer)
        );

      default:
        return allAdminNavItems;
    }
  };

  const navItems = getNavItems();
  const homePath = navItems[0]?.href;
  const isCompact = navItems.length > 5;

  return (
   <div className="app-bottom-nav fixed bottom-4 left-0 right-0 z-50 px-3 pointer-events-none md:hidden">
      <nav className="pointer-events-auto mx-auto max-w-md">
        <div
          className="
            relative
            overflow-hidden
            rounded-[2rem]
            border
            border-white/10
            bg-white/75
            backdrop-blur-2xl
            shadow-[0_20px_60px_rgba(15,15,15,0.18)]
          "
        >
          {/* Ambient Glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#f0813d]/5 via-transparent to-[#f0813d]/5 pointer-events-none" />

          {/* Top Highlight */}
          <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />

          <div className="relative flex items-center justify-around px-1.5 py-2">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== homePath && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className="relative flex min-w-0 flex-1 flex-col items-center justify-center"
                >
                  <div
                    className={`
                      relative
                      flex
                      flex-col
                      items-center
                      justify-center
                      rounded-2xl
                      ${isCompact ? "px-1" : "px-3"}
                      py-2
                      transition-all
                      duration-150
                      w-full
                      ${isCompact ? "min-w-0" : "min-w-[64px]"}
                      ${
                        isActive
                          ? "scale-105"
                          : "hover:scale-105 active:scale-95"
                      }
                    `}
                  >
                    {/* Active Background */}
                    {isActive && (
                      <>
                        <div
                          className="
                            absolute
                            inset-0
                            rounded-2xl
                            bg-gradient-to-br
                            from-[#f0813d]
                            via-[#f0813d]
                            to-[#f0813d]
                            shadow-[0_12px_30px_rgba(249,115,22,0.35)]
                          "
                        />

                        <div
                          className="
                            absolute
                            inset-[1px]
                            rounded-2xl
                            bg-gradient-to-br
                            from-[#f0813d]/90
                            to-[#f0813d]/90
                          "
                        />
                      </>
                    )}

                    {/* Icon */}
                    <div
                      className={`
                        relative
                        z-10
                        flex
                        items-center
                        justify-center
                        ${isCompact ? "w-8 h-8" : "w-10 h-10"}
                        rounded-xl
                        transition-all
                        duration-150
                        ${
                          isActive
                            ? "bg-white/20 text-white shadow-inner"
                            : "text-zinc-500 bg-transparent"
                        }
                      `}
                    >
                      {item.icon}
                    </div>

                    {/* Label */}
                    <span
                      className={`
                        relative
                        z-10
                        mt-1
                        ${isCompact ? "text-[8px] tracking-normal" : "text-[10px] tracking-[0.12em]"}
                        font-bold
                        uppercase
                        transition-all
                        duration-150
                        max-w-full
                        truncate
                        ${
                          isActive
                            ? "text-white"
                            : "text-zinc-500"
                        }
                      `}
                    >
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}


