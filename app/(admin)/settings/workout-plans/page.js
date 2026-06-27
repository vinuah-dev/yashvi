"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/contexts/ToastContext";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { 
  PlusCircle, 
  Edit2, 
  Trash2, 
  XCircle,
  Dumbbell,
  Search,
  Filter,
  ChevronRight,
  Target,
  TrendingUp,
  Calendar,
  Clock,
  User,
  Plus,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  MoreVertical,
  Users,
  Phone,
  Mail,
  CreditCard,
  Key
} from "lucide-react";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const GOALS = ["Fat Loss", "Muscle Gain", "Strength", "Endurance", "Flexibility", "General Fitness"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

// Wrapper component to handle Suspense for useSearchParams
export default function WorkoutPlansSettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-14 h-14 border-4 border-[#f0813d]/20 border-t-[#9c4400] rounded-full animate-spin"></div>
        </div>
        <p className="mt-6 text-gray-600 font-medium text-sm">Loading...</p>
      </div>
    }>
      <WorkoutPlansContent />
    </Suspense>
  );
}

function WorkoutPlansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useToast();
  const { isViewOnly } = useUserRole();
  const [workoutPlans, setWorkoutPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [gymId, setGymId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchWorkoutPlans();
  }, []);

  // Handle edit URL parameter
  useEffect(() => {
    const editPlanId = searchParams.get("edit");
    if (editPlanId && workoutPlans.length > 0 && !editingPlan) {
      // First check if plan exists in the list (general plans)
      let planToEdit = workoutPlans.find(p => p.id === editPlanId);
      
      if (planToEdit) {
        setEditingPlan(planToEdit);
      } else {
        // Plan not found in general list, try to fetch it directly (might be member-specific)
        fetchAndEditPlan(editPlanId);
      }
    }
  }, [searchParams, workoutPlans]);

  const fetchAndEditPlan = async (planId) => {
    try {
      const { data, error } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (error) throw error;
      if (data) {
        setEditingPlan(data);
      } else {
        showError("Workout plan not found");
      }
    } catch (error) {
      console.error("Error fetching workout plan:", error);
      showError("Failed to load workout plan for editing");
    }
  };

  const fetchWorkoutPlans = async () => {
    try {
      setLoading(true);
      const storedGym = localStorage.getItem("selectedGym");
      if (!storedGym) {
        showError("No gym selected");
        setLoading(false);
        return;
      }
      const gym = JSON.parse(storedGym);
      setGymId(gym.id);

      // Fetch general workout plans with creator info (not member-specific)
      const { data, error } = await supabase
        .from("workout_plans")
        .select(`
          *,
          creator:created_by(id, role, first_name, last_name)
        `)
        .eq("gym_id", gym.id)
        .is("member_id", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Format creator name for display
      const plansWithCreator = (data || []).map(plan => ({
        ...plan,
        creatorName: plan.created_by_name || 
          (plan.creator ? `${plan.creator.first_name || ''} ${plan.creator.last_name || ''}`.trim() : null)
      }));
      
      // Include all plans (admin can see trainer-created plans)
      setWorkoutPlans(plansWithCreator);
    } catch (error) {
      console.error("Error fetching workout plans:", error);
      showError("Failed to load workout plans");
    } finally {
      setLoading(false);
    }
  };

  const filteredPlans = workoutPlans.filter(plan =>
    plan.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.goal?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.level?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (isViewOnly) return;

    if (!window.confirm("Are you sure you want to delete this workout plan? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("workout_plans")
        .delete()
        .eq("id", id);

      if (error) throw error;
      showSuccess("Workout plan deleted successfully");
      fetchWorkoutPlans();
    } catch (error) {
      console.error("Error deleting workout plan:", error);
      showError("Failed to delete workout plan");
    }
  };

  const getLevelColor = (level) => {
    switch (level?.toLowerCase()) {
      case "beginner":
        return "bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 border border-[#f0813d]/20 text-[#9c4400]";
      case "intermediate":
        return "bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 border border-[#f0813d]/20 text-[#9c4400]";
      case "advanced":
        return "bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 border border-[#f0813d]/20 text-[#9c4400]";
      default:
        return "bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-14 h-14 border-4 border-[#f0813d]/20 border-t-[#9c4400] rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-14 h-14 border-4 border-transparent border-t-[#f0813d] rounded-full animate-spin animation-delay-200"></div>
        </div>
        <p className="mt-6 text-gray-600 font-medium text-sm">Loading workout plans...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
      <Header title="Workout Plans" />

      <main className="px-3 py-3 space-y-4">
        {/* Stats Cards - Mobile Optimized */}
        <div className="grid grid-cols-2 gap-2 px-1">
          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Total Plans</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{workoutPlans.length}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 rounded-lg flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Beginner</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">
                  {workoutPlans.filter(p => p.level?.toLowerCase() === "beginner").length}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Intermediate</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">
                  {workoutPlans.filter(p => p.level?.toLowerCase() === "intermediate").length}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Advanced</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">
                  {workoutPlans.filter(p => p.level?.toLowerCase() === "advanced").length}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 rounded-lg flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Add Plan */}
        <div className="bg-white rounded-xl p-3 mx-1 space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search plans by title, goal, or level..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm placeholder:text-gray-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Add Plan Button */}
          {!isViewOnly && (
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white font-medium rounded-lg hover:shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
              style={{ minHeight: '44px' }}
            >
              <Plus className="w-5 h-5" />
              Create New Plan
            </button>
          )}
        </div>

        {/* Workout Plans List */}
        <div className="space-y-3">
          {filteredPlans.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mx-1">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Dumbbell className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                {searchQuery ? "No plans found" : "No workout plans yet"}
              </h3>
              <p className="text-gray-500 text-sm mb-6">
                {searchQuery ? "Try adjusting your search" : "Create your first workout plan to get started"}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-4 py-2 text-[#f0813d] text-sm font-medium hover:text-[#9c4400] active:scale-95 transition-transform"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {filteredPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow-md active:scale-95 transition-all duration-200 cursor-pointer mx-1"
                  onClick={() => {/* Optional: Add view details */}}
                >
                  <div className="flex items-start gap-3">
                    {/* Plan Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#9c4400] flex items-center justify-center">
                        <Dumbbell className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    {/* Plan Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-base truncate">
                            {plan.title}
                          </h3>
                          {plan.goal && (
                            <div className="flex items-center gap-1 mt-1">
                              <Target className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-500 text-xs truncate">{plan.goal}</span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>

                      {/* Plan Details */}
                      <div className="mt-3 space-y-2">
                        {plan.level && (
                          <div className="flex items-center gap-2">
                            <div className={`px-2.5 py-1.5 rounded-lg ${getLevelColor(plan.level)} flex items-center gap-1.5`}>
                              <span className="text-xs font-medium">{plan.level}</span>
                            </div>
                            {plan.is_template && (
                              <div className="px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 border border-[#f0813d]/20 text-[#9c4400] flex items-center gap-1.5">
                                <span className="text-xs font-medium">Template</span>
                              </div>
                            )}
                          </div>
                        )}

                        {plan.description && (
                          <div className="text-sm text-gray-600 line-clamp-2">
                            {plan.description}
                          </div>
                        )}

                        {/* Creator Info */}
                        {plan.creator && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${
                              plan.creator.role === 'trainer'
                                ? 'bg-[#f0813d]/10'
                                : 'bg-[#f0813d]/10'
                            }`}>
                              <User className={`w-3 h-3 ${
                                plan.creator.role === 'trainer'
                                  ? 'text-[#f0813d]'
                                  : 'text-[#f0813d]'
                              }`} />
                            </div>
                            <span className="text-gray-600 text-xs">
                              Created by {plan.creator.role === 'trainer' ? 'Trainer' : 'Admin'} {plan.creator.first_name} {plan.creator.last_name}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-500 text-xs">
                            Created: {new Date(plan.created_at).toLocaleDateString("en-IN")}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-2 overflow-x-auto mt-3 pt-3 border-t border-gray-100 pb-1 -mx-1 px-1 no-scrollbar">
                        {!isViewOnly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPlan(plan);
                              setShowAddModal(true);
                            }}
                            className="flex-shrink-0 px-3 py-2 bg-[#f0813d]/10 text-[#9c4400] text-xs font-medium rounded-lg active:bg-[#f0813d]/15 transition-all flex items-center gap-2"
                            style={{ minHeight: '36px' }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        )}

                        {!isViewOnly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(plan.id);
                            }}
                            className="flex-shrink-0 px-3 py-2 bg-[#f0813d]/10 text-[#9c4400] text-xs font-medium rounded-lg active:bg-[#f0813d]/15 transition-all flex items-center gap-2"
                            style={{ minHeight: '36px' }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Workout Plan Modal */}
      {(showAddModal || editingPlan) && (
        <WorkoutPlanModal
          plan={editingPlan}
          gymId={gymId}
          onClose={() => {
            setShowAddModal(false);
            setEditingPlan(null);
            // Clear URL params when closing
            if (searchParams.get("edit")) {
              router.replace("/settings/workout-plans");
            }
          }}
          onSave={() => {
            fetchWorkoutPlans();
            setShowAddModal(false);
            setEditingPlan(null);
            // Clear URL params when saving
            if (searchParams.get("edit")) {
              router.replace("/settings/workout-plans");
            }
          }}
        />
      )}
    </div>
  );
}

// Workout Plan Modal Component
function WorkoutPlanModal({ plan, gymId, onClose, onSave }) {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    goal: "",
    level: "",
    is_template: false,
  });
  const [days, setDays] = useState({});

  useEffect(() => {
    if (plan) {
      setFormData({
        title: plan.title || "",
        description: plan.description || "",
        goal: plan.goal || "",
        level: plan.level || "",
        is_template: plan.is_template || false,
      });
      fetchPlanDetails();
    } else {
      // Initialize with all days (1-6, Monday to Saturday)
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
    }
  }, [plan]);

  const fetchPlanDetails = async () => {
    if (!plan) return;

    try {
      const { data: planDays, error } = await supabase
        .from("workout_plan_days")
        .select(`
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
        `)
        .eq("workout_plan_id", plan.id)
        .order("day_of_week", { ascending: true });

      if (error) throw error;

      const organizedDays = {};
      if (planDays) {
        planDays.forEach(day => {
          organizedDays[day.day_of_week] = {
            id: day.id,
            day_of_week: day.day_of_week,
            day_name: day.day_name || DAY_NAMES[day.day_of_week],
            focus: day.focus || "",
            exercises: (day.workout_exercises || []).sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0)),
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
    } catch (error) {
      console.error("Error fetching plan details:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      showError("Please enter a title for the workout plan");
      return;
    }

    if (!gymId) {
      showError("No gym selected");
      return;
    }

    setLoading(true);
    try {
      const storedUser = localStorage.getItem("gymUser");
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      const createdBy = currentUser?.id;
      const createdByName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : null;

      let planId;

      if (plan) {
        // Update existing plan
        const { error: updateError } = await supabase
          .from("workout_plans")
          .update({
            title: formData.title,
            description: formData.description || null,
            goal: formData.goal || null,
            level: formData.level || null,
            is_template: formData.is_template,
            updated_at: new Date().toISOString(),
          })
          .eq("id", plan.id);

        if (updateError) throw updateError;
        planId = plan.id;

        // Delete existing days and recreate
        const { error: deleteError } = await supabase
          .from("workout_plan_days")
          .delete()
          .eq("workout_plan_id", plan.id);

        if (deleteError) throw deleteError;
      } else {
        // Create new plan
        const { data: newPlan, error: insertError } = await supabase
          .from("workout_plans")
          .insert({
            gym_id: gymId,
            title: formData.title,
            description: formData.description || null,
            goal: formData.goal || null,
            level: formData.level || null,
            is_template: formData.is_template,
            created_by: createdBy,
            created_by_name: createdByName,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        planId = newPlan.id;
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

      showSuccess(plan ? "Workout plan updated successfully!" : "Workout plan created successfully!");
      onSave();
    } catch (error) {
      console.error("Error saving workout plan:", error);
      showError("Failed to save workout plan: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 safe-area-inset-bottom mb-17">
      <div className="bg-white w-full max-w-2xl rounded-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {plan ? "Edit Workout Plan" : "Create Workout Plan"}
              </h3>
              <p className="text-gray-500 text-xs mt-0.5">
                {plan ? "Update your workout plan details" : "Add a new workout plan for your gym"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95"
              style={{ minHeight: '40px', minWidth: '40px' }}
            >
              <XCircle className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-gray-500" />
                <h4 className="font-semibold text-gray-900 text-sm">Basic Information</h4>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Plan Title *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="e.g., Beginner Muscle Gain, Advanced Fat Loss"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Goal
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm"
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Level
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm"
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
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all resize-none text-sm"
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this workout plan"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Template Plan</p>
                  <p className="text-xs text-gray-500">Use as reusable template</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_template: !formData.is_template })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.is_template ? "bg-gradient-to-r from-[#f0813d] to-[#9c4400]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.is_template ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Days and Exercises */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <h4 className="font-semibold text-gray-900 text-sm">Weekly Plan (Mon-Sat)</h4>
              </div>
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {[1, 2, 3, 4, 5, 6].map(dayNum => {
                  const day = days[dayNum];
                  if (!day) return null;

                  return (
                    <div key={dayNum} className="border border-gray-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h5 className="font-semibold text-gray-900 text-sm">{day.day_name || DAY_NAMES[dayNum]}</h5>
                          <input
                            type="text"
                            className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all"
                            placeholder="Focus (e.g., Chest & Triceps)"
                            value={day.focus}
                            onChange={(e) => updateDayFocus(dayNum, e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => addExerciseToDay(dayNum)}
                          className="px-2 py-1 text-xs bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-lg hover:shadow-md active:scale-95 transition-all"
                        >
                          + Add Exercise
                        </button>
                      </div>

                      {day.exercises && day.exercises.length > 0 && (
                        <div className="space-y-2">
                          {day.exercises.map((exercise, exerciseIndex) => (
                            <div key={exerciseIndex} className="bg-gray-50 rounded-lg p-2">
                              <div className="grid grid-cols-6 gap-1 items-center">
                                <div className="col-span-3">
                                  <input
                                    type="text"
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all"
                                    placeholder="Exercise name"
                                    value={exercise.exercise_name}
                                    onChange={(e) => updateExercise(dayNum, exerciseIndex, "exercise_name", e.target.value)}
                                  />
                                </div>
                                <div>
                                  <input
                                    type="number"
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all"
                                    placeholder="Sets"
                                    value={exercise.sets}
                                    onChange={(e) => updateExercise(dayNum, exerciseIndex, "sets", e.target.value)}
                                  />
                                </div>
                                <div>
                                  <input
                                    type="text"
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all"
                                    placeholder="Reps"
                                    value={exercise.reps}
                                    onChange={(e) => updateExercise(dayNum, exerciseIndex, "reps", e.target.value)}
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all"
                                    placeholder="Weight"
                                    value={exercise.weight}
                                    onChange={(e) => updateExercise(dayNum, exerciseIndex, "weight", e.target.value)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeExercise(dayNum, exerciseIndex)}
                                    className="p-1 text-[#f0813d] hover:bg-[#f0813d]/10 rounded-lg active:scale-95 transition-all"
                                    style={{ minHeight: '32px', minWidth: '32px' }}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <div className="mt-1">
                                <input
                                  type="text"
                                  className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all"
                                  placeholder="Notes (optional)"
                                  value={exercise.notes || ""}
                                  onChange={(e) => updateExercise(dayNum, exerciseIndex, "notes", e.target.value)}
                                />
                              </div>
                              <div className="mt-1">
                                <input
                                  type="number"
                                  className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all"
                                  placeholder="Rest (seconds)"
                                  value={exercise.rest_seconds}
                                  onChange={(e) => updateExercise(dayNum, exerciseIndex, "rest_seconds", e.target.value)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {(!day.exercises || day.exercises.length === 0) && (
                        <p className="text-gray-400 text-xs text-center py-2">No exercises added</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 active:scale-95 transition-all"
            style={{ minHeight: '44px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-xl font-medium hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '44px' }}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Saving...
              </div>
            ) : (
              plan ? "Update Plan" : "Create Plan"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
