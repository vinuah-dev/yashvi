"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { clearSession } from "@/lib/sessionStorage";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { hasPermission, PERMISSIONS } from "@/lib/constants/permissions";
import {
  Settings as SettingsIcon,
  Users,
  Calendar,
  Bell,
  Shield,
  FileText,
  Dumbbell,
  Utensils,
  HelpCircle,
  Database,
  ArrowLeft,
  LogOut,
  Smartphone,
  Clock,
  Activity,
  ChevronRight,
  Building,
  TrendingUp,
  Wrench,
  ClipboardList,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  User,
  Phone,
  Mail,
  CreditCard,
  Key,
  Trash2,
  RefreshCw,
  Package,
  ShieldAlert,
  Sparkles,
  Zap,
  Fingerprint,
  Trophy,
} from "lucide-react";

const settingsSections = [
  {
    id: "admins",
    title: "Manage Admins",
    description: "Add, remove, toggle admin access & permissions",
    icon: ShieldAlert,
    href: "/settings/admins",
    color: "from-[#f0813d] to-[#9c4400]",
    superadminOnly: true,
  },
  {
    id: "gym",
    title: "Gym Settings",
    description: "Name, address, operating hours, QR code",
    icon: Building,
    href: "/settings/gym",
    color: "from-[#f0813d] to-[#9c4400]"
  },
  {
    id: "inquiries",
    title: "Inquiries",
    description: "Track walk-ins, follow-ups & conversions",
    icon: ClipboardList,
    href: "/inquiries",
    color: "from-[#f0813d] to-[#9c4400]"
  },
  {
    id: "plans",
    title: "Membership Plans",
    description: "Create, edit plans, pricing, freeze options",
    icon: FileText,
    href: "/settings/plans",
    color: "from-[#f0813d] to-[#9c4400]"
  },
  {
    id: "diet-plans",
    title: "Diet Plans",
    description: "Create and manage diet plans with meals",
    icon: Utensils,
    href: "/settings/diet-plans",
    color: "from-[#f0813d] to-[#9c4400]"
  },
  {
    id: "workout-plans",
    title: "Workout Plans",
    description: "Create and manage workout routines",
    icon: Dumbbell,
    href: "/settings/workout-plans",
    color: "from-[#f0813d] to-[#9c4400]"
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Reminders, alerts, payment notifications",
    icon: Bell,
    href: "/settings/notifications",
    color: "from-[#f0813d] to-[#9c4400]"
  },
  {
    id: "trainers",
    title: "Trainers",
    description: "Manage trainers, plans & member assignments",
    icon: Shield,
    href: "/settings/trainers",
    color: "from-[#f0813d] to-[#9c4400]"
  },
  {
    id: "amenities",
    title: "Gym Amenities",
    description: "Locker, towel, parking & other amenities",
    icon: Package,
    href: "/settings/amenities",
    color: "from-[#f0813d] to-[#9c4400]"
  },
  {
    id: "leaderboard",
    title: "Leaderboard & Challenges",
    description: "Streak leaderboard, create challenges & manage scores",
    icon: Trophy,
    href: "/admin/leaderboard",
    color: "from-[#f0813d] to-[#9c4400]"
  },
  {
    id: "biometric-devices",
    title: "Biometric Devices",
    description: "Register fingerprint scanners (eSSL F22) for this gym",
    icon: Fingerprint,
    href: "/settings/biometric-devices",
    color: "from-[#f0813d] to-[#9c4400]"
  },
];

const quickActions = [
  {
    label: "Backup",
    icon: Database,
    action: "backup",
    description: "Create backup",
    color: "bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 border border-[#f0813d]/20"
  },
  {
    label: "Help",
    icon: HelpCircle,
    action: "help",
    description: "Get support",
    color: "bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 border border-[#f0813d]/20"
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { permissions } = usePermissions();
  const { canViewFinance, canCreateTrainer, user } = useUserRole();
  const [gymName, setGymName] = useState("Loading...");
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [appStats, setAppStats] = useState({
    version: "1.2.5",
    lastUpdated: "Jan 15, 2025",
    databaseSize: "2.4 GB"
  });

  // Filter quick actions based on role
  const filteredQuickActions = quickActions;
  const visibleSections = settingsSections.filter((section) => {
    if (section.superadminOnly && user?.role !== "superadmin") {
      return false;
    }
    if (!hasPermission(permissions, PERMISSIONS.MEMBERS)) {
      return !['plans', 'diet-plans', 'workout-plans'].includes(section.id);
    }
    if (!canCreateTrainer) {
      return !['gym', 'plans', 'trainers'].includes(section.id);
    }
    return true;
  });

  useEffect(() => {
    fetchGymData();
  }, []);

  const fetchGymData = async () => {
    try {
      setLoading(true);
      
      const storedGym = localStorage.getItem("selectedGym");
      if (!storedGym) {
        console.error("No gym selected");
        setLoading(false);
        router.push("/admin/dashboard");
        return;
      }

      const gym = JSON.parse(storedGym);
      setGymName(gym.name || "My Gym");

      const { count, error } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("gym_id", gym.id);

      if (error) throw error;
      setTotalMembers(count || 0);
    } catch (error) {
      console.error("Error fetching gym data:", error);
      const storedGym = localStorage.getItem("selectedGym");
      if (storedGym) {
        const gym = JSON.parse(storedGym);
        setGymName(gym.name || "My Gym");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action) => {
    switch (action) {
      case "backup":
        alert("Backup functionality coming soon!");
        break;
      case "help":
        alert("Contact details phone no - +91 7498341146                                       email id - shaibyasolutions@gmail.com");
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
      <Header title="Settings" showBack={false} />

      <main className="px-3 py-3 space-y-4">
        {/* <section className="relative mx-1 overflow-hidden rounded-2xl border border-[#9c4400]/20 bg-gradient-to-br from-[#f0813d] via-[#d76621] to-[#9c4400] p-5 shadow-xl shadow-orange-200/60">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.14),transparent_45%)]" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black leading-tight text-white truncate max-w-[220px]">
                {gymName || "Your Gym"}
              </h1>
              <div className="mt-2 flex items-center gap-2 text-white/80">
                <Users className="h-4 w-4" />
                <p className="text-sm font-semibold">{loading ? "..." : totalMembers} Members</p>
              </div>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 border border-white/20 backdrop-blur-sm">
              <Building className="h-7 w-7 text-white" />
            </div>
          </div>
        </section> */}

        {/* Gym Profile Card */}
        <div className="bg-gradient-to-br from-[#f0813d] to-[#9c4400] rounded-xl p-4 shadow-lg mx-1">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border-2 border-white/30">
              <Building className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{gymName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Users className="w-3.5 h-3.5 text-white/80" />
                <p className="text-white/90 text-sm font-semibold">{loading ? "..." : totalMembers} Members</p>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <SettingsIcon className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Settings</span>
          </div>
          
          <div className="space-y-3">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              return (
                <div
                  key={section.id}
                  onClick={() => !section.badge && router.push(section.href)}
                  className={`bg-white rounded-2xl border border-gray-200 p-3 hover:border-[#f0813d]/30 hover:shadow-lg active:scale-95 transition-all duration-200 ${section.badge ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${section.color} flex items-center justify-center shadow-md`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-black text-gray-900 text-sm truncate">
                          {section.title}
                        </h3>
                        {section.badge && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full whitespace-nowrap">
                            {section.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-2 truncate">
                        {section.description}
                      </p>
                      {!section.badge && (
                        <div className="flex items-center text-[#f0813d] text-xs font-bold">
                          <span>Configure</span>
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Quick Actions</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {quickActions
              .map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.action}
                  onClick={() => handleQuickAction(action.action)}
                  className={`${action.color} rounded-xl p-3 flex flex-col items-center gap-2 transition-all duration-200 hover:shadow-md active:scale-95`}
                >
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900 text-xs">
                      {action.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{action.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* App Information */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <Smartphone className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">App Information</span>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4 mx-1 space-y-3">
            {/* Version */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-gray-600 text-sm font-medium">v</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Version</p>
                  <p className="text-xs text-gray-500">Current app version</p>
                </div>
              </div>
              <span className="font-semibold text-gray-900 text-sm">{appStats.version}</span>
            </div>

            {/* Last Updated */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Last Updated</p>
                  <p className="text-xs text-gray-500">Most recent update</p>
                </div>
              </div>
              <span className="font-semibold text-gray-900 text-sm">{appStats.lastUpdated}</span>
            </div>

            {/* Total Members */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Total Members</p>
                  <p className="text-xs text-gray-500">Active member count</p>
                </div>
              </div>
              <span className="font-semibold text-gray-900 text-sm">
                {loading ? (
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                ) : (
                  totalMembers.toLocaleString()
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="space-y-3 px-1">
          {/* Back to Dashboard - Updated to Indigo Theme */}
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="w-full py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-xl font-medium hover:shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            style={{ minHeight: '44px' }}
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>

          {/* Logout Button */}
          <button
            onClick={async () => {
              if (window.confirm("Are you sure you want to logout?")) {
                // Clear visible auth immediately and finish IndexedDB cleanup
                // without delaying the redirect.
                const cleanup = clearSession();
                localStorage.removeItem("swr-cache");
                localStorage.removeItem("trainer_login_at");
                localStorage.removeItem("notif_state");
                localStorage.removeItem("lastReceiptCleanup");
                router.replace("/auth/login");
                void cleanup;
              }
            }}
            className="w-full py-3 bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/10 border border-[#f0813d]/20 text-[#f0813d] rounded-xl font-medium hover:shadow-sm active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            style={{ minHeight: '44px' }}
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>

        {/* Support Info */}
        <div className="text-center pt-2 px-3">
          <p className="text-sm text-gray-500">
            Need help?{" "}
            <button 
              onClick={() => handleQuickAction("help")}
              className="text-[#f0813d] font-medium hover:text-[#9c4400] active:text-[#9c4400]"
            >
              Contact Support
            </button>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            © {new Date().getFullYear()} Gym Management System
          </p>
        </div>
      </main>
    </div>
  );
}
