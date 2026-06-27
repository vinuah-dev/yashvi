"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
import { useToast } from "@/contexts/ToastContext";

const expenseCategories = [
  { id: "rent", name: "Rent", icon: "🏠" },
  { id: "electricity", name: "Electricity", icon: "⚡" },
  { id: "salary", name: "Trainer Salary", icon: "👨‍🏫" },
  { id: "equipment", name: "Equipment", icon: "🏋️" },
  { id: "maintenance", name: "Maintenance", icon: "🔧" },
  { id: "supplements", name: "Supplements", icon: "💊" },
  { id: "marketing", name: "Marketing", icon: "📢" },
  { id: "other", name: "Other", icon: "📦" },
];

export default function AddExpensePage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedGym, setSelectedGym] = useState(null);
  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      const gym = JSON.parse(storedGym);
      setSelectedGym(gym);
    }
  }, []);

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedGym) {
      showError("Please select a gym first");
      return;
    }

    setLoading(true);

    try {
      const amount = parseFloat(formData.amount);
      
      if (amount <= 0) {
        showError("Please enter a valid amount");
        setLoading(false);
        return;
      }

      if (!formData.category) {
        showError("Please select a category");
        setLoading(false);
        return;
      }

      // Get logged-in user
      const storedUser = localStorage.getItem("gymUser");
      const user = storedUser ? JSON.parse(storedUser) : null;

      // Insert expense into database
      const { error: insertError } = await supabase
        .from("expenses")
        .insert({
          gym_id: selectedGym.id,
          category: formData.category,
          amount: amount,
          expense_date: formData.date,
          notes: formData.notes || null,
          created_by: user?.id || null,
        });

      if (insertError) {
        throw insertError;
      }

      showSuccess("Expense added successfully!");
      setTimeout(() => router.back(), 1000);
    } catch (error) {
      console.error("Error recording expense:", error);
      showError("Failed to record expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Add Expense" />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {/* Category Selection */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Category <span className="text-[#f0813d]">*</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {expenseCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => updateForm("category", cat.id)}
                className={`p-3 rounded-xl flex flex-col items-center gap-1 transition ${
                  formData.category === cat.id
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="text-xs text-center">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount & Date */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount <span className="text-[#f0813d]">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-xl font-semibold outline-none focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] transition"
              placeholder="₹ 0"
              value={formData.amount}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  updateForm("amount", value);
                }
              }}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Enter amount greater than 0</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date <span className="text-[#f0813d]">*</span>
            </label>
            <input
              type="date"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] transition"
              value={formData.date}
              onChange={(e) => updateForm("date", e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl outline-none resize-none focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] transition"
              rows={3}
              placeholder="Expense details..."
              value={formData.notes}
              onChange={(e) => updateForm("notes", e.target.value)}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!formData.category || !formData.amount || loading}
            className="flex-1 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition"
          >
            {loading ? "Saving..." : "Add Expense"}
          </button>
        </div>
      </form>
    </div>
  );
}
