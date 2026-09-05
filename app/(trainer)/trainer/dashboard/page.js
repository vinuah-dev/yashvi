"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Apple,
  BookOpen,
  CalendarCheck,
  Clock,
  CreditCard,
  Dumbbell,
  IndianRupee,
  Settings,
  Users,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";

const formatMoney = (value) => `Rs.${Number(value || 0).toLocaleString("en-IN")}`;

const getStoredTrainer = () => {
  if (typeof window === "undefined") return null;
  try {
    const user = JSON.parse(localStorage.getItem("gymUser") || "null");
    return user?.role === "trainer" ? user : null;
  } catch {
    return null;
  }
};

export default function TrainerDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    trainer: getStoredTrainer(),
    gymName: "Gym",
    gymLogo: null,
    assignedMembers: [],
    dietPlans: 0,
    workoutPlans: 0,
    earningsThisMonth: 0,
    pendingPt: 0,
    recentActivity: [],
  });

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const user = getStoredTrainer();
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const [
        trainerRowResult,
        assignmentsResult,
        dietPlansResult,
        workoutPlansResult,
        earningsResult,
        dietActivityResult,
        workoutActivityResult,
        gymResult,
      ] = await Promise.all([
        supabase
          .from("gym_trainers")
          .select("id, specialization, bio, monthly_salary, is_active")
          .eq("profile_id", user.id)
          .eq("gym_id", user.gym_id)
          .maybeSingle(),
        supabase
          .from("trainer_member_assignments")
          .select(`
            id,
            assigned_at,
            plan_end_date,
            pending_amount,
            members (
              id,
              full_name,
              phone,
              profile_image
            ),
            trainer_plans:trainer_plan_id (
              name,
              price
            )
          `)
          .eq("trainer_id", user.id)
          .eq("gym_id", user.gym_id)
          .eq("is_active", true)
          .order("assigned_at", { ascending: false }),
        supabase
          .from("diet_plans")
          .select("id", { count: "exact", head: true })
          .eq("gym_id", user.gym_id)
          .eq("trainer_id", user.id),
        supabase
          .from("workout_plans")
          .select("id", { count: "exact", head: true })
          .eq("gym_id", user.gym_id)
          .eq("trainer_id", user.id),
        supabase
          .from("trainer_earnings")
          .select("trainer_amount, created_at")
          .eq("gym_id", user.gym_id)
          .eq("trainer_id", user.id),
        supabase
          .from("member_diets")
          .select(`
            id,
            assigned_at,
            members ( full_name ),
            diet_plans ( title )
          `)
          .eq("assigned_by_trainer_id", user.id)
          .order("assigned_at", { ascending: false })
          .limit(3),
        supabase
          .from("member_workouts")
          .select(`
            id,
            assigned_at,
            members ( full_name ),
            workout_plans ( title )
          `)
          .eq("assigned_by_trainer_id", user.id)
          .order("assigned_at", { ascending: false })
          .limit(3),
        supabase
          .from("gyms")
          .select("name, logo_url")
          .eq("id", user.gym_id)
          .maybeSingle(),
      ]);

      if (trainerRowResult.error) throw trainerRowResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const assignedMembers = assignmentsResult.data || [];
      const dietActivity = (dietActivityResult.data || []).map((item) => ({
        id: `diet-${item.id}`,
        label: "Diet assigned",
        title: item.diet_plans?.title || "Diet plan",
        member: item.members?.full_name || "Member",
        date: item.assigned_at,
      }));
      const workoutActivity = (workoutActivityResult.data || []).map((item) => ({
        id: `workout-${item.id}`,
        label: "Workout assigned",
        title: item.workout_plans?.title || "Workout plan",
        member: item.members?.full_name || "Member",
        date: item.assigned_at,
      }));

      setDashboardData({
        trainer: {
          ...user,
          specialization: trainerRowResult.data?.specialization || "Trainer",
          isActive: trainerRowResult.data?.is_active !== false,
        },
        gymName: gymResult.data?.name || user.gym_name || user.gymName || "Gym",
        gymLogo: gymResult.data?.logo_url || null,
        assignedMembers,
        dietPlans: dietPlansResult.count || 0,
        workoutPlans: workoutPlansResult.count || 0,
        earningsThisMonth: (earningsResult.data || []).reduce((sum, earning) => {
          return new Date(earning.created_at) >= monthStart
            ? sum + Number(earning.trainer_amount || 0)
            : sum;
        }, 0),
        pendingPt: assignedMembers.reduce((sum, item) => sum + Number(item.pending_amount || 0), 0),
        recentActivity: [...dietActivity, ...workoutActivity]
          .sort((left, right) => new Date(right.date) - new Date(left.date))
          .slice(0, 4),
      });
    } catch (error) {
      console.error("Error loading trainer dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const quickActions = useMemo(
    () => [
      { label: "Members", detail: "Assigned clients", icon: Users, href: "/members" },
      { label: "Attendance", detail: "Mark and view", icon: CalendarCheck, href: "/attendance" },
      { label: "My Hours", detail: "Your own punches", icon: Clock, href: "/trainer/attendance" },
      { label: "Diet Plans", detail: "Create or assign", icon: Apple, href: "/settings/diet-plans" },
      { label: "Workouts", detail: "Training plans", icon: Dumbbell, href: "/settings/workout-plans" },
      { label: "Knowledge", detail: "View gym posts", icon: BookOpen, href: "/admin/knowledge" },
      { label: "Settings", detail: "Trainer tools", icon: Settings, href: "/settings" },
    ],
    [],
  );

  const showLoadingValue = (value) => (loading && !value ? "..." : value);

  return (
    <div className="min-h-screen bg-[#f3efec] text-[#1a1c1c] pb-28 animate-fadeIn font-sans">
      <Header title="Trainer Dashboard" showBack={false} gymLogo={dashboardData.gymLogo} />

      <main className="px-4 py-5 space-y-6">
        <section className="flex justify-between items-center px-1">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-zinc-500 font-extrabold text-[10px] tracking-widest uppercase">
              <span>
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#f0813d] animate-pulse" />
              <span className="text-[#f0813d] font-black">
                {dashboardData.trainer?.specialization || "Trainer"}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#1a1c1c]">
              Hello, <span className="text-[#f0813d]">{dashboardData.trainer?.name || "Trainer"}</span>
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <img
                src="/icons/ss-hexagon.svg"
                alt="SS hexagon"
                className="h-8 w-8 shrink-0"
              />
              <p className="truncate text-xs font-black uppercase tracking-widest text-[#897267]">
                {dashboardData.gymName}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/settings")}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#ded6d0] bg-white text-[#5f5e5e] shadow-md active-scale"
          >
            <Settings className="h-5 w-5" />
          </button>
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-white/6 p-5 shadow-xl aspect-[1.8/1]">
          <div
            className="absolute inset-0 bg-cover bg-center brightness-[0.35]"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex gap-2">
              <span className="rounded-full border border-white/10 bg-black/60 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#f0813d]">
                {showLoadingValue(dashboardData.assignedMembers.length)} members
              </span>
              <span className="rounded-full border border-white/10 bg-black/60 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#f0813d]">
                {loading && !dashboardData.earningsThisMonth ? "..." : formatMoney(dashboardData.earningsThisMonth)} this month
              </span>
            </div>
            <div>
              <h2 className="text-xl font-black leading-tight text-white">Your coaching command center</h2>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Members, plans, attendance and knowledge in one place
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          {[
            { label: "Members", value: showLoadingValue(dashboardData.assignedMembers.length), icon: Users },
            { label: "Diet Plans", value: showLoadingValue(dashboardData.dietPlans), icon: Apple },
            { label: "Workouts", value: showLoadingValue(dashboardData.workoutPlans), icon: Dumbbell },
            {
              label: "Month Pay",
              value: loading && !dashboardData.earningsThisMonth ? "..." : formatMoney(dashboardData.earningsThisMonth),
              icon: IndianRupee,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-[#ded6d0] bg-white p-4 shadow-lg">
              <Icon className="mb-3 h-5 w-5 text-[#f0813d]" />
              <p className="truncate text-xl font-black text-[#1a1c1c]">{value}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-[#897267]">{label}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-[#f0813d]/20 bg-[#f0813d]/10 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#f0813d]">Pending PT Due</p>
              <p className="mt-1 text-2xl font-black text-[#1a1c1c]">
                {loading && !dashboardData.pendingPt ? "..." : formatMoney(dashboardData.pendingPt)}
              </p>
            </div>
            <CreditCard className="h-8 w-8 text-[#f0813d]" />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#5f5e5e]">Trainer Functions</h2>
            <span className="text-[10px] font-bold text-[#f0813d]">Admin Access</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(({ label, detail, icon: Icon, href }) => (
              <button
                key={label}
                onClick={() => router.push(href)}
                className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-[#ded6d0] bg-white p-3 text-left shadow-lg transition hover:border-[#f0813d]/50 active-scale"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0813d]/12 text-[#f0813d]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-[#1a1c1c]">{label}</span>
                  <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#897267]">{detail}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#5f5e5e]">Assigned Members</h2>
            <button onClick={() => router.push("/members")} className="text-[10px] font-bold text-[#f0813d]">
              See All
            </button>
          </div>
          <div className="space-y-3">
            {dashboardData.assignedMembers.slice(0, 4).map((assignment) => (
              <button
                key={assignment.id}
                onClick={() => router.push(`/members/${assignment.members?.id}`)}
                className="flex w-full items-center gap-3 rounded-2xl border border-[#ded6d0] bg-white p-4 text-left shadow-lg active-scale"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0813d] text-sm font-black text-black">
                  {assignment.members?.full_name?.charAt(0) || "M"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-[#1a1c1c]">{assignment.members?.full_name}</p>
                  <p className="truncate text-[10px] font-semibold text-[#897267]">
                    {assignment.trainer_plans?.name || "Personal Training"}
                  </p>
                </div>
              </button>
            ))}
            {dashboardData.assignedMembers.length === 0 && (
              <div className="rounded-2xl border border-[#ded6d0] bg-white p-6 text-center text-sm text-[#897267]">
                {loading ? "Loading assigned members..." : "No members assigned yet."}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-xs font-black uppercase tracking-widest text-[#5f5e5e]">Recent Plan Activity</h2>
          <div className="space-y-3">
            {dashboardData.recentActivity.map((activity) => (
              <div key={activity.id} className="rounded-2xl border border-[#ded6d0] bg-white p-4 shadow-lg">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#f0813d]">{activity.label}</p>
                <p className="mt-1 text-sm font-black text-[#1a1c1c]">{activity.title}</p>
                <p className="mt-1 text-xs text-[#897267]">{activity.member}</p>
              </div>
            ))}
            {dashboardData.recentActivity.length === 0 && (
              <div className="rounded-2xl border border-[#ded6d0] bg-white p-6 text-center text-sm text-[#897267]">
                {loading ? "Loading recent activity..." : "No recent diet or workout assignments."}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
