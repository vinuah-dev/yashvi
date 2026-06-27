"use client";

import FeatureGate from "@/components/FeatureGate";
import { useFeatureAccess } from "@/lib/hooks/useFeatureAccess";


import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { useGymLogo } from "@/lib/hooks/useGymLogo";
import {
  Activity,
  Scale,
  Dumbbell,
  Utensils,
  Clock,
  Camera,
  Bot,
  Plus,
  Trash2,
  Pencil,
  X,
  ChevronLeft,
  ChevronRight,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetDate(dateStr, days) {
  const [y, m, day] = dateStr.split("-").map(Number);
  const d = new Date(y, m - 1, day + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EXERCISES = [
  "Bench Press", "Squats", "Deadlift", "Pull-ups", "Push-ups",
  "Shoulder Press", "Bicep Curls", "Tricep Dips", "Lunges", "Plank",
  "Leg Press", "Lat Pulldown", "Cable Row", "Incline Press", "Dumbbell Fly",
  "Running", "Cycling", "Jumping Jacks", "Burpees", "Mountain Climbers",
];

const MEAL_ICONS = { breakfast: "🍳", lunch: "🍱", dinner: "🍽️", snack: "🥪" };

// ─── AI Daily Tries ─────────────────────────────────────────
const AI_DAILY_LIMIT = 5;
function getAiTriesKey(memberId) {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return `ai_tries_${memberId}_${today}`;
}
function getAiTriesLeft(memberId) {
  const used = parseInt(localStorage.getItem(getAiTriesKey(memberId)) || "0");
  return Math.max(0, AI_DAILY_LIMIT - used);
}
function consumeAiTry(memberId) {
  const key = getAiTriesKey(memberId);
  const used = parseInt(localStorage.getItem(key) || "0");
  localStorage.setItem(key, String(used + 1));
  return Math.max(0, AI_DAILY_LIMIT - (used + 1));
}
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

// ─── Toast ─────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
      {type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {message}
    </div>
  );
}

// ─── Mini Bar Chart ─────────────────────────────────────────────────────────

function WeightChart({ trendData }) {
  if (!trendData || trendData.length === 0) {
    return (
      <div className="h-28 flex items-center justify-center text-gray-400 text-sm">
        No weight data yet
      </div>
    );
  }

  // Group by date, pick morning weight preferentially
  const byDate = {};
  trendData.forEach((r) => {
    if (!byDate[r.logged_at]) byDate[r.logged_at] = {};
    byDate[r.logged_at][r.log_type] = parseFloat(r.weight_kg);
  });

  const days = Object.keys(byDate).sort();
  const values = days.map((d) => byDate[d].morning || byDate[d].night || 0);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-1 h-28 px-1">
      {days.map((day, i) => {
        const val = values[i];
        const heightPct = ((val - min) / range) * 100;
        const barH = Math.max(8, (heightPct / 100) * 80);
        const label = new Date(day + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        return (
          <div key={day} className="flex flex-col items-center flex-1 gap-1">
            <span className="text-[10px] text-gray-500">{val}kg</span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-blue-500 to-blue-400"
              style={{ height: `${barH}px` }}
            />
            <span className="text-[9px] text-gray-400 truncate w-full text-center">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal Base ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Weight Modal ───────────────────────────────────────────────────────────

function WeightModal({ onClose, onSave, existingLogs, date }) {
  const morning = existingLogs.find((l) => l.log_type === "morning");
  const night = existingLogs.find((l) => l.log_type === "night");
  const [logType, setLogType] = useState(morning ? "night" : "morning");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!weight || isNaN(weight) || parseFloat(weight) <= 0) return;
    setSaving(true);
    await onSave({ weight_kg: parseFloat(weight), log_type: logType, notes });
    setSaving(false);
    onClose();
  };

  return (
    <Modal title="Log Weight" onClose={onClose}>
      {/* type toggle */}
      <div className="flex gap-2 mb-4">
        {["morning", "night"].map((t) => {
          const exists = t === "morning" ? morning : night;
          return (
            <button
              key={t}
              onClick={() => setLogType(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${logType === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}
            >
              {t === "morning" ? "🌅 Morning" : "🌙 Night"}
              {exists && <span className="ml-1 text-xs opacity-70">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
        <input
          type="number"
          step="0.1"
          min="20"
          max="300"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="e.g. 72.5"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoFocus
        />
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. After workout, felt bloated..."
          className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !weight}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
        Save Weight
      </button>
    </Modal>
  );
}

// ─── Workout Modal ──────────────────────────────────────────────────────────

function estimateCalories(sets, reps, weightKg, durationMin) {
  let cal = 0;
  if (sets && reps && weightKg) {
    // Weight training estimate: sets × reps × weight × 0.1
    cal += parseFloat(sets) * parseFloat(reps) * parseFloat(weightKg) * 0.1;
  }
  if (durationMin) {
    // Cardio/duration estimate: ~5 cal/min
    cal += parseFloat(durationMin) * 5;
  }
  return cal > 0 ? Math.round(cal) : null;
}

function WorkoutModal({ onClose, onSave, existing }) {
  const [exercise, setExercise] = useState(existing?.exercise_name || "");
  const [sets, setSets] = useState(existing?.sets || "");
  const [reps, setReps] = useState(existing?.reps || "");
  const [weightUsed, setWeightUsed] = useState(existing?.weight_used_kg || "");
  const [duration, setDuration] = useState(existing?.duration_minutes || "");
  const [calories, setCalories] = useState(existing?.calories_burned || "");
  const [calAutoCalc, setCalAutoCalc] = useState(false);
  const [notes, setNotes] = useState(existing?.notes || "");
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const updateWorkoutMetric = (field, value) => {
    const next = {
      sets,
      reps,
      weightUsed,
      duration,
      [field]: value,
    };

    const setters = {
      sets: setSets,
      reps: setReps,
      weightUsed: setWeightUsed,
      duration: setDuration,
    };
    setters[field](value);

    const est = estimateCalories(
      next.sets,
      next.reps,
      next.weightUsed,
      next.duration,
    );
    if (est !== null) {
      setCalories(String(est));
      setCalAutoCalc(true);
    } else {
      setCalAutoCalc(false);
    }
  };

  const filtered = EXERCISES.filter((e) =>
    e.toLowerCase().includes(exercise.toLowerCase())
  ).slice(0, 6);

  const handleSave = async () => {
    if (!exercise.trim()) return;
    setSaving(true);
    await onSave({
      exercise_name: exercise.trim(),
      sets: sets ? parseInt(sets) : null,
      reps: reps ? parseInt(reps) : null,
      weight_used_kg: weightUsed ? parseFloat(weightUsed) : null,
      duration_minutes: duration ? parseInt(duration) : null,
      calories_burned: calories ? parseInt(calories) : null,
      notes,
    });
    setSaving(false);
    onClose();
  };

  return (
    <Modal title={existing ? "Edit Workout" : "Log Workout"} onClose={onClose}>
      <div className="mb-4 relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">Exercise Name</label>
        <input
          type="text"
          value={exercise}
          onChange={(e) => { setExercise(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="e.g. Bench Press"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
          autoFocus
        />
        {showSuggestions && exercise && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
            {filtered.map((ex) => (
              <button
                key={ex}
                onClick={() => { setExercise(ex); setShowSuggestions(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-orange-50 hover:text-orange-700"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: "Sets", field: "sets", val: sets, placeholder: "e.g. 3" },
          { label: "Reps", field: "reps", val: reps, placeholder: "e.g. 12" },
          { label: "Weight Used (kg)", field: "weightUsed", val: weightUsed, placeholder: "e.g. 60" },
          { label: "Duration (min)", field: "duration", val: duration, placeholder: "e.g. 45" },
        ].map(({ label, field, val, placeholder }) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input
              type="number"
              value={val}
              onChange={(e) => updateWorkoutMetric(field, e.target.value)}
              placeholder={placeholder}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        ))}
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-600">Calories Burned</label>
          {calAutoCalc && (
            <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">Auto estimated ✦ editable</span>
          )}
        </div>
        <input
          type="number"
          value={calories}
          onChange={(e) => { setCalories(e.target.value); setCalAutoCalc(false); }}
          placeholder="e.g. 250"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Felt strong today"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !exercise.trim()}
        className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dumbbell className="w-4 h-4" />}
        {existing ? "Update Workout" : "Save Workout"}
      </button>
    </Modal>
  );
}

// ─── Calorie Modal ──────────────────────────────────────────────────────────

function CalorieModal({ onClose, onSave, existing, memberId, aiTriesLeft = AI_DAILY_LIMIT, onAiTryUsed }) {
  const [mealType, setMealType] = useState(existing?.meal_type || "breakfast");
  const [food, setFood] = useState(existing?.food_description || "");
  const [calories, setCalories] = useState(existing?.calories || "");
  const [protein, setProtein] = useState(existing?.protein_g || "");
  const [carbs, setCarbs] = useState(existing?.carbs_g || "");
  const [fat, setFat] = useState(existing?.fat_g || "");
  const [mealTime, setMealTime] = useState(existing?.meal_time || (() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  })());
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (aiTriesLeft <= 0) {
      alert("Daily AI limit reached (5/day). Try again tomorrow!");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(",")[1];
      const preview = ev.target.result;
      setImagePreview(preview);
      setAnalyzing(true);
      try {
        const res = await fetch("/api/health-tracker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "analyze_food_image", member_id: "scan", base64Image: base64, mimeType: file.type }),
        });
        const data = await res.json();
        if (data.result) {
          const r = data.result;
          if (r.food_description) setFood(r.food_description);
          if (r.calories) setCalories(String(r.calories));
          if (r.protein_g) setProtein(String(r.protein_g));
          if (r.carbs_g) setCarbs(String(r.carbs_g));
          if (r.fat_g) setFat(String(r.fat_g));
          if (onAiTryUsed) onAiTryUsed();
        }
      } catch (err) {
        console.error("Image analysis failed:", err);
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!food.trim() || !calories) return;
    setSaving(true);
    await onSave({
      meal_type: mealType,
      meal_time: mealTime || null,
      food_description: food.trim(),
      calories: parseInt(calories),
      protein_g: protein ? parseFloat(protein) : null,
      carbs_g: carbs ? parseFloat(carbs) : null,
      fat_g: fat ? parseFloat(fat) : null,
    });
    setSaving(false);
    onClose();
  };

  return (
    <Modal title={existing ? "Edit Meal" : "Log Meal"} onClose={onClose}>
      {/* meal type */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {Object.entries(MEAL_ICONS).map(([type, icon]) => (
          <button
            key={type}
            onClick={() => setMealType(type)}
            className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all ${mealType === type ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200"}`}
          >
            <span className="text-lg">{icon}</span>
            {MEAL_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Photo scan */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">📸 Scan Food Photo</label>
        <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-3 cursor-pointer transition-all ${imagePreview ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-green-400 hover:bg-green-50"}`}>
          <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
          {analyzing ? (
            <span className="flex items-center gap-2 text-sm text-green-600 font-medium">
              <Loader2 className="w-4 h-4 animate-spin" /> Analyzing food...
            </span>
          ) : imagePreview ? (
            <span className="flex items-center gap-2 text-sm text-green-600 font-medium">
              <Camera className="w-4 h-4" /> Photo analyzed ✓ — tap to change
            </span>
          ) : aiTriesLeft <= 0 ? (
            <span className="flex items-center gap-2 text-sm text-red-400">
              <Camera className="w-4 h-4" /> Daily AI limit reached
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sm text-gray-500">
              <Camera className="w-4 h-4" /> Upload or take a photo · {aiTriesLeft} AI tries left
            </span>
          )}
        </label>
        {imagePreview && (
          <img src={imagePreview} alt="Food" className="mt-2 w-full h-28 object-cover rounded-xl" />
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-gray-500" /> Time
        </label>
        <input
          type="time"
          value={mealTime}
          onChange={(e) => setMealTime(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">What did you eat?</label>
        <textarea
          value={food}
          onChange={(e) => setFood(e.target.value)}
          placeholder="e.g. Dal chawal with salad, 2 rotis with sabzi..."
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          autoFocus
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Calories</label>
        <input
          type="number"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          placeholder="e.g. 450"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Macros (optional)</p>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Protein (g)", val: protein, set: setProtein, color: "blue" },
          { label: "Carbs (g)", val: carbs, set: setCarbs, color: "yellow" },
          { label: "Fat (g)", val: fat, set: setFat, color: "red" },
        ].map(({ label, val, set }) => (
          <div key={label}>
            <label className="block text-xs text-gray-600 mb-1">{label}</label>
            <input
              type="number"
              value={val}
              onChange={(e) => set(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !food.trim() || !calories}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Utensils className="w-4 h-4" />}
        {existing ? "Update Meal" : "Save Meal"}
      </button>
    </Modal>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function HealthTrackerPage() {
  const router = useRouter();
  const gymLogo = useGymLogo();
  const [member, setMember] = useState(null);
  const { isEnabled, loading: featureLoading } = useFeatureAccess(
    member?.gym_id || member?.gymId,
  );
  const [date, setDate] = useState(todayStr());
  const [activeTab, setActiveTab] = useState("weight");
  const [loading, setLoading] = useState(true);

  // Data
  const [weightLogs, setWeightLogs] = useState([]);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [calorieLogs, setCalorieLogs] = useState([]);
  const [weightTrend, setWeightTrend] = useState([]);

  // Modals
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [showCalorieModal, setShowCalorieModal] = useState(false);
  const [editingCalorie, setEditingCalorie] = useState(null);

  // AI Coach
  const [goal, setGoal] = useState("");
  const [aiAdvice, setAiAdvice] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [aiTriesLeft, setAiTriesLeft] = useState(AI_DAILY_LIMIT);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => setToast({ message, type });

  // Auth
  useEffect(() => {
    const stored = localStorage.getItem("member");
    if (!stored) { router.replace("/auth/login"); return; }
    const m = JSON.parse(stored);
    setMember(m);
    const savedGoal = localStorage.getItem("health_goal_" + m.id) || "";
    setGoal(savedGoal);
    setAiTriesLeft(getAiTriesLeft(m.id));
  }, [router]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!member) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/health-tracker?member_id=${member.id}&date=${date}`);
      const data = await res.json();
      setWeightLogs(data.weightLogs || []);
      setWorkoutLogs(data.workoutLogs || []);
      setCalorieLogs(data.calorieLogs || []);
      setWeightTrend(data.weightTrend || []);
      setAiAdvice("");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [member, date]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Save handlers
  const handleSaveWeight = async (payload) => {
    const res = await fetch("/api/health-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "log_weight", member_id: member.id, logged_at: date, ...payload }),
    });
    if (res.ok) { showToast("Weight logged!"); fetchLogs(); }
    else showToast("Failed to save weight", "error");
  };

  const handleSaveWorkout = async (payload) => {
    const res = await fetch("/api/health-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "log_workout", member_id: member.id, logged_at: date, ...payload }),
    });
    if (res.ok) { showToast("Workout logged!"); fetchLogs(); }
    else showToast("Failed to save workout", "error");
  };

  const handleUpdateWorkout = async (id, payload) => {
    const res = await fetch("/api/health-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_workout", id, member_id: member.id, ...payload }),
    });
    if (res.ok) { showToast("Workout updated!"); fetchLogs(); }
    else showToast("Failed to update workout", "error");
  };

  const handleSaveCalorie = async (payload) => {
    const res = await fetch("/api/health-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "log_calorie", member_id: member.id, logged_at: date, ...payload }),
    });
    if (res.ok) { showToast("Meal logged!"); fetchLogs(); }
    else showToast("Failed to save meal", "error");
  };

  const handleUpdateCalorie = async (id, payload) => {
    const res = await fetch("/api/health-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_calorie", id, member_id: member.id, ...payload }),
    });
    if (res.ok) { showToast("Meal updated!"); fetchLogs(); }
    else showToast("Failed to update meal", "error");
  };

  const handleDelete = async (id, type) => {
    const res = await fetch(`/api/health-tracker?id=${id}&type=${type}`, { method: "DELETE" });
    if (res.ok) { showToast("Deleted"); fetchLogs(); }
    else showToast("Failed to delete", "error");
  };

  const handleGetAiAdvice = async () => {
    if (!member || aiTriesLeft <= 0) {
      showToast("Daily AI limit reached (5/day). Try again tomorrow!", "error");
      return;
    }
    setAiLoading(true);
    setAiError(false);

    const morningW = weightLogs.find((l) => l.log_type === "morning")?.weight_kg;
    const nightW = weightLogs.find((l) => l.log_type === "night")?.weight_kg;
    const totalCalIn = calorieLogs.reduce((s, l) => s + l.calories, 0);
    const totalCalBurned = workoutLogs.reduce((s, l) => s + (l.calories_burned || 0), 0);

    const summary = [
      morningW ? `Morning weight: ${morningW}kg` : "Morning weight: not logged",
      nightW ? `Night weight: ${nightW}kg` : "Night weight: not logged",
      workoutLogs.length > 0
        ? `Workouts: ${workoutLogs.map((w) => w.exercise_name).join(", ")} (${totalCalBurned} cal burned)`
        : "Workouts: none logged",
      totalCalIn > 0
        ? `Total calories consumed: ${totalCalIn} kcal (${calorieLogs.length} meals logged)`
        : "Calories: none logged",
      calorieLogs.length > 0
        ? `Meals: ${calorieLogs.map((c) => `${MEAL_ICONS[c.meal_type]} ${c.food_description}`).join(", ")}`
        : "",
    ].filter(Boolean).join("\n");

    const res = await fetch("/api/health-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_ai_advice", member_id: member.id, summary, goal }),
    });

    if (res.ok) {
      const data = await res.json();
      setAiAdvice(data.advice || "");
      const left = consumeAiTry(member.id);
      setAiTriesLeft(left);
    } else {
      setAiError(true);
    }
    setAiLoading(false);
  };

  const handleGoalChange = (val) => {
    setGoal(val);
    if (member) localStorage.setItem("health_goal_" + member.id, val);
  };

  // Computed values
  const morningWeight = weightLogs.find((l) => l.log_type === "morning")?.weight_kg;
  const nightWeight = weightLogs.find((l) => l.log_type === "night")?.weight_kg;
  const totalCalIn = calorieLogs.reduce((s, l) => s + l.calories, 0);
  const totalCalBurned = workoutLogs.reduce((s, l) => s + (l.calories_burned || 0), 0);
  const netCal = totalCalIn - totalCalBurned;
  const calGoal = 2000; // default goal
  const calPct = Math.min(100, Math.round((totalCalIn / calGoal) * 100));

  const TABS = [
    { id: "weight", label: "Weight", icon: <Scale className="w-4 h-4" /> },
    { id: "workout", label: "Workout", icon: <Dumbbell className="w-4 h-4" /> },
    { id: "nutrition", label: "Nutrition", icon: <Utensils className="w-4 h-4" /> },
  ];

  if (!featureLoading && isEnabled("health_tracker") === false) {
    return <FeatureGate enabled={false} featureName="Health Tracker" />;
  }

  return (
    <div className="health-tracker-light min-h-screen bg-gradient-to-b from-slate-50 to-gray-100 text-[#1a1c1c]">
      <Header title="Health Tracker" gymLogo={gymLogo} />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-screen-md mx-auto px-4 pb-28 pt-4">
        <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-orange-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f0813d] text-white shadow-[0_12px_28px_rgba(240,129,61,0.22)]">
              <Activity className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f0813d]">
                Daily performance
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-[#1a1c1c]">
                Track progress. Build consistency.
              </h2>
              <p className="mt-1 text-xs font-semibold text-gray-500">
                Weight, workouts, nutrition and AI coaching in one place.
              </p>
            </div>
          </div>
        </section>

        {/* Date Navigator */}
        <div className="flex items-center justify-between bg-white rounded-2xl p-3 mb-4 shadow-sm border border-gray-100">
          <button
            onClick={() => setDate(offsetDate(date, -1))}
            className="p-2 hover:bg-gray-100 rounded-xl"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-center">
            <p className="font-semibold text-gray-800">{formatDate(date)}</p>
            {date === todayStr() && (
              <span className="text-xs text-blue-600 font-medium">Today</span>
            )}
          </div>
          <button
            onClick={() => { if (date < todayStr()) setDate(offsetDate(date, 1)); }}
            disabled={date >= todayStr()}
            className="p-2 hover:bg-gray-100 rounded-xl disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100">
            <Scale className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xs text-gray-500 mb-0.5">Weight</p>
            <p className="font-bold text-gray-800 text-sm">
              {morningWeight ? `${morningWeight}kg` : "—"}
            </p>
            <p className="text-[10px] text-gray-400">morning</p>
          </div>

          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100">
            <Utensils className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-xs text-gray-500 mb-0.5">Cal In</p>
            <p className="font-bold text-gray-800 text-sm">{totalCalIn || "—"}</p>
            <p className="text-[10px] text-gray-400">kcal</p>
          </div>

          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100">
            <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
            <p className="text-xs text-gray-500 mb-0.5">Burned</p>
            <p className="font-bold text-gray-800 text-sm">{totalCalBurned || "—"}</p>
            <p className="text-[10px] text-gray-400">kcal</p>
          </div>
        </div>

        {/* Net Calorie Bar */}
        {(totalCalIn > 0 || totalCalBurned > 0) && (
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Net Calories</span>
              <span className={`text-sm font-bold flex items-center gap-1 ${netCal > 0 ? "text-orange-500" : "text-green-600"}`}>
                {netCal > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {netCal > 0 ? "+" : ""}{netCal} kcal
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${calPct > 90 ? "bg-red-500" : calPct > 70 ? "bg-orange-400" : "bg-green-500"}`}
                style={{ width: `${calPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{calPct}% of {calGoal} kcal daily goal</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-2xl">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* ── WEIGHT TAB ── */}
            {activeTab === "weight" && (
              <div className="space-y-4">
                {/* Log entries */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-gray-50">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-blue-500" /> Weight Logs
                    </h3>
                    <button
                      onClick={() => setShowWeightModal(true)}
                      className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-xl text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" /> Log
                    </button>
                  </div>

                  {weightLogs.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <Scale className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No weight logged for this day</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {weightLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-4">
                          <div>
                            <span className="text-sm font-medium text-gray-700">
                              {log.log_type === "morning" ? "🌅 Morning" : "🌙 Night"}
                            </span>
                            {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-gray-800">{log.weight_kg} kg</span>
                            <button onClick={() => handleDelete(log.id, "weight")} className="p-1.5 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Weight Difference */}
                {morningWeight && nightWeight && (
                  <div className={`rounded-2xl p-4 flex items-center gap-3 ${parseFloat(nightWeight) > parseFloat(morningWeight) ? "bg-orange-50 border border-orange-100" : "bg-green-50 border border-green-100"}`}>
                    {parseFloat(nightWeight) > parseFloat(morningWeight)
                      ? <TrendingUp className="w-5 h-5 text-orange-500 shrink-0" />
                      : <TrendingDown className="w-5 h-5 text-green-600 shrink-0" />
                    }
                    <div>
                      <p className="text-sm font-medium text-gray-700">Daily difference</p>
                      <p className="text-xs text-gray-500">
                        {parseFloat(nightWeight) > parseFloat(morningWeight) ? "+" : ""}
                        {(parseFloat(nightWeight) - parseFloat(morningWeight)).toFixed(1)} kg from morning to night
                      </p>
                    </div>
                  </div>
                )}

                {/* 7-day chart */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" /> 7-Day Trend
                  </h3>
                  <WeightChart trendData={weightTrend} />
                </div>
              </div>
            )}

            {/* ── WORKOUT TAB ── */}
            {activeTab === "workout" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-gray-50">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Dumbbell className="w-4 h-4 text-orange-500" /> Today&apos;s Workouts
                    </h3>
                    <button
                      onClick={() => { setEditingWorkout(null); setShowWorkoutModal(true); }}
                      className="flex items-center gap-1 bg-orange-500 text-white px-3 py-1.5 rounded-xl text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>

                  {workoutLogs.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <Dumbbell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No workouts logged yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {workoutLogs.map((log) => (
                        <div key={log.id} className="p-4 flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{log.exercise_name}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              {log.sets && <span className="text-xs text-gray-500">{log.sets} sets</span>}
                              {log.reps && <span className="text-xs text-gray-500">{log.reps} reps</span>}
                              {log.weight_used_kg && <span className="text-xs text-blue-500 font-medium">⚖️ {log.weight_used_kg}kg</span>}
                              {log.duration_minutes && <span className="text-xs text-gray-500">{log.duration_minutes} min</span>}
                              {log.calories_burned && <span className="text-xs text-orange-500 font-medium">🔥 {log.calories_burned} cal</span>}
                            </div>
                            {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => { setEditingWorkout(log); setShowWorkoutModal(true); }} className="p-1.5 hover:bg-orange-50 rounded-lg">
                              <Pencil className="w-4 h-4 text-orange-400" />
                            </button>
                            <button onClick={() => handleDelete(log.id, "workout")} className="p-1.5 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Workout Summary */}
                {workoutLogs.length > 0 && (
                  <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-3">
                    <Flame className="w-6 h-6 text-orange-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-800">{workoutLogs.length} exercise{workoutLogs.length > 1 ? "s" : ""} completed</p>
                      {totalCalBurned > 0 && (
                        <p className="text-sm text-gray-600">Total burned: {totalCalBurned} kcal</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── NUTRITION TAB ── */}
            {activeTab === "nutrition" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-gray-50">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-green-500" /> Meals
                    </h3>
                    <button
                      onClick={() => { setEditingCalorie(null); setShowCalorieModal(true); }}
                      className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-xl text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>

                  {calorieLogs.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <Utensils className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No meals logged yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {[...calorieLogs].sort((a, b) => {
                          if (!a.meal_time && !b.meal_time) return 0;
                          if (!a.meal_time) return 1;
                          if (!b.meal_time) return -1;
                          return a.meal_time.localeCompare(b.meal_time);
                        }).map((log) => (
                        <div key={log.id} className="p-4 flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-base">{MEAL_ICONS[log.meal_type]}</span>
                              <span className="text-xs font-medium text-gray-500 uppercase">{MEAL_LABELS[log.meal_type]}</span>
                              {log.meal_time && (
                                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" />{log.meal_time}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-800">{log.food_description}</p>
                            <div className="flex gap-3 mt-1">
                              <span className="text-xs font-semibold text-green-600">{log.calories} kcal</span>
                              {log.protein_g && <span className="text-xs text-blue-500">P: {log.protein_g}g</span>}
                              {log.carbs_g && <span className="text-xs text-yellow-600">C: {log.carbs_g}g</span>}
                              {log.fat_g && <span className="text-xs text-red-400">F: {log.fat_g}g</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => { setEditingCalorie(log); setShowCalorieModal(true); }} className="p-1.5 hover:bg-green-50 rounded-lg">
                              <Pencil className="w-4 h-4 text-green-500" />
                            </button>
                            <button onClick={() => handleDelete(log.id, "calorie")} className="p-1.5 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Macro Summary */}
                {calorieLogs.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Today&apos;s Totals</h4>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "Calories", val: totalCalIn, unit: "kcal", color: "text-green-600" },
                        { label: "Protein", val: calorieLogs.reduce((s, l) => s + (l.protein_g || 0), 0).toFixed(0), unit: "g", color: "text-blue-600" },
                        { label: "Carbs", val: calorieLogs.reduce((s, l) => s + (l.carbs_g || 0), 0).toFixed(0), unit: "g", color: "text-yellow-600" },
                        { label: "Fat", val: calorieLogs.reduce((s, l) => s + (l.fat_g || 0), 0).toFixed(0), unit: "g", color: "text-red-500" },
                      ].map(({ label, val, unit, color }) => (
                        <div key={label} className="text-center">
                          <p className={`font-bold text-base ${color}`}>{val}</p>
                          <p className="text-xs text-gray-400">{unit}</p>
                          <p className="text-xs text-gray-500">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* AI Coach Card */}
        <div className="ai-health-coach-card mt-4 rounded-2xl bg-black p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-5 h-5" />
            <h3 className="font-semibold text-white">AI Health Coach</h3>
          </div>

          <div className="mb-3">
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2">
              <Target className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                type="text"
                value={goal}
                onChange={(e) => handleGoalChange(e.target.value)}
                placeholder="Your goal (e.g. lose 5kg, build muscle...)"
                className="bg-transparent text-sm !text-black placeholder:!text-gray-500 flex-1 outline-none"
              />
            </div>
          </div>

          {aiAdvice ? (
            <div className="bg-white rounded-xl p-3 mb-3 text-sm !text-black leading-relaxed">
              {aiAdvice}
            </div>
          ) : aiError ? (
            <div className="bg-white rounded-xl p-3 mb-3 text-sm !text-black">
              Could not get advice right now. Try again.
            </div>
          ) : null}

          <button
            onClick={handleGetAiAdvice}
            disabled={aiLoading || aiTriesLeft <= 0}
            className="ai-advice-button w-full bg-black text-white border border-white/25 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {aiLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
            ) : aiTriesLeft <= 0 ? (
              <><Bot className="w-4 h-4" /> Daily limit reached</>
            ) : (
              <><Bot className="w-4 h-4" /> {aiAdvice ? "Refresh Advice" : "Get AI Advice"} · {aiTriesLeft} left</>
            )}
          </button>
        </div>

      </div>

      {/* Modals */}
      {showWeightModal && (
        <WeightModal
          onClose={() => setShowWeightModal(false)}
          onSave={handleSaveWeight}
          existingLogs={weightLogs}
          date={date}
        />
      )}
      {showWorkoutModal && (
        <WorkoutModal
          onClose={() => { setShowWorkoutModal(false); setEditingWorkout(null); }}
          onSave={editingWorkout
            ? (payload) => handleUpdateWorkout(editingWorkout.id, payload)
            : handleSaveWorkout}
          existing={editingWorkout}
        />
      )}
      {showCalorieModal && (
        <CalorieModal
          onClose={() => { setShowCalorieModal(false); setEditingCalorie(null); }}
          onSave={editingCalorie
            ? (payload) => handleUpdateCalorie(editingCalorie.id, payload)
            : handleSaveCalorie}
          existing={editingCalorie}
          memberId={member?.id}
          aiTriesLeft={aiTriesLeft}
          onAiTryUsed={() => { if (member) { const left = consumeAiTry(member.id); setAiTriesLeft(left); } }}
        />
      )}
    </div>
  );
}
