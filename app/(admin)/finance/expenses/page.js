"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";

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
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
    router.back();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Add Expense" />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {/* Category Selection */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Category *
          </label>
          <div className="grid grid-cols-4 gap-2">
            {expenseCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => updateForm("category", cat.id)}
                className={`p-3 rounded-xl flex flex-col items-center gap-1 ${
                  formData.category === cat.id
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="text-xs">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount & Date */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount *
            </label>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xl font-semibold outline-none"
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none"
              value={formData.date}
              onChange={(e) => updateForm("date", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none resize-none"
              rows={2}
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
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!formData.category || !formData.amount || loading}
            className="flex-1 py-3 bg-black text-white rounded-xl font-medium disabled:opacity-50"
          >
            {loading ? "Saving..." : "Add Expense"}
          </button>
        </div>
      </form>
    </div>
  );
}
