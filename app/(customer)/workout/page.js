"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { 
  ChevronDown, 
  ChevronUp, 
  Dumbbell, 
  Clock, 
  RotateCcw, 
  Lock, 
  Trophy, 
  Target, 
  Flame, 
  Sparkles, 
  Plus 
} from "lucide-react";

export default function WorkoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [workoutPlans, setWorkoutPlans] = useState([]);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [membershipActive, setMembershipActive] = useState(false);
  const [canEditWorkoutPlan, setCanEditWorkoutPlan] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);

  // Get today's day number (1=Monday, 6=Saturday, 0=Sunday)
  const getTodayDayNumber = () => {
    const day = new Date().getDay();
    return day === 0 ? 0 : day; // Sunday = 0, Monday = 1, etc.
  };

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  useEffect(() => {
    fetchWorkoutData();
  }, []);

  const fetchWorkoutData = async () => {
    try {
      setLoading(true);
      
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
          self_plan_edit_access,
          memberships (
            id,
            status,
            end_date
          )
        `)
        .eq("id", member.id)
        .single();

      if (memberError) throw memberError;

      const activeMembership = memberDetails.memberships?.find(m => m.status === 'active');
      const isActive = activeMembership && new Date(activeMembership.end_date) >= new Date();
      setMembershipActive(isActive);
      setCanEditWorkoutPlan(memberDetails.self_plan_edit_access || false);

      if (!isActive) {
        setLoading(false);
        return;
      }

      const { data: memberWorkouts, error } = await supabase
        .from("member_workouts")
        .select(`
          id,
          assigned_at,
          workout_plan_id,
          workout_plans (
            id,
            title,
            goal,
            level,
            description,
            created_at,
            workout_plan_days (
              id,
              day_of_week,
              day_name,
              focus,
              workout_exercises (
                id,
                exercise_name,
                sets,
                reps,
                weight,
                rest_seconds,
                notes,
                exercise_order
              )
            )
          )
        `)
        .eq("member_id", member.id)
        .order("assigned_at", { ascending: false });

      if (error) throw error;

      if (memberWorkouts && memberWorkouts.length > 0) {
        const plans = memberWorkouts.map(mw => {
          const plan = mw.workout_plans;
          const sortedDays = plan?.workout_plan_days?.sort((a, b) => a.day_of_week - b.day_of_week) || [];
          sortedDays.forEach(day => {
            if (day.workout_exercises) {
              day.workout_exercises.sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0));
            }
          });
          
          return {
            id: mw.id,
            planId: plan?.id,
            title: plan?.title || "Workout Plan",
            goal: plan?.goal,
            level: plan?.level,
            description: plan?.description,
            assignedAt: mw.assigned_at,
            days: sortedDays,
          };
        });

        setWorkoutPlans(plans);

        const todayNum = getTodayDayNumber();
        const latestPlan = plans[0];
        const todayDay = latestPlan.days?.find(d => d.day_of_week === todayNum);
        
        setTodayWorkout({
          name: latestPlan.title,
          focus: todayDay?.focus || (todayNum === 0 ? "Rest Day" : "No workout scheduled"),
          dayName: dayNames[todayNum],
          exercises: todayDay?.workout_exercises || [],
          isRestDay: todayNum === 0 || !todayDay,
        });

        setExpandedPlan(plans[0].id);
      } else {
        setTodayWorkout({
          name: "No workout assigned",
          focus: "-",
          dayName: dayNames[getTodayDayNumber()],
          exercises: [],
          isRestDay: true,
        });
      }

    } catch (error) {
      console.error("Error fetching workout data:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePlan = (planId) => {
    setExpandedPlan(expandedPlan === planId ? null : planId);
    setExpandedDay(null);
  };

  const toggleDay = (dayId) => {
    setExpandedDay(expandedDay === dayId ? null : dayId);
  };

  const getLevelBadge = (level) => {
    switch (level?.toLowerCase()) {
      case "beginner":
        return <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-[#f0813d]/15 text-[#f0813d] border border-[#f0813d]/20">Beginner</span>;
      case "intermediate":
        return <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-[#9c4400]/15 text-[#9c4400] border border-[#9c4400]/20">Intermediate</span>;
      case "advanced":
        return <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-[#f0813d]/15 text-[#f0813d] border border-[#f0813d]/20">Advanced</span>;
      default:
        return <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-zinc-800 text-zinc-400 border border-white/5">{level}</span>;
    }
  };

  const getGoalBadge = (goal) => {
    switch (goal?.toLowerCase()) {
      case "fat loss":
        return <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-[#f0813d]/15 text-[#f0813d] border border-[#f0813d]/20">Fat Loss</span>;
      case "muscle gain":
        return <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-[#f0813d]/15 text-[#f0813d] border border-[#f0813d]/20">Muscle Gain</span>;
      case "strength":
        return <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-[#f0813d]/15 text-[#f0813d] border border-[#f0813d]/20">Strength</span>;
      case "endurance":
        return <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-[#f0813d]/15 text-[#f0813d] border border-[#f0813d]/20">Endurance</span>;
      default:
        return <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-zinc-800 text-zinc-400 border border-white/5">{goal}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1c1c] text-white pb-24">
        <Header title="Workout" showBack={false} />
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f0813d]"></div>
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Loading workouts...</p>
        </div>
      </div>
    );
  }

  if (!membershipActive) {
    return (
      <div className="min-h-screen bg-[#1a1c1c] text-white pb-24 animate-fadeIn">
        <Header title="Workout" showBack={false} />
        <main className="px-4 py-8 max-w-md mx-auto">
          <div className="glass-panel p-8 text-center border-white/8 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#f0813d] rounded-full blur-[80px] opacity-10"></div>
            
            <div className="w-20 h-20 bg-[#f0813d]/10 border border-[#f0813d]/25 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-white" />
            </div>
            
            <h2 className="text-2xl font-black font-heading tracking-tight mb-2 uppercase text-white">Membership Required</h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              Your membership is currently inactive. Renew subscription to unlock and view your training routines.
            </p>
            
            <button
              onClick={() => router.push("/profile")}
              className="w-full py-3.5 btn-premium-orange uppercase font-bold text-xs tracking-wider transition-all duration-300"
            >
              Renew Membership to Continue
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1c1c] text-white pb-28 animate-fadeIn">
      <Header title="Workout" showBack={false} />

      <main className="px-4 py-5 space-y-6">
        {/* Create Own Workout Plan Options */}
        {canEditWorkoutPlan && (
          <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-orange-950/40 via-orange-900/20 to-black border border-[#f0813d]/25 shadow-lg group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#f0813d] rounded-full blur-[50px] opacity-10"></div>
            <div className="flex items-center justify-between relative">
              <div className="space-y-1">
                <span className="text-[9px] font-black tracking-widest text-[#f0813d] uppercase">Self Plan Creator</span>
                <p className="text-sm font-extrabold text-white tracking-tight">Design Your Custom Workouts</p>
              </div>
              <button
                onClick={() => router.push("/workout/create")}
                className="py-2.5 px-4 bg-[#f0813d] hover:bg-[#f0813d] text-white rounded-xl font-extrabold text-xs tracking-wider uppercase transition-all duration-300 active-scale shadow-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Create
              </button>
            </div>
          </div>
        )}

        {/* Today's Target Card - High-Fidelity Gym backdrop Photo */}
        <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-zinc-900 to-black border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
          {!todayWorkout?.isRestDay ? (
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay"
              style={{ backgroundImage: `url('https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80')` }}
            ></div>
          ) : (
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-15 mix-blend-overlay"
              style={{ backgroundImage: `url('https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80')` }}
            ></div>
          )}
          
          <div className="absolute top-0 right-0 w-36 h-36 bg-[#f0813d] rounded-full blur-[80px] opacity-10"></div>

          <div className="relative flex justify-between items-start mb-4">
            <div className="space-y-1">
              <span className="workout-today-label text-[9px] bg-white/10 border border-white/10 text-black font-extrabold tracking-widest uppercase px-2.5 py-1 rounded-full">
                {todayWorkout?.dayName.toUpperCase()} • TODAY
              </span>
              <h2 className="text-2xl font-black font-heading mt-3 tracking-tight text-white leading-tight">
                {todayWorkout?.focus.toUpperCase()}
              </h2>
              {!todayWorkout?.isRestDay && (
                <p className="text-zinc-400 text-xs font-semibold">{todayWorkout?.name}</p>
              )}
            </div>
            <span className="text-4xl p-2.5 bg-zinc-950/60 rounded-2xl border border-white/5 shadow-md">
              {todayWorkout?.isRestDay ? '😴' : '💪'}
            </span>
          </div>

          {!todayWorkout?.isRestDay && todayWorkout?.exercises?.length > 0 && (
            <div className="relative flex items-center gap-4 text-xs text-[#f0813d] font-bold">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0813d]/10 border border-[#f0813d]/15 rounded-xl">
                <Dumbbell className="w-4 h-4" />
                {todayWorkout.exercises.length} Exercises Scheduled
              </span>
            </div>
          )}
        </div>

        {/* Today's Exercises Preview list */}
        {!todayWorkout?.isRestDay && todayWorkout?.exercises?.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-black tracking-widest text-zinc-400 uppercase">Today's Exercises</h3>
            <div className="glass-panel overflow-hidden border-white/6 shadow-xl">
              <div className="divide-y divide-white/6">
                {todayWorkout.exercises.map((exercise, idx) => (
                  <div key={exercise.id || idx} className="p-4.5 hover:bg-white/3 transition-colors duration-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-[#f0813d] text-[#1a1c1c] font-black rounded-lg flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <p className="font-extrabold text-sm text-white tracking-tight">{exercise.exercise_name}</p>
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5 ml-7">
                          {exercise.sets && (
                            <span className="px-2 py-0.5 bg-zinc-800 border border-white/5 text-zinc-300 text-[10px] font-bold rounded-md">
                              {exercise.sets} Sets
                            </span>
                          )}
                          {exercise.reps && (
                            <span className="px-2 py-0.5 bg-zinc-800 border border-white/5 text-zinc-300 text-[10px] font-bold rounded-md">
                              {exercise.reps} Reps
                            </span>
                          )}
                          {exercise.weight && (
                            <span className="px-2 py-0.5 bg-[#9c4400]/10 border border-[#9c4400]/15 text-[#9c4400] text-[10px] font-bold rounded-md">
                              {exercise.weight}
                            </span>
                          )}
                          {exercise.rest_seconds && (
                            <span className="px-2 py-0.5 bg-zinc-800 border border-white/5 text-zinc-300 text-[10px] font-bold rounded-md flex items-center gap-1">
                              <RotateCcw className="w-3 h-3 text-zinc-400" />
                              {exercise.rest_seconds}s Rest
                            </span>
                          )}
                        </div>
                        {exercise.notes && (
                          <p className="text-xs text-zinc-400 ml-7 leading-relaxed bg-white/3 p-2.5 rounded-xl border border-white/5">
                            <span className="text-[#f0813d] font-bold">Note:</span> {exercise.notes}
                          </p>
                        )}
                      </div>
                      <span className="text-xl ml-3 p-2 bg-zinc-900 rounded-xl border border-white/5">🏋️</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* All Workout Plans day breakdown */}
        {workoutPlans.length === 0 ? (
          <div className="glass-panel p-8 border-white/6 text-center shadow-lg">
            <div className="w-16 h-16 bg-zinc-800 border border-white/8 rounded-full flex items-center justify-center mx-auto mb-4">
              <Dumbbell className="w-6 h-6 text-white" />
            </div>
            <p className="text-white font-extrabold text-sm uppercase mb-1">No Workouts Assigned</p>
            <p className="text-zinc-400 text-xs leading-relaxed max-w-xs mx-auto">
              Please contact your dedicated trainer to customize a premium training routine for your fitness goal.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-xs font-black tracking-widest text-zinc-400 uppercase">My Workout Plans</h3>
            
            {workoutPlans.map((plan) => (
              <div key={plan.id} className="glass-panel border-white/6 shadow-md overflow-hidden animate-slideUp">
                {/* Plan Header - Clickable */}
                <button
                  onClick={() => togglePlan(plan.id)}
                  className="w-full p-4.5 flex items-center justify-between hover:bg-white/3 transition-colors duration-200"
                >
                  <div className="flex-1 text-left space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-extrabold text-base tracking-tight text-white">{plan.title}</h4>
                      {plan.level && getLevelBadge(plan.level)}
                      {plan.goal && getGoalBadge(plan.goal)}
                    </div>
                    <p className="text-xs text-zinc-400 font-medium">
                      {plan.days?.length || 0} training days • Assigned {new Date(plan.assignedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </p>
                  </div>
                  {expandedPlan === plan.id ? (
                    <ChevronUp className="text-[#f0813d]" size={20} />
                  ) : (
                    <ChevronDown className="text-zinc-500" size={20} />
                  )}
                </button>

                {/* Plan Days - Expandable */}
                {expandedPlan === plan.id && (
                  <div className="border-t border-white/6 bg-zinc-950/20">
                    {plan.description && (
                      <p className="px-4.5 py-3 text-xs text-zinc-400 bg-white/3 border-b border-white/5 leading-relaxed">
                        {plan.description}
                      </p>
                    )}
                    
                    {plan.days?.length === 0 ? (
                      <p className="p-6 text-xs text-zinc-500 text-center uppercase font-bold tracking-wider">
                        No training days configured for this plan
                      </p>
                    ) : (
                      <div className="divide-y divide-white/6">
                        {plan.days?.map((day) => (
                          <div key={day.id}>
                            {/* Day Header */}
                            <button
                              onClick={() => toggleDay(day.id)}
                              className="w-full px-4.5 py-3.5 flex items-center justify-between hover:bg-white/3 transition-colors duration-200"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-zinc-800 to-zinc-950 border border-white/8 rounded-xl flex items-center justify-center">
                                  <span className="text-[#f0813d] font-black text-xs font-heading">
                                    {day.day_name?.slice(0, 3).toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-left space-y-0.5">
                                  <p className="font-extrabold text-sm text-white tracking-tight">{day.day_name}</p>
                                  <p className="text-xs text-zinc-400 font-semibold">{day.focus || "General Workout"}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 bg-zinc-900 border border-white/5 px-2 py-0.5 rounded-md">
                                  {day.workout_exercises?.length || 0} exercises
                                </span>
                                {expandedDay === day.id ? (
                                  <ChevronUp className="text-[#f0813d]" size={16} />
                                ) : (
                                  <ChevronDown className="text-zinc-500" size={16} />
                                )}
                              </div>
                            </button>

                            {/* Day Exercises */}
                            {expandedDay === day.id && day.workout_exercises?.length > 0 && (
                              <div className="bg-zinc-950/40 px-4 py-3.5 space-y-3">
                                {day.workout_exercises.map((exercise, exIdx) => (
                                  <div 
                                    key={exercise.id || exIdx}
                                    className="bg-[#2d2926] rounded-2xl p-4 border border-white/5 shadow-md"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2.5">
                                          <span className="w-5.5 h-5.5 bg-[#f0813d]/15 text-[#f0813d] border border-[#f0813d]/25 rounded-lg flex items-center justify-center text-[10px] font-black font-heading">
                                            {exIdx + 1}
                                          </span>
                                          <p className="font-extrabold text-sm text-white tracking-tight">{exercise.exercise_name}</p>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-1.5 ml-8">
                                          {exercise.sets && (
                                            <span className="px-2 py-0.5 bg-zinc-800 border border-white/5 text-zinc-300 text-[10px] font-bold rounded-md">
                                              {exercise.sets} Sets
                                            </span>
                                          )}
                                          {exercise.reps && (
                                            <span className="px-2 py-0.5 bg-zinc-800 border border-white/5 text-zinc-300 text-[10px] font-bold rounded-md">
                                              {exercise.reps} Reps
                                            </span>
                                          )}
                                          {exercise.weight && (
                                            <span className="px-2 py-0.5 bg-[#9c4400]/10 border border-[#9c4400]/15 text-[#9c4400] text-[10px] font-bold rounded-md">
                                              {exercise.weight}
                                            </span>
                                          )}
                                          {exercise.rest_seconds && (
                                            <span className="px-2 py-0.5 bg-zinc-800 border border-white/5 text-zinc-300 text-[10px] font-bold rounded-md">
                                              {exercise.rest_seconds}s Rest
                                            </span>
                                          )}
                                        </div>
                                        {exercise.notes && (
                                          <p className="text-xs text-zinc-400 ml-8 leading-relaxed bg-white/3 p-2.5 rounded-xl border border-white/5">
                                            <span className="text-[#f0813d] font-bold">💡 Note:</span> {exercise.notes}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
