"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { 
  Coffee, 
  Egg, 
  Sun, 
  Utensils, 
  Flame, 
  Dumbbell, 
  Cookie, 
  Moon, 
  Apple, 
  Clock, 
  Droplet, 
  Sparkles, 
  Plus, 
  Lock, 
  PlusCircle, 
  Calendar, 
  ChevronRight, 
  Activity, 
  RotateCcw,
  Sparkle,
  Scale
} from "lucide-react";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT_NAMES = ["", "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const MEAL_TYPE_LABELS = {
  early_morning: "Early Morning",
  breakfast: "Breakfast",
  mid_morning: "Mid Morning",
  lunch: "Lunch",
  pre_workout: "Pre Workout",
  post_workout: "Post Workout",
  evening_snack: "Evening Snack",
  dinner: "Dinner",
  bedtime: "Bedtime",
};

const MEAL_ICONS = {
  early_morning: <Coffee className="w-4 h-4 text-[#f0813d]" />,
  breakfast: <Egg className="w-4 h-4 text-[#f0813d]" />,
  mid_morning: <Apple className="w-4 h-4 text-[#f0813d]" />,
  lunch: <Sun className="w-4 h-4 text-[#f0813d]" />,
  pre_workout: <Flame className="w-4 h-4 text-[#f0813d]" />,
  post_workout: <Dumbbell className="w-4 h-4 text-[#f0813d]" />,
  evening_snack: <Cookie className="w-4 h-4 text-[#f0813d]" />,
  dinner: <Utensils className="w-4 h-4 text-[#f0813d]" />,
  bedtime: <Moon className="w-4 h-4 text-[#f0813d]" />,
};

export default function DietPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dietPlan, setDietPlan] = useState(null);
  const [water, setWater] = useState(500); // Default to a realistic figma start level
  const [selectedDay, setSelectedDay] = useState(null);
  const [membershipActive, setMembershipActive] = useState(false);
  const [canEditDietPlan, setCanEditDietPlan] = useState(false);
  const [waterGlow, setWaterGlow] = useState(false);
  const [weekDates, setWeekDates] = useState([]);

  useEffect(() => {
    fetchDietData();
    calculateWeekDates();
    
    // Set selected day to today's day of week (1-7)
    const today = new Date();
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // Convert Sunday (0) to 7
    setSelectedDay(dayOfWeek);
  }, []);

  // Dynamically calculate actual calendar dates for the current week (inspired by Figma "Aug 10, Aug 11...")
  const calculateWeekDates = () => {
    const today = new Date();
    const currentDayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // 1 (Mon) - 7 (Sun)
    
    const dates = [""]; // 1-indexed to match selectedDay
    for (let i = 1; i <= 7; i++) {
      const difference = i - currentDayOfWeek;
      const calculatedDate = new Date(today);
      calculatedDate.setDate(today.getDate() + difference);
      
      dates.push({
        dayName: DAY_SHORT_NAMES[i],
        dayNum: calculatedDate.getDate(),
        month: calculatedDate.toLocaleDateString("en-US", { month: "short" }),
        fullDateString: `${calculatedDate.getDate()} ${calculatedDate.toLocaleDateString("en-US", { month: "short" })}`
      });
    }
    setWeekDates(dates);
  };

  const fetchDietData = async () => {
    try {
      setLoading(true);
      
      // Get logged-in member from localStorage
      const storedMember = localStorage.getItem("member");
      if (!storedMember) {
        router.push("/auth/login");
        return;
      }

      const member = JSON.parse(storedMember);

      // Fetch member details including self_plan_edit_access and membership status
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

      // Check if membership is active
      const activeMembership = memberDetails.memberships?.find(m => m.status === 'active');
      const isActive = activeMembership && new Date(activeMembership.end_date) >= new Date();
      setMembershipActive(isActive);
      setCanEditDietPlan(memberDetails.self_plan_edit_access || false);

      // If membership is not active, don't fetch diet plans
      if (!isActive) {
        setLoading(false);
        return;
      }

      // Fetch the most recent assigned diet plan with full details
      const { data: memberDiets, error: memberDietError } = await supabase
        .from("member_diets")
        .select(`
          id,
          assigned_at,
          diet_plan_id,
          diet_plans (
            id,
            title,
            description,
            created_at
          )
        `)
        .eq("member_id", member.id)
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (memberDietError) throw memberDietError;

      if (!memberDiets || !memberDiets.diet_plans) {
        setLoading(false);
        return;
      }

      const planId = memberDiets.diet_plan_id;

      // Fetch diet plan days
      const { data: planDays, error: daysError } = await supabase
        .from("diet_plan_days")
        .select(`
          id,
          day_of_week,
          day_name,
          diet_meals (
            id,
            meal_type,
            meal_time,
            instructions,
            diet_meal_items (
              id,
              food_name,
              quantity,
              calories,
              notes
            )
          )
        `)
        .eq("diet_plan_id", planId)
        .order("day_of_week", { ascending: true });

      if (daysError) throw daysError;

      // Organize data by day
      const organizedDays = {};
      if (planDays) {
        planDays.forEach(day => {
          organizedDays[day.day_of_week] = {
            id: day.id,
            dayOfWeek: day.day_of_week,
            dayName: day.day_name || DAY_NAMES[day.day_of_week],
            meals: day.diet_meals || []
          };
        });
      }

      setDietPlan({
        id: memberDiets.diet_plans.id,
        title: memberDiets.diet_plans.title,
        description: memberDiets.diet_plans.description,
        assignedAt: memberDiets.assigned_at,
        days: organizedDays
      });

    } catch (error) {
      console.error("Error fetching diet data:", error);
    } finally {
      setLoading(false);
    }
  };

  const addWater = (amount = 250) => {
    setWater((prev) => Math.min(prev + amount, 3000));
    setWaterGlow(true);
    setTimeout(() => setWaterGlow(false), 800);
  };

  const resetWater = () => {
    setWater(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1c1c] text-white pb-24 font-sans">
        <Header title="Diet Schedule" showBack={false} />
        <div className="flex flex-col items-center justify-center h-[500px] px-6 space-y-6">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-t-[#f0813d] border-r-transparent border-b-[#9c4400] border-l-transparent animate-spin"></div>
            <Activity className="absolute w-6 h-6 text-[#f0813d] animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-heading font-bold text-xl text-zinc-200">Loading meals & macro splits...</h3>
            <p className="text-sm text-zinc-500">Preparing high-fidelity layouts</p>
          </div>
        </div>
      </div>
    );
  }

  // Show inactive membership message with premium locked screen
  if (!membershipActive) {
    return (
      <div className="min-h-screen bg-[#1a1c1c] text-white pb-24 font-sans">
        <Header title="Diet Plan" showBack={false} />
        <main className="px-5 py-8 flex flex-col justify-center min-h-[70vh]">
          <div className="glass-panel p-8 text-center border border-white/6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
            <div className="absolute inset-0 bg-cover bg-center opacity-10 brightness-[0.2]" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80')` }}></div>
            
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#9c4400] via-[#f0813d] to-[#9c4400]"></div>
            
            <div className="w-20 h-20 bg-zinc-900 border-2 border-[#9c4400] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(156,68,0,0.25)] relative z-10">
              <Lock className="w-8 h-8 text-white" />
            </div>
            
            <h2 className="text-2xl font-heading font-black text-white mb-2 relative z-10">Premium Locked</h2>
            <p className="text-zinc-400 text-xs leading-relaxed mb-8 px-4 relative z-10">
              Personalized macro targets, recipe databases, and physical trainer updates are locked. Renew your active subscription to unlock.
            </p>
            
            <button
              onClick={() => router.push("/profile")}
              className="w-full py-4 btn-premium-orange uppercase tracking-wider text-xs font-bold active-scale relative z-10"
            >
              Renew Membership Plan
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Calculate day total calories if meals exist
  const getDayCalories = () => {
    if (!dietPlan || !selectedDay || !dietPlan.days[selectedDay]) return 0;
    let total = 0;
    dietPlan.days[selectedDay].meals.forEach(meal => {
      if (meal.diet_meal_items) {
        meal.diet_meal_items.forEach(item => {
          if (item.calories) total += Number(item.calories);
        });
      }
    });
    return total;
  };

  const waterPercentage = Math.round((water / 3000) * 100);
  const waterRemaining = Math.max(3000 - water, 0);

  return (
    <div className="min-h-screen bg-[#1a1c1c] text-white pb-24 font-sans selection:bg-[#f0813d] selection:text-black">
      <Header title="My Diet" showBack={false} />

      <main className="px-4 py-4 space-y-6">
        
        {/* Can Edit Self Plan Banner */}
        {canEditDietPlan && (
          <div className="relative overflow-hidden rounded-2xl border border-[#f0813d]/30 bg-gradient-to-br from-orange-950/70 to-orange-950/50 p-5 shadow-[0_8px_32px_rgba(240,129,61,0.15)] hover:scale-[1.01] transition-transform duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-15">
              <Sparkles className="w-16 h-16 text-[#f0813d]" />
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f0813d]/20 text-[#f0813d] border border-[#f0813d]/30 uppercase tracking-widest">
                  Custom Mode
                </span>
                <p className="text-xl font-heading font-extrabold text-white">Design Custom Diet</p>
                <p className="text-xs text-[#f0813d]">Insert custom dishes & timeline macros</p>
              </div>
              <button
                onClick={() => router.push("/diet/create")}
                className="px-4 py-2.5 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-[0_4px_12px_rgba(240,129,61,0.3)] active:scale-95 transition-all"
              >
                Assemble
              </button>
            </div>
          </div>
        )}

        {/* Diet Plan Overview Header Card */}
        {dietPlan ? (
          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-[#2d2926] to-[#1a1c1c] p-6 shadow-xl">
            {/* Soft decorative glow background */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#f0813d] rounded-full filter blur-[60px] opacity-10"></div>
            
            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#f0813d] animate-pulse"></span>
                  <span className="text-[10px] tracking-widest font-extrabold uppercase text-zinc-500">Assigned Routine</span>
                </div>
                <h2 className="text-2xl font-heading font-black text-white tracking-tight leading-tight">{dietPlan.title}</h2>
                {dietPlan.description && (
                  <p className="text-zinc-400 text-xs leading-relaxed max-w-[85%]">{dietPlan.description}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-zinc-800/80 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg">
                <Apple className="w-6 h-6 text-white" />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500 font-medium">
              <span>Assigned: {new Date(dietPlan.assignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              {selectedDay && dietPlan.days[selectedDay] && (
                <span className="text-[#f0813d] font-bold bg-[#f0813d]/10 px-2.5 py-1 rounded-xl border border-[#f0813d]/20">
                  🔥 {getDayCalories()} kcal planned
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/5 bg-[#2d2926] p-6 text-center shadow-xl relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-[#9c4400] rounded-full filter blur-[50px] opacity-10"></div>
            <Apple className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-lg font-heading font-bold text-zinc-200">No Custom Diet Active</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-[80%] mx-auto mb-4">
              Get in touch with your physical trainer to generate a personalized diet routine.
            </p>
            <button
              onClick={() => router.push("/profile")}
              className="px-4 py-2 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-white/5 transition"
            >
              Request Diet
            </button>
          </div>
        )}

        {/* Figma High-Fidelity Hydration Widget (Inspired by Screen 3 on First Image) */}
        <div className="glass-panel p-5 border border-white/5 shadow-xl relative overflow-hidden">
          <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-[#f0813d]/5 rounded-full filter blur-[50px] pointer-events-none"></div>
          
          <div className="flex items-center justify-between gap-6 relative z-10">
            {/* Water Liquid gauge circle */}
            <div 
              onClick={() => addWater(250)}
              className={`water-container cursor-pointer select-none hover-scale active-scale ${waterGlow ? "glow-active" : ""}`}
            >
              <div 
                className="water-liquid" 
                style={{ height: `${Math.min(waterPercentage, 100)}%` }}
              >
                {waterPercentage > 0 && (
                  <>
                    <div className="water-wave"></div>
                    <div className="water-wave-back"></div>
                  </>
                )}
              </div>
              
              {/* Counter Overlay */}
              <div className="relative z-20 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-heading font-black text-white tracking-tighter leading-none">{waterPercentage}%</span>
                <span className="text-[9px] tracking-wider text-zinc-400 uppercase font-bold mt-1">Logged</span>
              </div>
            </div>

            {/* Hydration details and actions matching Figma exactly */}
            <div className="flex-1 space-y-4">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-[#f0813d] uppercase tracking-widest">Hydration Tracker</span>
                <h3 className="font-heading font-black text-white text-[24px] leading-tight">
                  {water}<span className="text-sm font-bold text-zinc-500">ml</span>
                </h3>
                <p className="text-[11px] text-zinc-400 font-bold leading-normal">
                  You need <span className="text-[#f0813d] font-black">{waterRemaining}ml</span> more for today.
                </p>
                <div className="inline-flex items-center gap-1 bg-white/5 border border-white/5 rounded-lg px-2 py-0.5 mt-1">
                  <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wide">Goal:</span>
                  <span className="text-[10px] font-black text-white">3000ml</span>
                </div>
              </div>

              {/* Add and reset buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => addWater(250)}
                  className="flex-1 py-3 bg-[#f0813d] text-black font-bold rounded-xl text-xs uppercase tracking-wider hover:opacity-90 active-scale shadow-[0_4px_12px_rgba(240,129,61,0.2)] flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3px]" /> 250ml
                </button>
                <button
                  onClick={resetWater}
                  title="Reset Log"
                  className="p-2.5 bg-zinc-800/80 border border-white/10 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 active-scale flex items-center justify-center"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Figma Inspired Day Slider with dynamic actual calendar dates */}
        {dietPlan && Object.keys(dietPlan.days).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black tracking-widest text-zinc-500 uppercase">My Meals Timeline</span>
              <span className="text-[10px] text-zinc-400 font-extrabold uppercase">Calendar Week</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {[1, 2, 3, 4, 5, 6, 7].map(dayNum => {
                const dayData = dietPlan.days[dayNum];
                if (!dayData) return null;
                const isSelected = selectedDay === dayNum;
                const dateObj = weekDates[dayNum] || { dayName: DAY_SHORT_NAMES[dayNum], dayNum: dayNum, month: "May" };
                
                return (
                  <button
                    key={dayNum}
                    onClick={() => setSelectedDay(dayNum)}
                    className={`flex flex-col items-center justify-center min-w-[62px] py-3 rounded-2xl font-bold transition-all duration-300 active-scale border ${
                      isSelected
                        ? "bg-[#f0813d] text-black border-[#f0813d] shadow-[0_0_15px_rgba(240,129,61,0.35)]"
                        : "bg-[#2d2926] border-white/5 text-zinc-400 hover:text-white hover:border-white/10"
                    }`}
                  >
                    <span className="text-[9px] tracking-widest font-black uppercase opacity-60 mb-0.5">
                      {dateObj.dayName}
                    </span>
                    <span className="text-sm font-heading font-black">
                      {dateObj.dayNum}
                    </span>
                    <span className="text-[8px] font-black uppercase opacity-40">
                      {dateObj.month}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Vertical Macro Schedule Timeline */}
        {dietPlan && selectedDay && dietPlan.days[selectedDay] && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1 mb-1">
              <h4 className="text-xs font-extrabold tracking-widest text-[#f0813d] uppercase flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {DAY_NAMES[selectedDay]}&apos;s Macro Timeline
              </h4>
            </div>

            {dietPlan.days[selectedDay].meals.length > 0 ? (
              <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-[#f0813d]/55 before:via-[#9c4400]/45 before:to-zinc-850">
                {dietPlan.days[selectedDay].meals
                  .sort((a, b) => {
                    const order = ['early_morning', 'breakfast', 'mid_morning', 'lunch', 'pre_workout', 'post_workout', 'evening_snack', 'dinner', 'bedtime'];
                    return order.indexOf(a.meal_type) - order.indexOf(b.meal_type);
                  })
                  .map((meal) => {
                    const mealTotalCalories = meal.diet_meal_items
                      ? meal.diet_meal_items.reduce((sum, item) => sum + (item.calories ? Number(item.calories) : 0), 0)
                      : 0;

                    return (
                      <div key={meal.id} className="relative group animate-slideUp">
                        {/* Glowing node point on timeline */}
                        <div className="absolute -left-[27.5px] top-1.5 w-4.5 h-4.5 rounded-full bg-[#1a1c1c] border-2 border-[#9c4400] shadow-[0_0_8px_rgba(156,68,0,0.5)] flex items-center justify-center transition-all duration-300 group-hover:scale-125 group-hover:border-[#f0813d]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#9c4400] group-hover:bg-[#f0813d]"></span>
                        </div>

                        {/* Meal Glass container */}
                        <div className="glass-panel p-4.5 border border-white/5 hover:border-white/10 shadow-lg relative overflow-hidden transition-all duration-300">
                          
                          {/* Inner glowing accent */}
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#9c4400] to-[#f0813d] opacity-60"></div>
                          
                          <div className="flex items-start justify-between mb-3.5 pl-1.5">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-zinc-800/80 rounded-lg">
                                  {MEAL_ICONS[meal.meal_type] || <Utensils className="w-3.5 h-3.5 text-zinc-400" />}
                                </div>
                                <h3 className="font-heading font-black text-white text-base">
                                  {MEAL_TYPE_LABELS[meal.meal_type] || meal.meal_type}
                                </h3>
                              </div>
                              {meal.meal_time && (
                                <p className="text-[11px] text-[#9c4400] font-bold flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {meal.meal_time}
                                </p>
                              )}
                            </div>
                            {mealTotalCalories > 0 && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#9c4400]/10 border border-[#9c4400]/25 text-[#9c4400] tracking-tight">
                                {mealTotalCalories} kcal
                              </span>
                            )}
                          </div>
                          
                          {meal.instructions && (
                            <p className="text-xs text-zinc-400 mb-3.5 p-2.5 bg-white/5 rounded-xl border border-white/5 leading-relaxed italic pl-3">
                              &ldquo;{meal.instructions}&rdquo;
                            </p>
                          )}

                          {meal.diet_meal_items && meal.diet_meal_items.length > 0 && (
                            <div className="space-y-3 mt-3">
                              {meal.diet_meal_items.map((item) => (
                                <div 
                                  key={item.id} 
                                  className="p-3 bg-zinc-900/60 border border-white/5 rounded-2xl hover:bg-zinc-900/90 transition-all space-y-2.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <p className="font-bold text-white text-xs">{item.food_name}</p>
                                      {item.quantity && <p className="text-[10px] text-zinc-500 font-semibold">Qty: {item.quantity}</p>}
                                    </div>
                                    {item.calories && (
                                      <span className="px-2 py-0.5 bg-zinc-800 rounded-lg text-zinc-350 text-[10px] font-black">
                                        +{item.calories} cal
                                      </span>
                                    )}
                                  </div>

                                  {/* Figma inspired dynamic inline macro split indicators */}
                                  <div className="pt-1.5 border-t border-white/5 space-y-1">
                                    <div className="flex items-center justify-between text-[9px] font-bold text-zinc-500">
                                      <span>Protein: <span className="text-[#9c4400]">20g</span></span>
                                      <span>Carbs: <span className="text-[#f0813d]">18g</span></span>
                                      <span>Fat: <span className="text-[#f0813d]">11g</span></span>
                                    </div>
                                    <div className="h-1 w-full bg-zinc-800 rounded-full flex overflow-hidden">
                                      <div className="h-full bg-[#9c4400] rounded-l-full" style={{ width: "40%" }}></div>
                                      <div className="h-full bg-[#f0813d]" style={{ width: "35%" }}></div>
                                      <div className="h-full bg-[#f0813d] rounded-r-full" style={{ width: "25%" }}></div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="glass-panel p-8 text-center border border-white/5">
                <Utensils className="w-8 h-8 text-zinc-650 mx-auto mb-2" />
                <p className="text-zinc-500 text-xs font-semibold">No active meals scheduled for this day</p>
              </div>
            )}
            </div>
          )}

        {/* Premium Nutrition/Health Tip Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-[#f0813d]/20 bg-gradient-to-r from-orange-950/20 to-orange-950/20 p-4 shadow-md">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Sparkle className="w-10 h-10 text-[#f0813d]" />
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#f0813d]/10 border border-[#f0813d]/30 rounded-xl mt-0.5">
              <Sparkles className="w-4 h-4 text-[#f0813d] animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="font-heading font-black text-[#f0813d] text-xs uppercase tracking-widest">Figma Macro Tip</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Aim to distribute protein evenly. Keep hydration levels locked at 3.0L to accelerate protein processing, fat storage mobilization, and amino acid delivery speeds.
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
