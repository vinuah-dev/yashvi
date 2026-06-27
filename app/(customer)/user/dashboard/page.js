"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Apple,
  Bell,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  Compass,
  CreditCard,
  Droplet,
  Dumbbell,
  Flame,
  Heart,
  Play,
  Search,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { UserDashboardSkeleton } from "@/components/shared/CustomerSkeleton";
import { supabase } from "@/lib/supabaseClient";

const formatDisplayDate = (dateValue) => {
  if (!dateValue) return "Not set";
  return new Date(dateValue).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getDaysLeft = (endDateValue) => {
  if (!endDateValue) return 0;
  const endDate = new Date(endDateValue);
  const today = new Date();
  return Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
};

export default function CustomerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [announcements, setAnnouncements] = useState([]);
  const [dashboardData, setDashboardData] = useState({
    name: "Member",
    gymName: "Gym",
    gymLogo: null,
    membership: {
      plan: "No Plan",
      daysLeft: 0,
      status: "expired",
    },
    todayWorkout: "No workout assigned",
    todayWorkoutFocus: "Ask your trainer to assign a plan",
    todayExerciseCount: 0,
    assignedDiet: null,
    assignedTrainer: null,
    balance: 0,
    streak: 0,
    thisMonthAttendance: 0,
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    try {
      const storedMember = localStorage.getItem("member");
      if (!storedMember) {
        router.push("/auth/login");
        return;
      }

      const member = JSON.parse(storedMember);

      const { data: memberDetails, error: memberError } = await supabase
        .from("members")
        .select(`
          id,
          full_name,
          gym_id,
          balance,
          memberships (
            id,
            plan_id,
            start_date,
            end_date,
            status,
            membership_plans (
              name,
              duration_days
            )
          )
        `)
        .eq("id", member.id)
        .single();

      if (memberError) throw memberError;

      const todayDayNumber = new Date().getDay();
      const [
        { data: gymData },
        { data: attendanceData, error: attendanceError },
        { data: latestWorkoutAssignment, error: workoutError },
        { data: latestDietAssignment, error: dietError },
        { data: trainerAssignment, error: trainerError },
        { data: announcementsData, error: announcementsError },
      ] = await Promise.all([
        supabase
          .from("gyms")
          .select("name, logo_url")
          .eq("id", memberDetails.gym_id)
          .maybeSingle(),
        supabase
          .from("attendance")
          .select("check_in_date")
          .eq("member_id", member.id)
          .order("check_in_date", { ascending: false })
          .limit(100),
        supabase
          .from("member_workouts")
          .select(`
            id,
            assigned_at,
            workout_plans (
              id,
              title,
              goal,
              level,
              workout_plan_days (
                day_of_week,
                focus,
                workout_exercises (
                  id
                )
              )
            )
          `)
          .eq("member_id", member.id)
          .order("assigned_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("member_diets")
          .select(`
            id,
            assigned_at,
            diet_plans (
              id,
              title,
              description
            )
          `)
          .eq("member_id", member.id)
          .order("assigned_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("trainer_member_assignments")
          .select(`
            id,
            assigned_at,
            plan_start_date,
            plan_end_date,
            pending_amount,
            next_payment_date,
            trainer_plans:trainer_plan_id (
              name,
              duration_days,
              price
            ),
            profiles:trainer_id (
              first_name,
              last_name,
              phone,
              email
            )
          `)
          .eq("member_id", member.id)
          .eq("gym_id", memberDetails.gym_id)
          .eq("is_active", true)
          .order("assigned_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("announcements")
          .select("*")
          .eq("gym_id", memberDetails.gym_id)
          .eq("status", "active")
          .order("announced_at", { ascending: false })
          .limit(5),
      ]);

      const activeMembership = memberDetails.memberships?.find((membership) => {
        if (membership.status !== "active") return false;
        return !membership.end_date || new Date(membership.end_date) >= new Date();
      });

      const latestMembership = activeMembership || memberDetails.memberships?.[0];
      const membershipPlan = latestMembership?.membership_plans?.name || "No Plan";
      const membershipStatus = activeMembership ? "active" : "expired";
      const daysLeft = activeMembership ? getDaysLeft(activeMembership.end_date) : 0;

      let streak = 0;
      let thisMonthAttendance = 0;

      if (!attendanceError && attendanceData) {
        const uniqueDates = [...new Set(attendanceData.map((item) => item.check_in_date))];
        const sortedDates = uniqueDates
          .map((date) => new Date(date))
          .sort((left, right) => right - left);

        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const latestAttendance = sortedDates[0];
        if (
          latestAttendance &&
          (latestAttendance.toDateString() === today.toDateString() ||
            latestAttendance.toDateString() === yesterday.toDateString())
        ) {
          let expectedDate = new Date(latestAttendance);

          for (const attendanceDate of sortedDates) {
            if (attendanceDate.toDateString() === expectedDate.toDateString()) {
              streak += 1;
              expectedDate = new Date(expectedDate);
              expectedDate.setDate(expectedDate.getDate() - 1);
            } else if (attendanceDate < expectedDate) {
              break;
            }
          }
        }

        thisMonthAttendance = uniqueDates.filter((date) => {
          const attendanceDate = new Date(date);
          return (
            attendanceDate.getMonth() === today.getMonth() &&
            attendanceDate.getFullYear() === today.getFullYear()
          );
        }).length;
      }

      let todayWorkout = "No workout assigned";
      let todayWorkoutFocus = "Ask your trainer to assign a plan";
      let todayExerciseCount = 0;

      if (!workoutError && latestWorkoutAssignment?.workout_plans) {
        const plan = latestWorkoutAssignment.workout_plans;
        const todayPlanDay = plan.workout_plan_days?.find(
          (day) => day.day_of_week === todayDayNumber,
        );
        todayWorkout = plan.title || "Workout Plan";
        todayWorkoutFocus =
          todayPlanDay?.focus || (todayDayNumber === 0 ? "Rest day" : plan.goal || "Training plan");
        todayExerciseCount = todayPlanDay?.workout_exercises?.length || 0;
      }

      const assignedDiet =
        !dietError && latestDietAssignment?.diet_plans
          ? {
              title: latestDietAssignment.diet_plans.title || "Diet Plan",
              description:
                latestDietAssignment.diet_plans.description || "Personalized nutrition routine",
              assignedAt: latestDietAssignment.assigned_at,
            }
          : null;

      const assignedTrainer =
        !trainerError && trainerAssignment?.profiles
          ? {
              name:
                `${trainerAssignment.profiles.first_name || ""} ${
                  trainerAssignment.profiles.last_name || ""
                }`.trim() || "Assigned Trainer",
              phone: trainerAssignment.profiles.phone || "",
              email: trainerAssignment.profiles.email || "",
              plan: trainerAssignment.trainer_plans?.name || "Personal Training",
              startDate: trainerAssignment.plan_start_date,
              endDate: trainerAssignment.plan_end_date,
              pendingAmount: Number(trainerAssignment.pending_amount || 0),
              nextPaymentDate: trainerAssignment.next_payment_date,
            }
          : null;

      setDashboardData({
        name: memberDetails.full_name?.split(" ")[0] || "Member",
        gymName: gymData?.name || "Gym",
        gymLogo: gymData?.logo_url || null,
        membership: {
          plan: membershipPlan,
          daysLeft,
          status: membershipStatus,
        },
        todayWorkout,
        todayWorkoutFocus,
        todayExerciseCount,
        assignedDiet,
        assignedTrainer,
        balance: Number(memberDetails.balance || 0),
        streak,
        thisMonthAttendance,
      });

      if (!announcementsError && announcementsData) {
        const now = new Date();
        setAnnouncements(
          announcementsData.filter((announcement) => {
            if (!announcement.expires_at) return true;
            return new Date(announcement.expires_at).getTime() > now.getTime();
          }),
        );
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return <UserDashboardSkeleton />;
  }

  const isExpired = dashboardData.membership.status === "expired";
  const quickActions = [
    {
      label: "Health Tracker",
      icon: Activity,
      href: "/health-tracker",
      detail: "Weight, meals and progress",
    },
    { label: "Workout", icon: Dumbbell, href: "/workout", detail: dashboardData.todayWorkout },
    {
      label: "Diet",
      icon: Apple,
      href: "/diet",
      detail: dashboardData.assignedDiet?.title || "View nutrition",
    },
    {
      label: "Trainer",
      icon: UserCheck,
      href: "/schedule",
      detail: dashboardData.assignedTrainer?.name || "No trainer assigned",
    },
    {
      label: "Attendance",
      icon: CalendarCheck,
      href: "/my-attendance",
      detail: `${dashboardData.thisMonthAttendance} this month`,
    },
    { label: "Knowledge", icon: BookOpen, href: "/knowledge", detail: "Health posts" },
    {
      label: "Profile",
      icon: ShieldCheck,
      href: "/profile",
      detail: isExpired ? "Renew needed" : "Membership active",
    },
  ];

  const categoryActions = {
    Hydration: "/diet",
    Heart: "/diet",
    Calorie: "/diet",
    Workout: "/workout",
    Discover: "/knowledge",
  };

  return (
    <div className="min-h-screen bg-[#1a1c1c] text-white pb-28 animate-fadeIn font-sans selection:bg-[#f0813d] selection:text-black">
      <Header title="Gym Core Dashboard" showBack={false} gymLogo={dashboardData.gymLogo} />

      <main className="px-4 py-5 space-y-6">
        <div className="flex justify-between items-center px-1">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-zinc-500 font-extrabold text-[10px] tracking-widest uppercase">
              <span>
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#f0813d] animate-pulse"></span>
              <span className="text-[#f0813d] font-black">Ready</span>
            </div>
            <h2 className="text-2xl font-black font-heading tracking-tight text-white mt-1">
              Hello, <span className="text-[#f0813d]">{dashboardData.name}</span>
            </h2>
            <div className="member-gym-banner mt-3 inline-flex max-w-full items-center gap-2 rounded-2xl border border-orange-300 bg-[#f0813d] px-3 py-2 shadow-[0_10px_24px_rgba(240,129,61,0.28)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black">
                <img
                  src="/icons/ss-hexagon.svg"
                  alt="SS hexagon"
                  className="h-6 w-6"
                />
              </span>
              <p className="truncate text-xs font-black uppercase tracking-widest text-black">
                {dashboardData.gymName}
              </p>
              <span className="shrink-0 rounded-lg bg-black px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white">
                Member
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/user/announcements")}
              className="relative p-2.5 bg-zinc-900 border border-white/8 rounded-xl text-zinc-400 hover:text-white hover:border-[#9c4400]/40 transition active-scale shadow-md"
            >
              <Bell className="w-5 h-5" />
              {announcements.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#9c4400] rounded-full border-2 border-[#1a1c1c] shadow-[0_0_8px_rgba(156,68,0,0.8)]"></span>
              )}
            </button>

            <div
              onClick={() => router.push("/profile")}
              className="cursor-pointer w-11 h-11 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#9c4400] p-[2px] shadow-lg active-scale hover:rotate-3 transition-transform"
            >
              <div className="w-full h-full rounded-[10px] bg-zinc-950 flex items-center justify-center overflow-hidden">
                <span className="text-sm font-black font-heading text-white">
                  {dashboardData.name[0]?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
            <Search className="w-4.5 h-4.5" />
          </div>
          <input
            type="text"
            placeholder="Search dashboard tools..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#2d2926]/80 border border-white/6 rounded-2xl text-sm placeholder-zinc-500 focus:outline-none focus:border-[#f0813d] focus:ring-1 focus:ring-[#f0813d] shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] transition"
          />
        </div>

        {isExpired && (
          <div className="rounded-2xl border border-[#f0813d]/30 bg-[#f0813d]/10 p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-[#f0813d]/20 p-2 text-[#f0813d]">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white">Membership expired</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  Renew your plan to keep diet, workout and trainer access active.
                </p>
              </div>
              <button
                onClick={() => router.push("/profile/renew")}
                className="rounded-xl bg-[#f0813d] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-black active-scale"
              >
                Renew
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/6 bg-[#2d2926] p-3 shadow-lg">
            <Flame className="mb-2 h-4 w-4 text-[#f0813d]" />
            <p className="text-xl font-black leading-none text-white">{dashboardData.streak}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">Day Streak</p>
          </div>
          <div className="rounded-2xl border border-white/6 bg-[#2d2926] p-3 shadow-lg">
            <CalendarCheck className="mb-2 h-4 w-4 text-[#f0813d]" />
            <p className="text-xl font-black leading-none text-white">{dashboardData.thisMonthAttendance}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">Visits</p>
          </div>
          <div className="rounded-2xl border border-white/6 bg-[#2d2926] p-3 shadow-lg">
            <CreditCard className="mb-2 h-4 w-4 text-[#f0813d]" />
            <p className="truncate text-xl font-black leading-none text-white">Rs.{dashboardData.balance}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">Due</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black tracking-widest text-zinc-400 uppercase">Quick Actions</h3>
            <span className="text-[10px] text-[#f0813d] font-bold">Member Tools</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(({ label, icon: Icon, href, detail }) => (
              <button
                key={label}
                onClick={() => router.push(href)}
                className="member-quick-action flex min-h-[76px] items-center gap-3 rounded-2xl border border-orange-300 bg-[#f0813d] p-3 text-left shadow-lg transition hover:bg-[#e97432] active-scale"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-black">{label}</span>
                  <span className="mt-0.5 block truncate text-[10px] font-semibold text-white">{detail}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black tracking-widest text-zinc-400 uppercase">Browse Category</h3>
            <span className="text-[10px] text-[#f0813d] font-bold">See All</span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: "Hydration", icon: <Droplet className="w-4 h-4 text-[#f0813d]" /> },
              { id: "Heart", icon: <Heart className="w-4 h-4 text-[#f0813d]" /> },
              { id: "Calorie", icon: <Flame className="w-4 h-4 text-[#9c4400]" /> },
              { id: "Workout", icon: <Dumbbell className="w-4 h-4 text-[#f0813d]" /> },
              { id: "Discover", icon: <Compass className="w-4 h-4 text-[#f0813d]" /> },
            ].map((category) => {
              const isSelected = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    router.push(categoryActions[category.id]);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs transition duration-300 active-scale whitespace-nowrap border ${
                    isSelected
                      ? "bg-[#f0813d] text-black border-[#f0813d] shadow-[0_0_12px_rgba(240,129,61,0.25)]"
                      : "bg-[#2d2926] text-zinc-400 border-white/5 hover:text-white"
                  }`}
                >
                  <span className={isSelected ? "text-black" : ""}>{category.icon}</span>
                  <span>{category.id}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black tracking-widest text-zinc-400 uppercase">Today&apos;s Workout</h3>
            <span onClick={() => router.push("/workout")} className="text-[10px] text-[#f0813d] font-bold cursor-pointer">
              See All
            </span>
          </div>

          <div
            onClick={() => router.push("/workout")}
            className="relative overflow-hidden rounded-3xl p-5 border border-white/6 shadow-xl aspect-[1.8/1] cursor-pointer hover-scale active-scale group"
          >
            <div
              className="absolute inset-0 bg-cover bg-center brightness-[0.4] group-hover:scale-105 transition-transform duration-700"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80')",
              }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>

            <div className="relative h-full flex flex-col justify-between z-10">
              <div className="flex gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-black/60 border border-white/10 text-[#f0813d]">
                  {dashboardData.todayExerciseCount || 0} exercises
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-black/60 border border-white/10 text-[#f0813d]">
                  {dashboardData.todayWorkoutFocus}
                </span>
              </div>

              <div className="flex justify-between items-end gap-3">
                <div className="space-y-1 min-w-0">
                  <h4 className="text-lg font-heading font-black text-white tracking-tight leading-none group-hover:text-[#f0813d] transition-colors line-clamp-2">
                    {dashboardData.todayWorkout}
                  </h4>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                    Open your assigned workout plan
                  </p>
                </div>
                <div className="p-2.5 bg-[#9c4400] rounded-xl text-white shadow-[0_0_15px_rgba(156,68,0,0.5)] group-hover:scale-110 transition-transform">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black tracking-widest text-zinc-400 uppercase">Diet & Nutrition</h3>
            <span onClick={() => router.push("/diet")} className="text-[10px] text-[#f0813d] font-bold cursor-pointer">
              See All
            </span>
          </div>

          <div
            onClick={() => router.push("/diet")}
            className="relative overflow-hidden rounded-3xl p-5 border border-white/6 shadow-xl aspect-[1.8/1] cursor-pointer hover-scale active-scale group"
          >
            <div
              className="absolute inset-0 bg-cover bg-center brightness-[0.4] group-hover:scale-105 transition-transform duration-700"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80')",
              }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>

            <div className="relative h-full flex flex-col justify-between z-10">
              <div className="flex gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-black/60 border border-white/10 text-[#f0813d]">
                  Assigned Diet
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-black/60 border border-white/10 text-[#9c4400]">
                  Hydration
                </span>
              </div>

              <div className="flex justify-between items-end gap-3">
                <div className="space-y-1 min-w-0">
                  <h4 className="text-lg font-heading font-black text-white tracking-tight leading-none group-hover:text-[#f0813d] transition-colors line-clamp-2">
                    {dashboardData.assignedDiet?.title || "No diet assigned yet"}
                  </h4>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                    {dashboardData.assignedDiet
                      ? `Assigned ${formatDisplayDate(dashboardData.assignedDiet.assignedAt)}`
                      : "Ask your trainer to assign a nutrition plan"}
                  </p>
                </div>
                <div className="p-2.5 bg-[#f0813d] rounded-xl text-black shadow-[0_0_15px_rgba(240,129,61,0.3)] group-hover:scale-110 transition-transform">
                  <Apple className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black tracking-widest text-zinc-400 uppercase">Assigned Trainer</h3>
            <span onClick={() => router.push("/schedule")} className="text-[10px] text-[#f0813d] font-bold cursor-pointer">
              Schedule
            </span>
          </div>

          <div className="rounded-3xl border border-white/6 bg-[#2d2926] p-5 shadow-xl">
            {dashboardData.assignedTrainer ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f0813d] to-[#9c4400] text-lg font-black text-white">
                      {dashboardData.assignedTrainer.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-white">{dashboardData.assignedTrainer.name}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#f0813d]">
                        {dashboardData.assignedTrainer.plan}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-lg border border-[#f0813d]/25 bg-[#f0813d]/10 px-2 py-1 text-[9px] font-black uppercase text-[#f0813d]">
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Ends</p>
                    <p className="mt-1 font-bold text-white">{formatDisplayDate(dashboardData.assignedTrainer.endDate)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">PT Due</p>
                    <p className="mt-1 font-bold text-white">Rs.{dashboardData.assignedTrainer.pendingAmount}</p>
                  </div>
                </div>

                {dashboardData.assignedTrainer.phone && (
                  <button
                    onClick={() => window.open(`tel:${dashboardData.assignedTrainer.phone}`)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-white/10 active-scale"
                  >
                    <UserCheck className="h-4 w-4 text-[#f0813d]" /> Contact Trainer
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center">
                <UserCheck className="mx-auto mb-3 h-9 w-9 text-zinc-600" />
                <p className="text-sm font-black text-white">No trainer assigned</p>
                <p className="mx-auto mt-1 max-w-[260px] text-xs leading-relaxed text-zinc-500">
                  Your assigned trainer and PT plan will appear here once the gym assigns one.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black tracking-widest text-zinc-400 uppercase">Weekly Activity</h3>
            <span className="text-[9px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md font-extrabold uppercase">
              Live
            </span>
          </div>

          <div className="glass-panel p-5 border border-white/6 shadow-xl relative overflow-hidden flex items-center justify-between gap-4">
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  Attendance Logged
                </span>
                <p className="text-2xl font-black font-heading text-white">{dashboardData.thisMonthAttendance} Visits</p>
              </div>

              <div className="flex gap-4">
                <div>
                  <span className="text-[8px] font-bold text-zinc-500 uppercase">Streak</span>
                  <p className="text-xs font-black text-[#9c4400]">{dashboardData.streak} days</p>
                </div>
                <div className="border-l border-white/10 pl-4">
                  <span className="text-[8px] font-bold text-zinc-500 uppercase">Today</span>
                  <p className="text-xs font-black text-[#f0813d]">{dashboardData.todayExerciseCount || 0} exercises</p>
                </div>
              </div>
            </div>

            <div className="relative w-24 h-24 flex items-center justify-center bg-zinc-950/80 border border-white/5 rounded-2xl p-1 shadow-inner">
              <div className="absolute w-20 h-20 border border-white/5 rotate-45 rounded-xl"></div>
              <div className="absolute w-14 h-14 border border-[#f0813d]/15 rotate-12 rounded-lg"></div>
              <Activity className="w-6 h-6 text-[#f0813d] animate-pulse" />
            </div>
          </div>
        </div>

        {announcements.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black tracking-widest text-zinc-400 uppercase flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-[#9c4400]" /> Notifications
              </h3>
              <span className="text-[9px] font-extrabold bg-[#9c4400]/15 text-[#9c4400] px-2 py-0.5 rounded-full uppercase">
                {announcements.length} Alert{announcements.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="relative overflow-hidden bg-gradient-to-r from-zinc-950/80 to-zinc-900 border border-white/6 hover:border-[#9c4400]/25 rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-all duration-300 hover-scale active-scale"
                  onClick={() => router.push(`/user/announcements/${announcement.id}`)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#9c4400]/15 text-[#9c4400] rounded-xl mt-0.5">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-extrabold text-white text-sm tracking-tight">{announcement.title}</p>
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{announcement.message}</p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide pt-1">
                        {formatDisplayDate(announcement.announced_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="subscription-card relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-zinc-900 via-zinc-800 to-black border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-overlay"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80')",
            }}
          ></div>
          <div className="absolute top-0 right-0 w-36 h-36 bg-[#f0813d] rounded-full blur-[80px] opacity-10"></div>

          <div className="relative flex justify-between items-start mb-6">
            <div>
              <span className="subscription-plan-label text-[10px] bg-white/10 border border-white/10 text-black font-extrabold tracking-widest uppercase px-2.5 py-1 rounded-full">
                {dashboardData.membership.plan.toUpperCase()} SUBSCRIPTION
              </span>
              <p
                className="subscription-time-left text-3xl font-black font-heading mt-3 tracking-tight flex items-baseline gap-1"
                style={{ color: "#000000", textShadow: "none" }}
              >
                {dashboardData.membership.daysLeft}
                <span
                  className="text-xs font-bold tracking-normal uppercase"
                  style={{ color: "#000000", textShadow: "none" }}
                >
                  days left
                </span>
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                dashboardData.membership.status === "active"
                  ? "bg-[#f0813d]/20 text-[#f0813d] border border-[#f0813d]/30 shadow-[0_0_15px_rgba(240,129,61,0.15)]"
                  : "bg-[#f0813d]/20 text-[#f0813d] border border-[#f0813d]/30"
              }`}
            >
              {dashboardData.membership.status === "active" ? "Active" : "Expired"}
            </span>
          </div>

          <button
            onClick={() => router.push("/profile")}
            className="manage-subscription-button relative w-full py-3 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-2xl text-xs font-bold tracking-wider uppercase text-black transition-all duration-300 active-scale flex items-center justify-center gap-1.5"
          >
            Manage Subscription <ChevronRight className="w-4 h-4 text-[#f0813d]" />
          </button>
        </div>
      </main>
    </div>
  );
}
