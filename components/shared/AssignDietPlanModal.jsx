"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/contexts/ToastContext";
import {
    Plus,
    X,
    Apple,
    Clock,
    ChefHat,
    Flame,
    Calendar,
    Trash2,
} from "lucide-react";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES = [
    { value: "early_morning", label: "Early Morning", icon: <Clock className="w-4 h-4" /> },
    { value: "breakfast", label: "Breakfast", icon: <ChefHat className="w-4 h-4" /> },
    { value: "mid_morning", label: "Mid Morning", icon: <Clock className="w-4 h-4" /> },
    { value: "lunch", label: "Lunch", icon: <ChefHat className="w-4 h-4" /> },
    { value: "pre_workout", label: "Pre Workout", icon: <Flame className="w-4 h-4" /> },
    { value: "post_workout", label: "Post Workout", icon: <Flame className="w-4 h-4" /> },
    { value: "evening_snack", label: "Evening Snack", icon: <Apple className="w-4 h-4" /> },
    { value: "dinner", label: "Dinner", icon: <ChefHat className="w-4 h-4" /> },
    { value: "bedtime", label: "Bedtime", icon: <Clock className="w-4 h-4" /> },
];

export default function AssignDietPlanModal({ member, memberId, memberName, gymId, trainerId, onClose, onAssign, onAssigned }) {
    const { showSuccess, showError } = useToast();
    
    // Support both old prop format (member object) and new format (memberId + memberName)
    const actualMemberId = memberId || member?.id;
    const actualMemberName = memberName || member?.name;
    const actualGymId = gymId || member?.gymId;
    const [dietPlans, setDietPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [mode, setMode] = useState("select"); // "select" or "create"
    
    // Form state for creating custom diet plan
    const [formData, setFormData] = useState({
        title: "",
        description: "",
    });
    const [days, setDays] = useState({});
    const [activeDay, setActiveDay] = useState(1);

    // Initialize days for custom plan
    useEffect(() => {
        const initialDays = {};
        for (let i = 1; i <= 7; i++) {
            initialDays[i] = {
                day_of_week: i,
                day_name: DAY_NAMES[i],
                meals: [],
            };
        }
        setDays(initialDays);
        
        // Set default title with member name
        setFormData({
            title: `${actualMemberName}'s Diet Plan`,
            description: `Custom diet plan created specifically for ${actualMemberName}`,
        });
    }, [actualMemberName]);

    // Fetch diet plans from database
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
                    .from("diet_plans")
                    .select("id, title, description, is_template")
                    .eq("gym_id", targetGymId)
                    .is("member_id", null)
                    .order("title", { ascending: true });

                if (error) {
                    console.error("Error fetching diet plans:", error);
                    showError("Failed to load diet plans");
                } else {
                    setDietPlans(data || []);
                }
            } catch (err) {
                console.error("Error:", err);
                showError("Failed to load diet plans");
            }
            setLoadingPlans(false);
        };

        fetchPlans();
    }, [actualGymId]);

    const handleAssign = async () => {
        if (!selectedPlan) {
            showError("Please select a diet plan");
            return;
        }

        setLoading(true);
        try {
            const storedUser = localStorage.getItem("gymUser");
            const currentUser = storedUser ? JSON.parse(storedUser) : null;
            const assignedBy = currentUser?.id;

            // Check if member already has this diet plan assigned
            const { data: existing } = await supabase
                .from("member_diets")
                .select("id")
                .eq("member_id", actualMemberId)
                .eq("diet_plan_id", selectedPlan)
                .maybeSingle();

            if (existing) {
                showError("This diet plan is already assigned to this member");
                setLoading(false);
                return;
            }

            // Remove any existing diet plan assignments for this member
            // (A member should only have one active diet plan at a time)
            await supabase
                .from("member_diets")
                .delete()
                .eq("member_id", actualMemberId);

            // Assign diet plan to member
            const { error } = await supabase
                .from("member_diets")
                .insert({
                    member_id: actualMemberId,
                    diet_plan_id: selectedPlan,
                    assigned_by: assignedBy,
                    assigned_by_trainer_id: trainerId || null,
                });

            if (error) {
                throw error;
            }

            showSuccess("Diet plan assigned successfully!");
            if (onAssign) {
                onAssign();
            }
            if (onAssigned) {
                onAssigned();
            }
            onClose();
        } catch (error) {
            console.error("Error assigning diet plan:", error);
            showError("Failed to assign diet plan. Please try again.");
        }
        setLoading(false);
    };

    const handleCreateCustomPlan = async () => {
        if (!formData.title.trim()) {
            showError("Please enter a title for the diet plan");
            return;
        }

        const targetGymId = actualGymId;
        if (!targetGymId) {
            showError("No gym selected");
            return;
        }

        setLoading(true);
        try {
            const storedUser = localStorage.getItem("gymUser");
            const currentUser = storedUser ? JSON.parse(storedUser) : null;
            const createdBy = currentUser?.id;

            // Create the diet plan with member_id to make it member-specific
            const { data: newPlan, error: insertError } = await supabase
                .from("diet_plans")
                .insert({
                    gym_id: targetGymId,
                    title: formData.title,
                    description: formData.description || null,
                    is_template: false,
                    created_by: createdBy,
                    member_id: actualMemberId, // This makes it member-specific
                })
                .select()
                .single();

            if (insertError) throw insertError;
            const planId = newPlan.id;

            // Save days with meals
            for (const dayNum of Object.keys(days)) {
                const day = days[dayNum];
                if (day.meals && day.meals.length > 0) {
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

            // Remove any existing diet plan assignments for this member
            // (A member should only have one active diet plan at a time)
            await supabase
                .from("member_diets")
                .delete()
                .eq("member_id", actualMemberId);

            // Assign the newly created plan to the member
            const { error: assignError } = await supabase
                .from("member_diets")
                .insert({
                    member_id: actualMemberId,
                    diet_plan_id: planId,
                    assigned_by: createdBy,
                    assigned_by_trainer_id: trainerId || null,
                });

            if (assignError) throw assignError;

            showSuccess("Custom diet plan created and assigned successfully!");
            if (onAssign) {
                onAssign();
            }
            if (onAssigned) {
                onAssigned();
            }
            onClose();
        } catch (error) {
            console.error("Error creating diet plan:", error);
            showError("Failed to create diet plan: " + (error.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    // Meal management functions
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
            newDays[dayNum].meals.splice(mealIndex, 1);
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
            newMeals[mealIndex].items.push({
                food_name: "",
                quantity: "",
                calories: "",
                notes: "",
            });
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
            newMeals[mealIndex].items.splice(itemIndex, 1);
            newDays[dayNum] = { ...newDays[dayNum], meals: newMeals };
            return newDays;
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Modal Header */}
                <div className="p-4 sm:p-6 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                                {mode === "select" ? "Assign Diet Plan" : "Create Custom Diet Plan"}
                            </h3>
                            <p className="text-gray-500 text-xs sm:text-sm mt-1">
                                {mode === "select" 
                                    ? `Select a diet plan for ${actualMemberName}` 
                                    : `Create a personalized diet plan for ${actualMemberName}`}
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
                            ) : dietPlans.length === 0 ? (
                                <div className="text-center py-8">
                                    <span className="text-4xl">🥗</span>
                                    <p className="text-gray-500 mt-2">
                                        No diet plans available
                                    </p>
                                    <p className="text-gray-400 text-sm mt-1">
                                        Create diet plans in Settings or create a custom one for this member
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
                                        Select Diet Plan *
                                    </label>
                                    {dietPlans.map((plan) => (
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
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold text-gray-900">
                                                            {plan.title}
                                                        </p>
                                                        {plan.is_template && (
                                                            <span className="px-2 py-0.5 bg-orange-100 text-[#f0813d] text-xs rounded-full">
                                                                Template
                                                            </span>
                                                        )}
                                                    </div>
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
                                        placeholder="e.g., Weight Loss Plan, Muscle Gain Plan"
                                    />
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
                                        placeholder="Brief description of this diet plan"
                                    />
                                </div>

                                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                    <p className="text-xs text-[#f0813d]">
                                        <strong>Note:</strong> This diet plan will be created exclusively for {actualMemberName} and won't appear in the general diet plans list.
                                    </p>
                                </div>
                            </div>

                            {/* Day Selector Tabs */}
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Weekly Meal Plan
                                </h4>
                                <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar">
                                    {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => (
                                        <button
                                            key={dayNum}
                                            type="button"
                                            onClick={() => setActiveDay(dayNum)}
                                            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                                activeDay === dayNum
                                                    ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white"
                                                    : days[dayNum]?.meals?.length > 0
                                                        ? "bg-orange-100 text-[#f0813d] border border-orange-200"
                                                        : "bg-gray-100 text-gray-600"
                                            }`}
                                        >
                                            {DAY_NAMES[dayNum].substring(0, 3)}
                                            {days[dayNum]?.meals?.length > 0 && activeDay !== dayNum && (
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
                                        onClick={() => addMealToDay(activeDay)}
                                        className="px-3 py-1.5 bg-orange-50 text-[#f0813d] rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-orange-100 transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add Meal
                                    </button>
                                </div>

                                {/* Meals for Active Day */}
                                {days[activeDay]?.meals?.length === 0 ? (
                                    <div className="text-center py-6 text-gray-400">
                                        <Apple className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No meals added yet</p>
                                        <p className="text-xs">Click "Add Meal" to start</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {days[activeDay]?.meals?.map((meal, mealIndex) => (
                                            <div key={mealIndex} className="bg-gray-50 rounded-lg p-3 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                                        <select
                                                            value={meal.meal_type}
                                                            onChange={(e) => updateMeal(activeDay, mealIndex, "meal_type", e.target.value)}
                                                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f0813d]"
                                                        >
                                                            <option value="">Select Meal Type</option>
                                                            {MEAL_TYPES.map((type) => (
                                                                <option key={type.value} value={type.value}>
                                                                    {type.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="time"
                                                            value={meal.meal_time || ""}
                                                            onChange={(e) => updateMeal(activeDay, mealIndex, "meal_time", e.target.value)}
                                                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f0813d]"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeMeal(activeDay, mealIndex)}
                                                        className="ml-2 p-2 text-[#f0813d] hover:bg-orange-50 rounded-lg"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <textarea
                                                    placeholder="Instructions (optional)"
                                                    value={meal.instructions || ""}
                                                    onChange={(e) => updateMeal(activeDay, mealIndex, "instructions", e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm resize-none"
                                                    rows={2}
                                                />

                                                {/* Food Items */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-medium text-gray-600">Food Items</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => addItemToMeal(activeDay, mealIndex)}
                                                            className="text-xs text-[#f0813d] hover:text-[#f0813d] flex items-center gap-1"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            Add Item
                                                        </button>
                                                    </div>
                                                    
                                                    {meal.items?.map((item, itemIndex) => (
                                                        <div key={itemIndex} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-100">
                                                            <input
                                                                type="text"
                                                                placeholder="Food name"
                                                                value={item.food_name}
                                                                onChange={(e) => updateMealItem(activeDay, mealIndex, itemIndex, "food_name", e.target.value)}
                                                                className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs"
                                                            />
                                                            <input
                                                                type="text"
                                                                placeholder="Qty"
                                                                value={item.quantity || ""}
                                                                onChange={(e) => updateMealItem(activeDay, mealIndex, itemIndex, "quantity", e.target.value)}
                                                                className="w-16 px-2 py-1.5 border border-gray-200 rounded text-xs"
                                                            />
                                                            <input
                                                                type="number"
                                                                placeholder="Cal"
                                                                value={item.calories || ""}
                                                                onChange={(e) => updateMealItem(activeDay, mealIndex, itemIndex, "calories", e.target.value)}
                                                                className="w-16 px-2 py-1.5 border border-gray-200 rounded text-xs"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => removeMealItem(activeDay, mealIndex, itemIndex)}
                                                                className="p-1 text-[#f0813d] hover:bg-orange-50 rounded"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
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
