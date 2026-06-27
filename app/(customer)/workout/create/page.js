"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/contexts/ToastContext";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const GOALS = ["Fat Loss", "Muscle Gain", "Strength", "Endurance", "Flexibility", "General Fitness"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

export default function CreateMemberWorkoutPlanPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [membershipActive, setMembershipActive] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [formData, setFormData] = useState({
    title: "My Personal Workout Plan",
    description: "",
    goal: "",
    level: "",
  });
  const [days, setDays] = useState({});

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

      // Initialize days (1-6, Monday to Saturday)
      const initialDays = {};
      for (let i = 1; i <= 6; i++) {
        initialDays[i] = {
          day_of_week: i,
          day_name: DAY_NAMES[i],
          focus: "",
          exercises: [],
        };
      }
      setDays(initialDays);

      // Check if member already has a self-created workout plan
      const { data: existingPlan, error: planError } = await supabase
        .from("workout_plans")
        .select(`
          id,
          title,
          description,
          goal,
          level,
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
        `)
        .eq("created_by_member_id", memberData.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!planError && existingPlan) {
        setFormData({
          title: existingPlan.title,
          description: existingPlan.description || "",
          goal: existingPlan.goal || "",
          level: existingPlan.level || "",
        });

        // Organize existing plan data
        const organizedDays = {};
        if (existingPlan.workout_plan_days) {
          existingPlan.workout_plan_days.forEach(day => {
            organizedDays[day.day_of_week] = {
              id: day.id,
              day_of_week: day.day_of_week,
              day_name: day.day_name || DAY_NAMES[day.day_of_week],
              focus: day.focus || "",
              exercises: (day.workout_exercises || [])
                .sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0))
                .map(ex => ({
                  id: ex.id,
                  exercise_name: ex.exercise_name,
                  sets: ex.sets || "",
                  reps: ex.reps || "",
                  weight: ex.weight || "",
                  rest_seconds: ex.rest_seconds || "",
                  notes: ex.notes || "",
                })),
            };
          });
        }

        // Fill in missing days
        for (let i = 1; i <= 6; i++) {
          if (!organizedDays[i]) {
            organizedDays[i] = {
              day_of_week: i,
              day_name: DAY_NAMES[i],
              focus: "",
              exercises: [],
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
      showError("Please enter a title for your workout plan");
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
        .from("workout_plans")
        .select("id")
        .eq("created_by_member_id", member.id)
        .maybeSingle();

      let planId;

      if (existingPlan) {
        // Update existing plan
        const { error: updateError } = await supabase
          .from("workout_plans")
          .update({
            title: formData.title,
            description: formData.description || null,
            goal: formData.goal || null,
            level: formData.level || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPlan.id);

        if (updateError) throw updateError;
        planId = existingPlan.id;

        // Delete existing days and recreate
        const { error: deleteError } = await supabase
          .from("workout_plan_days")
          .delete()
          .eq("workout_plan_id", existingPlan.id);

        if (deleteError) throw deleteError;
      } else {
        // Create new plan
        const { data: newPlan, error: insertError } = await supabase
          .from("workout_plans")
          .insert({
            gym_id: member.gym_id,
            title: formData.title,
            description: formData.description || null,
            goal: formData.goal || null,
            level: formData.level || null,
            is_template: false,
            created_by_member_id: member.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        planId = newPlan.id;

        // Also assign this workout plan to the member
        const { error: assignError } = await supabase
          .from("member_workouts")
          .insert({
            member_id: member.id,
            workout_plan_id: planId,
          });

        if (assignError) throw assignError;
      }

      // Create days and exercises
      for (const dayNum of Object.keys(days)) {
        const day = days[dayNum];
        if ((day.exercises && day.exercises.length > 0) || day.focus) {
          // Create day
          const { data: dayData, error: dayError } = await supabase
            .from("workout_plan_days")
            .insert({
              workout_plan_id: planId,
              day_of_week: parseInt(dayNum),
              day_name: day.day_name,
              focus: day.focus || null,
            })
            .select()
            .single();

          if (dayError) throw dayError;

          // Create exercises for this day
          if (day.exercises && day.exercises.length > 0) {
            const exercisesToInsert = day.exercises
              .filter(ex => ex.exercise_name && ex.exercise_name.trim())
              .map((ex, index) => ({
                workout_day_id: dayData.id,
                exercise_name: ex.exercise_name,
                sets: ex.sets || null,
                reps: ex.reps || null,
                weight: ex.weight || null,
                rest_seconds: ex.rest_seconds || null,
                notes: ex.notes || null,
                exercise_order: index + 1,
              }));

            if (exercisesToInsert.length > 0) {
              const { error: exercisesError } = await supabase
                .from("workout_exercises")
                .insert(exercisesToInsert);

              if (exercisesError) throw exercisesError;
            }
          }
        }
      }

      showSuccess("Workout plan saved successfully!");
      router.push("/workout");
    } catch (error) {
      console.error("Error saving workout plan:", error);
      showError("Failed to save workout plan: " + (error.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const addExerciseToDay = (dayNum) => {
    setDays(prev => ({
      ...prev,
      [dayNum]: {
        ...prev[dayNum],
        exercises: [...(prev[dayNum].exercises || []), {
          exercise_name: "",
          sets: "",
          reps: "",
          weight: "",
          rest_seconds: "",
          notes: "",
        }],
      },
    }));
  };

  const updateDayFocus = (dayNum, focus) => {
    setDays(prev => ({
      ...prev,
      [dayNum]: {
        ...prev[dayNum],
        focus: focus,
      },
    }));
  };

  const updateExercise = (dayNum, exerciseIndex, field, value) => {
    setDays(prev => {
      const newDays = { ...prev };
      const newExercises = [...newDays[dayNum].exercises];
      newExercises[exerciseIndex] = { ...newExercises[exerciseIndex], [field]: value };
      newDays[dayNum] = { ...newDays[dayNum], exercises: newExercises };
      return newDays;
    });
  };

  const removeExercise = (dayNum, exerciseIndex) => {
    setDays(prev => {
      const newDays = { ...prev };
      const newExercises = [...newDays[dayNum].exercises];
      newExercises.splice(exerciseIndex, 1);
      newDays[dayNum] = { ...newDays[dayNum], exercises: newExercises };
      return newDays;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Create Workout Plan" />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f0813d]"></div>
        </div>
      </div>
    );
  }

  if (!membershipActive) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Create Workout Plan" />
        <main className="px-4 py-4">
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Membership Required</h2>
            <p className="text-gray-500 mb-4">
              Your membership is not active. Please renew your membership to create workout plans.
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
        <Header title="Create Workout Plan" />
        <main className="px-4 py-4">
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🚫</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Not Granted</h2>
            <p className="text-gray-500 mb-4">
              You don't have permission to create your own workout plan. Please contact your gym administrator.
            </p>
            <button
              onClick={() => router.push("/workout")}
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
      <Header title="Create Workout Plan" />

      <main className="px-4 py-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900">Plan Details</h3>
            
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
                placeholder="e.g., My Muscle Gain Plan"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Goal
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                  value={formData.goal}
                  onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                >
                  <option value="">Select Goal</option>
                  {GOALS.map(goal => (
                    <option key={goal} value={goal}>{goal}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Level
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                >
                  <option value="">Select Level</option>
                  {LEVELS.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
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
            <p className="text-sm font-semibold text-gray-700 mb-3">Select Day (Mon-Sat)</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[1, 2, 3, 4, 5, 6].map(dayNum => (
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
                  {days[dayNum]?.exercises?.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                      {days[dayNum].exercises.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Current Day Exercises */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{DAY_NAMES[selectedDay]}</h3>
              <button
                type="button"
                onClick={() => addExerciseToDay(selectedDay)}
                className="px-3 py-1.5 text-sm bg-orange-100 text-[#f0813d] rounded-lg hover:bg-orange-200 transition font-medium"
              >
                + Add Exercise
              </button>
            </div>

            {/* Focus Input */}
            <div className="mb-4">
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                placeholder="Focus (e.g., Chest & Triceps, Back & Biceps)"
                value={currentDay?.focus || ""}
                onChange={(e) => updateDayFocus(selectedDay, e.target.value)}
              />
            </div>

            {currentDay?.exercises?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <span className="text-4xl block mb-2">💪</span>
                <p>No exercises added for {DAY_NAMES[selectedDay]}</p>
                <p className="text-sm mt-1">Click "Add Exercise" to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentDay?.exercises?.map((exercise, exerciseIndex) => (
                  <div key={exerciseIndex} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    {/* Exercise Name */}
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                        placeholder="Exercise name (e.g., Bench Press)"
                        value={exercise.exercise_name}
                        onChange={(e) => updateExercise(selectedDay, exerciseIndex, "exercise_name", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeExercise(selectedDay, exerciseIndex)}
                        className="p-2 text-[#f0813d] hover:bg-orange-50 rounded-lg"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Sets, Reps, Weight, Rest */}
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Sets</label>
                        <input
                          type="number"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                          placeholder="3"
                          value={exercise.sets}
                          onChange={(e) => updateExercise(selectedDay, exerciseIndex, "sets", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Reps</label>
                        <input
                          type="text"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                          placeholder="8-12"
                          value={exercise.reps}
                          onChange={(e) => updateExercise(selectedDay, exerciseIndex, "reps", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Weight</label>
                        <input
                          type="text"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                          placeholder="20kg"
                          value={exercise.weight}
                          onChange={(e) => updateExercise(selectedDay, exerciseIndex, "weight", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Rest (s)</label>
                        <input
                          type="number"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                          placeholder="60"
                          value={exercise.rest_seconds}
                          onChange={(e) => updateExercise(selectedDay, exerciseIndex, "rest_seconds", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                      placeholder="Notes (optional)"
                      value={exercise.notes || ""}
                      onChange={(e) => updateExercise(selectedDay, exerciseIndex, "notes", e.target.value)}
                    />
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
              "Save Workout Plan"
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
