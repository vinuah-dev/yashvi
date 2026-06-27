"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  CalendarCheck,
  CreditCard,
  ShoppingBag,
  BookOpen,
  Settings,
} from "lucide-react";

import BottomNav from "@/components/layout/BottomNav";
import RoleShell from "@/components/layout/RoleShell";
import RouteProtection from "@/components/shared/RouteProtection";
import { runStartupCleanup } from "@/lib/receiptCleanup";
import { useAuthContext } from "@/contexts/AuthContext";

const desktopNavItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Home },
  { href: "/members", label: "Members", icon: Users },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/finance", label: "Finance", icon: CreditCard },
  { href: "/admin/shop", label: "Shop", icon: ShoppingBag },
  { href: "/admin/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-72 bg-white border-r border-[#ececec] shadow-[10px_0_40px_rgba(0,0,0,0.04)] flex-col z-40">
      <div className="p-6 border-b border-[#f1f1f1]">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f0813d] to-[#9c4400] flex items-center justify-center text-white font-black text-xl shadow-[0_12px_30px_rgba(240,129,61,0.25)]">
          G
        </div>
        <h2 className="mt-4 text-xl font-black text-[#1a1c1c] tracking-tight">
          Gym OS
        </h2>
        <p className="text-sm text-[#897267] mt-1">
          Premium management
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {desktopNavItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 font-bold ${
                active
                  ? "bg-[#f0813d] text-white shadow-[0_10px_25px_rgba(240,129,61,0.25)]"
                  : "text-[#5f5e5e] hover:bg-[#f7f4f2] hover:text-[#1a1c1c]"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default function AdminLayout({ children }) {
  const { role } = useAuthContext();

  useEffect(() => {
    runStartupCleanup();
  }, []);

  const navRole = role || "admin";

  if (role === "trainer") {
    return (
      <RouteProtection>
        <RoleShell role="trainer">{children}</RoleShell>
      </RouteProtection>
    );
  }

  return (
    <RouteProtection>
      <div className="min-h-screen bg-[#f1efed] font-sans">
        <DesktopSidebar />

        <div className="w-full md:pl-72 min-h-screen">
          <div className="relative flex flex-col w-full min-h-screen overflow-hidden max-w-md md:max-w-full mx-auto">
            <div className="flex-1 overflow-y-auto pb-24 md:pb-6 no-scrollbar">
              {children}
            </div>

            <BottomNav role={navRole} />
          </div>
        </div>
      </div>
    </RouteProtection>
  );
}
