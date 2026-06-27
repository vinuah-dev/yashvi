"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/contexts/ToastContext";
import { ChefHat, Image as ImageIcon, Upload } from "lucide-react";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DIET_HERO_IMAGE = "https://inkbd.com/wp-content/uploads/2024/08/Quick-and-Tasty-Mediterranean-Diet-Recipes-for-Weight-Loss-1.jpg";
const MEAL_TYPES = [
  { value: "early_morning", label: "Early Morning" },
  { value: "breakfast", label: "Breakfast" },
  { value: "mid_morning", label: "Mid Morning" },
  { value: "lunch", label: "Lunch" },
  { value: "pre_workout", label: "Pre Workout" },
  { value: "post_workout", label: "Post Workout" },
  { value: "evening_snack", label: "Evening Snack" },
  { value: "dinner", label: "Dinner" },
  { value: "bedtime", label: "Bedtime" },
];

export default function CreateMemberDietPlanPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [membershipActive, setMembershipActive] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [formData, setFormData] = useState({
    title: "My Personal Diet Plan",
    description: "",
  });
  const [days, setDays] = useState({});
  const [coverPreview, setCoverPreview] = useState(DIET_HERO_IMAGE);

  useEffect(() => {
    checkAccessAndFetchData();
  }, []);

  const checkAccessAndFetchData = async () => {
    try {
      setLoading(true);
      
      // Get logged-in member from localStorage
      const storedMember = localStorage.getItem("member");
      if (!storedMember) {
        router.push("/auth/login");
        return;
      }

      const memberData = JSON.parse(storedMember);
      setMember(memberData);

      // Fetch member details to check access
      const { data: memberDetails, error: memberError } = await supabase
        .from("members")
        .select(`
          id,
          gym_id,
          self_plan_edit_access,
          memberships (
            id,
            status,
            end_date
          )
        `)
        .eq("id", memberData.id)
        .single();

      if (memberError) throw memberError;

      // Check if membership is active
      const activeMembership = memberDetails.memberships?.find(m => m.status === 'active');
      const isActive = activeMembership && new Date(activeMembership.end_date) >= new Date();
      setMembershipActive(isActive);

      // Check if member has access
      const canEdit = memberDetails.self_plan_edit_access || false;
      setHasAccess(canEdit);

      if (!isActive || !canEdit) {
        setLoading(false);
        return;
      }

      setMember({ ...memberData, gym_id: memberDetails.gym_id });

      // Initialize days
      const initialDays = {};
      for (let i = 1; i <= 7; i++) {
        initialDays[i] = {
          day_of_week: i,
          day_name: DAY_NAMES[i],
          meals: [],
        };
      }
      setDays(initialDays);

      // Check if member already has a self-created diet plan
      const { data: existingPlan, error: planError } = await supabase
        .from("diet_plans")
        .select(`
          id,
          title,
          description,
          diet_plan_days (
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
          )
        `)
        .eq("created_by_member_id", memberData.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!planError && existingPlan) {
        setFormData({
          title: existingPlan.title,
          description: existingPlan.description || "",
        });

        // Organize existing plan data
        const organizedDays = {};
        if (existingPlan.diet_plan_days) {
          existingPlan.diet_plan_days.forEach(day => {
            organizedDays[day.day_of_week] = {
              id: day.id,
              day_of_week: day.day_of_week,
              day_name: day.day_name || DAY_NAMES[day.day_of_week],
              meals: (day.diet_meals || []).map(meal => ({
                id: meal.id,
                meal_type: meal.meal_type,
                meal_time: meal.meal_time || "",
                instructions: meal.instructions || "",
                items: (meal.diet_meal_items || []).map(item => ({
                  id: item.id,
                  food_name: item.food_name,
                  quantity: item.quantity || "",
                  calories: item.calories || "",
                  notes: item.notes || "",
                })),
              })),
            };
          });
        }

        // Fill in missing days
        for (let i = 1; i <= 7; i++) {
          if (!organizedDays[i]) {
            organizedDays[i] = {
              day_of_week: i,
              day_name: DAY_NAMES[i],
              meals: [],
            };
          }
        }

        setDays(organizedDays);
      }

    } catch (error) {
      console.error("Error checking access:", error);
      showError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      showError("Please enter a title for your diet plan");
      return;
    }

    if (!member || !member.gym_id) {
      showError("Member data not found");
      return;
    }

    setSaving(true);
    try {
      // Check for existing plan
      const { data: existingPlan } = await supabase
        .from("diet_plans")
        .select("id")
        .eq("created_by_member_id", member.id)
        .maybeSingle();

      let planId;

      if (existingPlan) {
        // Update existing plan
        const { error: updateError } = await supabase
          .from("diet_plans")
          .update({
            title: formData.title,
            description: formData.description || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPlan.id);

        if (updateError) throw updateError;
        planId = existingPlan.id;

        // Delete existing days and recreate
        const { error: deleteError } = await supabase
          .from("diet_plan_days")
          .delete()
          .eq("diet_plan_id", existingPlan.id);

        if (deleteError) throw deleteError;
      } else {
        // Create new plan
        const { data: newPlan, error: insertError } = await supabase
          .from("diet_plans")
          .insert({
            gym_id: member.gym_id,
            title: formData.title,
            description: formData.description || null,
            is_template: false,
            created_by_member_id: member.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        planId = newPlan.id;

        // Also assign this diet plan to the member
        const { error: assignError } = await supabase
          .from("member_diets")
          .insert({
            member_id: member.id,
            diet_plan_id: planId,
          });

        if (assignError) throw assignError;
      }

      // Create days and meals
      for (const dayNum of Object.keys(days)) {
        const day = days[dayNum];
        if (day.meals && day.meals.length > 0) {
          // Create day
          const { data: dayData, error: dayError } = await supabase
            .from("diet_plan_days")
            .insert({
              diet_plan_id: planId,
              day_of_week: parseInt(dayNum),
              day_name: day.day_name,
            })
            .select()
            .single();

          if (dayError) throw dayError;

          // Create meals for this day
          for (const meal of day.meals) {
            if (!meal.meal_type) continue;

            const { data: mealData, error: mealError } = await supabase
              .from("diet_meals")
              .insert({
                diet_plan_day_id: dayData.id,
                meal_type: meal.meal_type,
                meal_time: meal.meal_time || null,
                instructions: meal.instructions || null,
              })
              .select()
              .single();

            if (mealError) throw mealError;

            // Create meal items
            if (meal.items && meal.items.length > 0) {
              const itemsToInsert = meal.items
                .filter(item => item.food_name && item.food_name.trim())
                .map(item => ({
                  diet_meal_id: mealData.id,
                  food_name: item.food_name,
                  quantity: item.quantity || null,
                  calories: item.calories || null,
                  notes: item.notes || null,
                }));

              if (itemsToInsert.length > 0) {
                const { error: itemsError } = await supabase
                  .from("diet_meal_items")
                  .insert(itemsToInsert);

                if (itemsError) throw itemsError;
              }
            }
          }
        }
      }

      showSuccess("Diet plan saved successfully!");
      router.push("/diet");
    } catch (error) {
      console.error("Error saving diet plan:", error);
      showError("Failed to save diet plan: " + (error.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const addMealToDay = (dayNum) => {
    setDays(prev => ({
      ...prev,
      [dayNum]: {
        ...prev[dayNum],
        meals: [...(prev[dayNum].meals || []), {
          meal_type: "",
          meal_time: "",
          instructions: "",
          items: [],
        }],
      },
    }));
  };

  const updateMeal = (dayNum, mealIndex, field, value) => {
    setDays(prev => {
      const newDays = { ...prev };
      const newMeals = [...newDays[dayNum].meals];
      newMeals[mealIndex] = { ...newMeals[mealIndex], [field]: value };
      newDays[dayNum] = { ...newDays[dayNum], meals: newMeals };
      return newDays;
    });
  };

  const removeMeal = (dayNum, mealIndex) => {
    setDays(prev => {
      const newDays = { ...prev };
      const newMeals = [...newDays[dayNum].meals];
      newMeals.splice(mealIndex, 1);
      newDays[dayNum] = { ...newDays[dayNum], meals: newMeals };
      return newDays;
    });
  };

  const addItemToMeal = (dayNum, mealIndex) => {
    setDays(prev => {
      const newDays = { ...prev };
      const newMeals = [...newDays[dayNum].meals];
      if (!newMeals[mealIndex].items) {
        newMeals[mealIndex].items = [];
      }
      newMeals[mealIndex].items = [...newMeals[mealIndex].items, {
        food_name: "",
        quantity: "",
        calories: "",
        notes: "",
      }];
      newDays[dayNum] = { ...newDays[dayNum], meals: newMeals };
      return newDays;
    });
  };

  const updateMealItem = (dayNum, mealIndex, itemIndex, field, value) => {
    setDays(prev => {
      const newDays = { ...prev };
      const newMeals = [...newDays[dayNum].meals];
      const newItems = [...newMeals[mealIndex].items];
      newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
      newMeals[mealIndex] = { ...newMeals[mealIndex], items: newItems };
      newDays[dayNum] = { ...newDays[dayNum], meals: newMeals };
      return newDays;
    });
  };

  const removeMealItem = (dayNum, mealIndex, itemIndex) => {
    setDays(prev => {
      const newDays = { ...prev };
      const newMeals = [...newDays[dayNum].meals];
      const newItems = [...newMeals[mealIndex].items];
      newItems.splice(itemIndex, 1);
      newMeals[mealIndex] = { ...newMeals[mealIndex], items: newItems };
      newDays[dayNum] = { ...newDays[dayNum], meals: newMeals };
      return newDays;
    });
  };

  const handleCoverUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverPreview(URL.createObjectURL(file));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Create Diet Plan" />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f0813d]"></div>
        </div>
      </div>
    );
  }

  if (!membershipActive) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Create Diet Plan" />
        <main className="px-4 py-4">
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Membership Required</h2>
            <p className="text-gray-500 mb-4">
              Your membership is not active. Please renew your membership to create diet plans.
            </p>
            <button
              onClick={() => router.push("/profile/renew")}
              className="px-6 py-3 bg-[#f0813d] text-white rounded-lg font-medium hover:bg-[#f0813d] transition"
            >
              Renew Membership
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Create Diet Plan" />
        <main className="px-4 py-4">
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🚫</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Not Granted</h2>
            <p className="text-gray-500 mb-4">
              You do not have permission to create your own diet plan. Please contact your gym administrator.
            </p>
            <button
              onClick={() => router.push("/diet")}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition"
            >
              Go Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  const currentDay = days[selectedDay];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Create Diet Plan" />

      <main className="px-4 py-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="relative overflow-hidden rounded-2xl border border-orange-200 bg-[#1a1c1c] shadow-xl">
            <img
              src={coverPreview}
              alt="Diet plan cover preview"
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />
            <div className="relative p-5">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                <ChefHat className="h-3.5 w-3.5" />
                Personal nutrition
              </div>
              <h2 className="max-w-[15rem] text-2xl font-black leading-tight text-white">
                Design a plan you can actually follow.
              </h2>
              <p className="mt-2 max-w-[18rem] text-sm font-medium text-white/80">
                Add meals, times, quantities, calories, and your own cover image preview.
              </p>
              <label className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-[#1a1c1c] shadow-lg active:scale-95">
                <Upload className="h-5 w-5" />
                Upload Food Image
                <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
              </label>
            </div>
          </section>

          {/* Basic Info */}
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-[#f0813d]" />
              <h3 className="font-black text-gray-900">Plan Details</h3>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plan Title *
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="e.g., My Weight Loss Plan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none resize-none"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of your plan"
              />
            </div>
          </div>

          {/* Day Selector */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">Select Day</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[1, 2, 3, 4, 5, 6, 7].map(dayNum => (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => setSelectedDay(dayNum)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition ${
                    selectedDay === dayNum
                      ? "bg-[#f0813d] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {DAY_NAMES[dayNum]}
                  {days[dayNum]?.meals?.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                      {days[dayNum].meals.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Current Day Meals */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{DAY_NAMES[selectedDay]} Meals</h3>
              <button
                type="button"
                onClick={() => addMealToDay(selectedDay)}
                className="px-3 py-1.5 text-sm bg-orange-100 text-[#f0813d] rounded-lg hover:bg-orange-200 transition font-medium"
              >
                + Add Meal
              </button>
            </div>

            {currentDay?.meals?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <span className="text-4xl block mb-2">🍽️</span>
                <p>No meals added for {DAY_NAMES[selectedDay]}</p>
                <p className="text-sm mt-1">Click Add Meal to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {currentDay?.meals?.map((meal, mealIndex) => (
                  <div key={mealIndex} className="border border-gray-200 rounded-lg p-3">
                    {/* Meal Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <select
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                          value={meal.meal_type}
                          onChange={(e) => updateMeal(selectedDay, mealIndex, "meal_type", e.target.value)}
                        >
                          <option value="">Select Meal Type</option>
                          {MEAL_TYPES.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                        <input
                          type="time"
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                          value={meal.meal_time}
                          onChange={(e) => updateMeal(selectedDay, mealIndex, "meal_time", e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMeal(selectedDay, mealIndex)}
                        className="ml-2 p-2 text-[#f0813d] hover:bg-orange-50 rounded-lg"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Instructions */}
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                      placeholder="Instructions (optional)"
                      value={meal.instructions}
                      onChange={(e) => updateMeal(selectedDay, mealIndex, "instructions", e.target.value)}
                    />

                    {/* Meal Items */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Food Items</span>
                        <button
                          type="button"
                          onClick={() => addItemToMeal(selectedDay, mealIndex)}
                          className="text-xs text-[#f0813d] hover:text-[#f0813d]"
                        >
                          + Add Item
                        </button>
                      </div>

                      {meal.items?.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg">
                          <input
                            type="text"
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                            placeholder="Food name"
                            value={item.food_name}
                            onChange={(e) => updateMealItem(selectedDay, mealIndex, itemIndex, "food_name", e.target.value)}
                          />
                          <input
                            type="text"
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateMealItem(selectedDay, mealIndex, itemIndex, "quantity", e.target.value)}
                          />
                          <input
                            type="number"
                            className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                            placeholder="Cal"
                            value={item.calories}
                            onChange={(e) => updateMealItem(selectedDay, mealIndex, itemIndex, "calories", e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => removeMealItem(selectedDay, mealIndex, itemIndex)}
                            className="p-1 text-[#f0813d] hover:bg-orange-50 rounded"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-xl font-semibold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                Saving...
              </span>
            ) : (
              "Save Diet Plan"
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
