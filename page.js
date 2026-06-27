"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
import { DashboardPageSkeleton } from "@/components/shared/Skeleton";
import dynamic from "next/dynamic";
import { useAuthContext } from "@/contexts/AuthContext";
import { useDashboardData } from "@/lib/hooks/useSwrData";
import { hasPermission, PERMISSIONS } from "@/lib/constants/permissions";
import {
  KPICard,
  GymHeroCard,
  RevenueCard,
  QuickActions,
  AttendanceSection,
  PendingPaymentsSection,
  RecentActivitySection,
  useExcelExport,
} from "@/components/dashboard";
import {
  Users,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Building,
  ArrowRight,
  Download,
} from "lucide-react";

// Lazy-load MessagingDashboard — it's below the fold
const MessagingDashboard = dynamic(
  () => import("@/components/shared/MessagingDashboard"),
  { ssr: false }
);

// ─── Data Processing (unchanged) ─────────────────────────────

function processDashboardResult(result) {
  if (!result) return null;

  const members = result.members || [];
  const attendance = result.attendance || [];
  const payments = result.payments || [];

  let activeMembers = 0;
  let expiredMembers = 0;
  let pendingDues = 0;

  members.forEach((member) => {
    const activeMembership =
      member.memberships?.find((ms) => ms.status === "active") ||
      member.memberships?.[0];

    let memberStatus = "inactive";
    if (activeMembership) {
      const endDate = new Date(activeMembership.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      if (endDate >= today && activeMembership.status === "active") {
        memberStatus = "active";
      } else if (endDate < today || activeMembership.status === "expired") {
        memberStatus = "expired";
      }
    }

    if (memberStatus === "active") activeMembers++;
    else if (memberStatus === "expired") expiredMembers++;
    if (member.balance > 0) pendingDues += parseFloat(member.balance || 0);
  });

  let totalRevenue = parseFloat(result.overall_revenue || 0);
  if (!totalRevenue) {
    totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  }

  const formattedAttendance = attendance.map((att) => ({
    id: att.id,
    name: att.member_name || "Unknown",
    checkIn: new Date(`1970-01-01T${att.check_in_time}`).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    status: att.check_out_time ? "left" : "active",
    membershipStatus: att.membership_status || "ACTIVE",
  }));

  const allMembersDue = members
    .filter((m) => m.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .map((member) => ({
      id: member.id,
      name: member.full_name,
      amount: member.balance,
      dueDate: "Overdue",
    }));

  let activities = [];
  activities = activities.concat(
    attendance.map((att) => ({
      id: `att_${att.id}`,
      type: "attendance",
      text: `${att.member_name || "Member"} checked ${att.check_out_time ? "out" : "in"}`,
      time: "Today",
      icon: att.check_out_time ? "🔴" : "🟢",
    }))
  );

  const recentMembers = members
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);
  activities = activities.concat(
    recentMembers.map((member) => ({
      id: `member_${member.id}`,
      type: "member",
      text: `New member: ${member.full_name}`,
      time: new Date(member.created_at).toLocaleDateString(),
      icon: "🆕",
    }))
  );

  const recentPayments = payments.slice(0, 10);
  activities = activities.concat(
    recentPayments.map((payment) => {
      const memberName = payment.member_name || "Member";
      const amount = parseFloat(payment.amount || 0).toLocaleString();
      let text = `Payment of ₹${amount} from ${memberName}`;
      if (payment.collected_by && payment.collected_by_name) {
        text = `${payment.collected_by_name} collected ₹${amount} from ${memberName}`;
      }
      return {
        id: `payment_${payment.id}`,
        type: "payment",
        text,
        time: new Date(payment.created_at).toLocaleDateString(),
        icon: payment.collected_by ? "👨‍🏫" : "💰",
      };
    })
  );

  return {
    stats: {
      totalMembers: members.length,
      activeMembers,
      expiredMembers,
      todayAttendance: attendance.length,
      totalRevenue,
      pendingDues,
    },
    formattedAttendance,
    allMembersDue,
    activities,
  };
}

// ─── Gym Resolution Hook ──────────────────────────────────────
// Only runs when selectedGym is not set (first visit or owner with multiple gyms)
function useGymResolution() {
  const { user, selectedGym, setSelectedGym } = useAuthContext();
  const [gyms, setGyms] = useState([]);
  const [loadingGyms, setLoadingGyms] = useState(!selectedGym);
  const [resolved, setResolved] = useState(!!selectedGym);

  // Resolve gym on mount if not already set
  useState(() => {
    if (selectedGym || !user) {
      setResolved(true);
      setLoadingGyms(false);
      return;
    }

    const resolve = async () => {
      try {
        if (user.gym_id) {
          const { data: gymData } = await supabase
            .from("gyms")
            .select("id, name, address, timezone, created_at")
            .eq("id", user.gym_id)
            .single();
          if (gymData) {
            setGyms([gymData]);
            setSelectedGym(gymData);
          }
        } else if (user.role === "trainer") {
          const { data: trainerData } = await supabase
            .from("gym_trainers")
            .select("gym_id, gyms (id, name, address, timezone, created_at)")
            .eq("profile_id", user.id)
            .single();
          if (trainerData?.gyms) {
            setGyms([trainerData.gyms]);
            setSelectedGym(trainerData.gyms);
          }
        } else if (user.role === "owner") {
          const { data: gymsData } = await supabase
            .from("gyms")
            .select("id, name, address, timezone, created_at")
            .eq("owner_id", user.id);
          setGyms(gymsData || []);
          if (gymsData?.length === 1) {
            setSelectedGym(gymsData[0]);
          }
        }
      } catch (err) {
        console.error("Gym resolution error:", err);
      }
      setLoadingGyms(false);
      setResolved(true);
    };

    resolve();
  });

  return { gyms, loadingGyms, resolved };
}

// ─── Main Dashboard ───────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const {
    user,
    selectedGym,
    setSelectedGym,
    permissions,
    isReady,
    canViewFinance,
    canCreateTrainer,
    canWrite,
  } = useAuthContext();

  const { gyms, loadingGyms } = useGymResolution();

  // SWR: auto-fetches when selectedGym.id is available
  const { data: rawData, isLoading: dataLoading } = useDashboardData(selectedGym?.id);

  // Process data with useMemo — no re-processing on re-render
  const processed = useMemo(() => processDashboardResult(rawData), [rawData]);

  const stats = processed?.stats || {
    totalMembers: 0,
    activeMembers: 0,
    expiredMembers: 0,
    todayAttendance: 0,
    totalRevenue: 0,
    pendingDues: 0,
  };
  const allAttendance = processed?.formattedAttendance || [];
  const allPendingPayments = processed?.allMembersDue || [];
  const allActivity = processed?.activities || [];

  const { exporting: exportingExcel, exportExcel: handleExportWholeDashboardExcel } =
    useExcelExport(selectedGym);

  const handleSelectGym = useCallback(
    (gym) => {
      setSelectedGym(gym);
    },
    [setSelectedGym]
  );

  // ─── Loading ───────────────────────────────────────────────

  if (!isReady || loadingGyms || (!selectedGym && !gyms.length && dataLoading)) {
    return <DashboardPageSkeleton />;
  }

  // ─── Gym Selection (owner with multiple gyms) ──────────────

  if (!selectedGym && gyms.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
        <Header title="Select Gym" showBack={false} />
        <main className="px-4 py-4 space-y-4">
          <div className="text-center mb-6 pt-2">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Building className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Welcome, {user?.name || "Admin"}!
            </h2>
            <p className="text-gray-500 text-xs mt-1">Select a gym to manage</p>
          </div>
          <div className="space-y-3">
            {gyms.map((gym) => (
              <button
                key={gym.id}
                onClick={() => handleSelectGym(gym)}
                className="w-full p-4 bg-white rounded-xl border border-gray-200 shadow-sm active:scale-95 active:shadow-none transition-all text-left active:bg-gray-50"
                style={{ minHeight: "72px" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-base truncate">{gym.name}</h3>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {gym.address || "No address"}
                    </p>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {gym.timezone || "UTC"}
                    </span>
                  </div>
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // ─── No Gyms ───────────────────────────────────────────────

  if (gyms.length === 0 && !selectedGym) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
        <Header title="Dashboard" showBack={false} />
        <main className="px-4 py-4">
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Building className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">No Gym Assigned</h2>
            <p className="text-gray-500 text-sm mb-6 px-4">
              Please contact the administrator to assign a gym to your account.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Show skeleton while SWR is loading first data
  if (dataLoading && !processed) {
    return <DashboardPageSkeleton />;
  }

  // ─── Main Dashboard ────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b mb-17 from-gray-50 to-gray-100 safe-area-inset-bottom">
      <Header title="Dashboard" showBack={false} />

      <main className="px-3 py-2 space-y-4">
        {/* Welcome */}
        <div className="flex items-start justify-between px-1">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 truncate">
              Welcome back, {user?.name?.split(" ")[0] || "Admin"}!
            </h1>
            <p className="text-xs text-gray-500 truncate">
              Here&apos;s your gym overview for today
            </p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            {user?.role === "admin" && (
              <button
                onClick={handleExportWholeDashboardExcel}
                disabled={exportingExcel}
                className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-medium active:scale-95 transition-transform flex-shrink-0 flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ minHeight: "36px" }}
              >
                <Download className="w-3.5 h-3.5" />
                {exportingExcel ? "Exporting..." : "Export Excel"}
              </button>
            )}
            {gyms.length > 1 && (
              <button
                onClick={() => setSelectedGym(null)}
                className="px-3 py-1.5 bg-white border text-black border-gray-300 rounded-lg text-xs font-medium active:scale-95 transition-transform flex-shrink-0"
                style={{ minHeight: "36px", minWidth: "36px" }}
              >
                Switch gym
              </button>
            )}
          </div>
        </div>

        {/* Gym Hero Card */}
        <GymHeroCard gym={selectedGym} />

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-2 px-1">
          {hasPermission(permissions, PERMISSIONS.MEMBERS) && (
            <>
              <KPICard
                title="Total Members"
                value={stats.totalMembers}
                icon={<Users className="w-4 h-4" />}
                color="blue"
                onClick={() => router.push("/members")}
              />
              <KPICard
                title="Active"
                value={stats.activeMembers}
                icon={<CheckCircle className="w-4 h-4" />}
                color="green"
                onClick={() => router.push("/members?filter=active")}
              />
              <KPICard
                title="Expired"
                value={stats.expiredMembers}
                icon={<AlertTriangle className="w-4 h-4" />}
                color="amber"
                onClick={() => router.push("/members?filter=expired")}
              />
            </>
          )}
          {hasPermission(permissions, PERMISSIONS.ATTENDANCE) && (
            <KPICard
              title="Today"
              value={stats.todayAttendance}
              icon={<Calendar className="w-4 h-4" />}
              color="indigo"
              onClick={() => router.push("/attendance")}
            />
          )}
        </div>

        {/* Revenue */}
        {hasPermission(permissions, PERMISSIONS.FINANCE) && (
          <RevenueCard
            totalRevenue={stats.totalRevenue}
            pendingDues={stats.pendingDues}
            canViewFinance={canViewFinance}
          />
        )}

        {/* Quick Actions */}
        {canWrite && (
          <QuickActions
            permissions={permissions}
            canCreateTrainer={canCreateTrainer}
          />
        )}

        {/* Attendance & Payments */}
        <div className="space-y-3 px-1">
          {hasPermission(permissions, PERMISSIONS.ATTENDANCE) && (
            <AttendanceSection
              todayList={allAttendance.slice(0, 5)}
              allAttendance={allAttendance}
              totalCount={stats.todayAttendance}
            />
          )}

          {hasPermission(permissions, PERMISSIONS.FINANCE) && (
            <PendingPaymentsSection
              topPayments={allPendingPayments.slice(0, 5)}
              allPayments={allPendingPayments}
              totalDues={stats.pendingDues}
            />
          )}
        </div>

        {/* Recent Activity */}
        <RecentActivitySection
          topActivity={allActivity.slice(0, 5)}
          allActivity={allActivity}
        />

        {/* Messaging — lazy loaded */}
        {hasPermission(permissions, PERMISSIONS.MEMBERS) && selectedGym?.id && (
          <MessagingDashboard gymId={selectedGym.id} />
        )}
      </main>
    </div>
  );
}
