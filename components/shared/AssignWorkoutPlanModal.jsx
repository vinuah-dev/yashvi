"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/contexts/ToastContext";
import {
    Plus,
    X,
    Dumbbell,
    Calendar,
    Trash2,
    Target,
    TrendingUp,
} from "lucide-react";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const GOALS = ["Fat Loss", "Muscle Gain", "Strength", "Endurance", "Flexibility", "General Fitness"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

export default function AssignWorkoutPlanModal({ member, memberId, memberName, gymId, trainerId, onClose, onAssign, onAssigned }) {
    const { showSuccess, showError } = useToast();
    
    // Support both old prop format (member object) and new format (memberId + memberName)
    const actualMemberId = memberId || member?.id;
    const actualMemberName = memberName || member?.name;
    const actualGymId = gymId || member?.gymId;
    const [workoutPlans, setWorkoutPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [mode, setMode] = useState("select"); // "select" or "create"
    
    // Form state for creating custom workout plan
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        goal: "",
        level: "",
    });
    const [days, setDays] = useState({});
    const [activeDay, setActiveDay] = useState(1);

    // Initialize days for custom plan
    useEffect(() => {
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
        
        // Set default title with member name
        setFormData({
            title: `${actualMemberName}'s Workout Plan`,
            description: `Custom workout plan created specifically for ${actualMemberName}`,
            goal: "",
            level: "",
        });
    }, [actualMemberName]);

    // Fetch workout plans from database
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const targetGymId = actualGymId;
                if (!targetGymId) {
                    console.error("No gym ID available");
                    setLoadingPlans(false);
                    return;
                }

                // Fetch only general plans (not member-specific)
                const { data, error } = await supabase
                    .from("workout_plans")
                    .select("id, title, description, goal, level, is_template")
                    .eq("gym_id", targetGymId)
                    .is("member_id", null)
                    .order("title", { ascending: true });

                if (error) {
                    console.error("Error fetching workout plans:", error);
                    showError("Failed to load workout plans");
                } else {
                    setWorkoutPlans(data || []);
                }
            } catch (err) {
                console.error("Error:", err);
                showError("Failed to load workout plans");
            }
            setLoadingPlans(false);
        };

        fetchPlans();
    }, [actualGymId]);

    const handleAssign = async () => {
        if (!selectedPlan) {
            showError("Please select a workout plan");
            return;
        }

        setLoading(true);
        try {
            // Check if member already has this workout plan assigned
            const { data: existing } = await supabase
                .from("member_workouts")
                .select("id")
                .eq("member_id", actualMemberId)
                .eq("workout_plan_id", selectedPlan)
                .maybeSingle();

            if (existing) {
                showError("This workout plan is already assigned to this member");
                setLoading(false);
                return;
            }

            // Remove any existing workout plan assignments for this member
            // (A member should only have one active workout plan at a time)
            await supabase
                .from("member_workouts")
                .delete()
                .eq("member_id", actualMemberId);

            // Assign workout plan to member
            const { error } = await supabase
                .from("member_workouts")
                .insert({
                    member_id: actualMemberId,
                    workout_plan_id: selectedPlan,
                    assigned_by_trainer_id: trainerId || null,
                });

            if (error) {
                throw error;
            }

            showSuccess("Workout plan assigned successfully!");
            if (onAssign) {
                onAssign();
            }
            if (onAssigned) {
                onAssigned();
            }
            onClose();
        } catch (error) {
            console.error("Error assigning workout plan:", error);
            showError("Failed to assign workout plan. Please try again.");
        }
        setLoading(false);
    };

    const handleCreateCustomPlan = async () => {
        if (!formData.title.trim()) {
            showError("Please enter a title for the workout plan");
            return;
        }

        const targetGymId = actualGymId;
        if (!targetGymId) {
            showError("No gym selected");
            return;
        }

        setLoading(true);
        try {
            // Get current user info for created_by and trainer_id
            const storedUser = localStorage.getItem("gymUser");
            const currentUser = storedUser ? JSON.parse(storedUser) : null;
            const createdBy = currentUser?.id;
            
            // Use trainerId prop if available, otherwise use current user's ID
            // This handles both trainer (has trainerId prop) and admin (uses their own ID) cases
            const actualTrainerId = trainerId || createdBy;

            // Create the workout plan with member_id to make it member-specific
            const { data: newPlan, error: insertError } = await supabase
                .from("workout_plans")
                .insert({
                    gym_id: targetGymId,
                    title: formData.title,
                    description: formData.description || null,
                    goal: formData.goal || null,
                    level: formData.level || null,
                    is_template: false,
                    created_by: createdBy,
                    member_id: actualMemberId, // This makes it member-specific
                    trainer_id: actualTrainerId, // Now properly set for both admin and trainer
                })
                .select()
                .single();

            if (insertError) throw insertError;
            const planId = newPlan.id;

            // Save days with exercises
            for (const dayNum of Object.keys(days)) {
                const day = days[dayNum];
                if ((day.exercises && day.exercises.length > 0) || day.focus) {
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

            // Remove any existing workout plan assignments for this member
            // (A member should only have one active workout plan at a time)
            await supabase
                .from("member_workouts")
                .delete()
                .eq("member_id", actualMemberId);

            // Assign the newly created plan to the member
            const { error: assignError } = await supabase
                .from("member_workouts")
                .insert({
                    member_id: actualMemberId,
                    workout_plan_id: planId,
                    assigned_by_trainer_id: actualTrainerId, // Use the same resolved trainer ID
                });

            if (assignError) throw assignError;

            showSuccess("Custom workout plan created and assigned successfully!");
            if (onAssign) {
                onAssign();
            }
            if (onAssigned) {
                onAssigned();
            }
            onClose();
        } catch (error) {
            console.error("Error creating workout plan:", error);
            showError("Failed to create workout plan: " + (error.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    // Exercise management functions
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
            newDays[dayNum].exercises.splice(exerciseIndex, 1);
            return newDays;
        });
    };

    const getLevelColor = (level) => {
        switch (level?.toLowerCase()) {
            case "beginner":
                return "bg-orange-100 text-[#f0813d]";
            case "intermediate":
                return "bg-orange-100 text-[#f0813d]";
            case "advanced":
                return "bg-orange-100 text-[#f0813d]";
            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Modal Header */}
                <div className="p-4 sm:p-6 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                                {mode === "select" ? "Assign Workout Plan" : "Create Custom Workout Plan"}
                            </h3>
                            <p className="text-gray-500 text-xs sm:text-sm mt-1">
                                {mode === "select" 
                                    ? `Select a workout plan for ${actualMemberName}` 
                                    : `Create a personalized workout plan for ${actualMemberName}`}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Mode Toggle */}
                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={() => setMode("select")}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                mode === "select"
                                    ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white shadow-md"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                        >
                            Select Existing
                        </button>
                        <button
                            onClick={() => setMode("create")}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                mode === "create"
                                    ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white shadow-md"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                        >
                            <Plus className="w-4 h-4" />
                            Create Custom
                        </button>
                    </div>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {mode === "select" ? (
                        // Select Existing Plan Mode
                        <>
                            {loadingPlans ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-8 h-8 border-4 border-[#f0813d] border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : workoutPlans.length === 0 ? (
                                <div className="text-center py-8">
                                    <span className="text-4xl">💪</span>
                                    <p className="text-gray-500 mt-2">
                                        No workout plans available
                                    </p>
                                    <p className="text-gray-400 text-sm mt-1">
                                        Create workout plans in Settings or create a custom one for this member
                                    </p>
                                    <button
                                        onClick={() => setMode("create")}
                                        className="mt-4 px-6 py-2.5 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-lg font-medium flex items-center gap-2 mx-auto"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create Custom Plan
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                                        Select Workout Plan *
                                    </label>
                                    {workoutPlans.map((plan) => (
                                        <button
                                            key={plan.id}
                                            type="button"
                                            onClick={() => setSelectedPlan(plan.id)}
                                            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                                                selectedPlan === plan.id
                                                    ? "border-[#f0813d] bg-orange-50"
                                                    : "border-gray-200 hover:border-gray-300 bg-white"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-semibold text-gray-900">
                                                            {plan.title}
                                                        </p>
                                                        {plan.is_template && (
                                                            <span className="px-2 py-0.5 bg-orange-100 text-[#f0813d] text-xs rounded-full">
                                                                Template
                                                            </span>
                                                        )}
                                                        {plan.level && (
                                                            <span className={`px-2 py-0.5 text-xs rounded-full ${getLevelColor(plan.level)}`}>
                                                                {plan.level}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {plan.goal && (
                                                        <p className="text-xs text-[#f0813d] mt-1">
                                                            🎯 {plan.goal}
                                                        </p>
                                                    )}
                                                    {plan.description && (
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            {plan.description}
                                                        </p>
                                                    )}
                                                </div>
                                                {selectedPlan === plan.id && (
                                                    <span className="text-[#f0813d] text-xl">
                                                        ✓
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        // Create Custom Plan Mode
                        <div className="space-y-4">
                            {/* Basic Info */}
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 space-y-3">
                                <h4 className="font-semibold text-gray-900 text-sm">Basic Information</h4>
                                
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">
                                        Plan Title *
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none transition-all text-sm"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        required
                                        placeholder="e.g., Strength Training, HIIT Program"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-2">
                                            Goal
                                        </label>
                                        <select
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d] text-sm"
                                            value={formData.goal}
                                            onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                                        >
                                            <option value="">Select Goal</option>
                                            {GOALS.map((goal) => (
                                                <option key={goal} value={goal}>{goal}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-2">
                                            Level
                                        </label>
                                        <select
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d] text-sm"
                                            value={formData.level}
                                            onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                                        >
                                            <option value="">Select Level</option>
                                            {LEVELS.map((level) => (
                                                <option key={level} value={level}>{level}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">
                                        Description (Optional)
                                    </label>
                                    <textarea
                                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none transition-all resize-none text-sm"
                                        rows={2}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Brief description of this workout plan"
                                    />
                                </div>

                                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                    <p className="text-xs text-[#f0813d]">
                                        <strong>Note:</strong> This workout plan will be created exclusively for {actualMemberName} and won't appear in the general workout plans list.
                                    </p>
                                </div>
                            </div>

                            {/* Day Selector Tabs */}
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Weekly Workout Schedule (Mon-Sat)
                                </h4>
                                <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar">
                                    {[1, 2, 3, 4, 5, 6].map((dayNum) => (
                                        <button
                                            key={dayNum}
                                            type="button"
                                            onClick={() => setActiveDay(dayNum)}
                                            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                                activeDay === dayNum
                                                    ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white"
                                                    : days[dayNum]?.exercises?.length > 0 || days[dayNum]?.focus
                                                        ? "bg-orange-100 text-[#f0813d] border border-orange-200"
                                                        : "bg-gray-100 text-gray-600"
                                            }`}
                                        >
                                            {DAY_NAMES[dayNum].substring(0, 3)}
                                            {(days[dayNum]?.exercises?.length > 0 || days[dayNum]?.focus) && activeDay !== dayNum && (
                                                <span className="ml-1 text-[10px]">✓</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Day Content */}
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="font-semibold text-gray-900 text-sm">
                                        {DAY_NAMES[activeDay]}
                                    </h5>
                                    <button
                                        type="button"
                                        onClick={() => addExerciseToDay(activeDay)}
                                        className="px-3 py-1.5 bg-orange-50 text-[#f0813d] rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-orange-100 transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add Exercise
                                    </button>
                                </div>

                                {/* Day Focus */}
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Focus Area (e.g., Chest & Triceps, Legs, Back & Biceps)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Chest & Triceps"
                                        value={days[activeDay]?.focus || ""}
                                        onChange={(e) => updateDayFocus(activeDay, e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f0813d]"
                                    />
                                </div>

                                {/* Exercises for Active Day */}
                                {days[activeDay]?.exercises?.length === 0 ? (
                                    <div className="text-center py-6 text-gray-400">
                                        <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No exercises added yet</p>
                                        <p className="text-xs">Click "Add Exercise" to start</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {days[activeDay]?.exercises?.map((exercise, exerciseIndex) => (
                                            <div key={exerciseIndex} className="bg-gray-50 rounded-lg p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium text-gray-500">Exercise {exerciseIndex + 1}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeExercise(activeDay, exerciseIndex)}
                                                        className="p-1 text-[#f0813d] hover:bg-orange-50 rounded-lg"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <input
                                                    type="text"
                                                    placeholder="Exercise name (e.g., Bench Press)"
                                                    value={exercise.exercise_name}
                                                    onChange={(e) => updateExercise(activeDay, exerciseIndex, "exercise_name", e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f0813d]"
                                                />

                                                <div className="grid grid-cols-4 gap-2">
                                                    <input
                                                        type="number"
                                                        placeholder="Sets"
                                                        value={exercise.sets || ""}
                                                        onChange={(e) => updateExercise(activeDay, exerciseIndex, "sets", e.target.value)}
                                                        className="px-2 py-1.5 bg-white border border-gray-200 rounded text-xs text-center"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Reps"
                                                        value={exercise.reps || ""}
                                                        onChange={(e) => updateExercise(activeDay, exerciseIndex, "reps", e.target.value)}
                                                        className="px-2 py-1.5 bg-white border border-gray-200 rounded text-xs text-center"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Weight"
                                                        value={exercise.weight || ""}
                                                        onChange={(e) => updateExercise(activeDay, exerciseIndex, "weight", e.target.value)}
                                                        className="px-2 py-1.5 bg-white border border-gray-200 rounded text-xs text-center"
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="Rest(s)"
                                                        value={exercise.rest_seconds || ""}
                                                        onChange={(e) => updateExercise(activeDay, exerciseIndex, "rest_seconds", e.target.value)}
                                                        className="px-2 py-1.5 bg-white border border-gray-200 rounded text-xs text-center"
                                                    />
                                                </div>

                                                <input
                                                    type="text"
                                                    placeholder="Notes (optional)"
                                                    value={exercise.notes || ""}
                                                    onChange={(e) => updateExercise(activeDay, exerciseIndex, "notes", e.target.value)}
                                                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-xs"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 sm:p-6 border-t border-gray-100 flex gap-3 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={mode === "select" ? handleAssign : handleCreateCustomPlan}
                        disabled={loading || (mode === "select" && (!selectedPlan || loadingPlans))}
                        className="flex-1 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition"
                    >
                        {loading 
                            ? (mode === "select" ? "Assigning..." : "Creating...") 
                            : (mode === "select" ? "Assign Plan" : "Create & Assign")}
                    </button>
                </div>
            </div>
        </div>
    );
}
