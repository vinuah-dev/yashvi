"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";

const PLAN_OPTIONS = ["Monthly", "Quarterly", "Half-Yearly", "Yearly", "PT", "Other"];
const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "joined", label: "Joined" },
  { value: "not_interested", label: "Not Interested" },
];

export default function EditInquiryPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [selectedGym, setSelectedGym] = useState(null);
  const [originalPhone, setOriginalPhone] = useState("");
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    visit_date: "",
    follow_up_date: "",
    interested_plan: "",
    status: "new",
    notes: "",
  });

  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      const gym = JSON.parse(storedGym);
      setSelectedGym(gym);
      fetchInquiry(gym.id);
    } else {
      router.push("/admin/dashboard");
    }
  }, [params.id]);

  const fetchInquiry = async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from("inquiries")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) throw error;

      if (data) {
        setOriginalPhone(data.phone);
        setFormData({
          full_name: data.full_name || "",
          phone: data.phone || "",
          visit_date: data.visit_date || "",
          follow_up_date: data.follow_up_date || "",
          interested_plan: data.interested_plan || "",
          status: data.status || "new",
          notes: data.notes || "",
        });
      }
    } catch (error) {
      console.error("Error fetching inquiry:", error);
      alert("Failed to load inquiry");
      router.push("/inquiries");
    } finally {
      setFetching(false);
    }
  };

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!formData.full_name.trim()) errs.full_name = "Full name is required";
    if (!formData.phone.trim()) {
      errs.phone = "Phone number is required";
    } else if (!/^[6-9]\d{9}$/.test(formData.phone.replace(/\s|-/g, ""))) {
      errs.phone = "Enter a valid 10-digit phone number";
    }
    if (!formData.visit_date) errs.visit_date = "Visit date is required";
    if (formData.follow_up_date && formData.follow_up_date < formData.visit_date) {
      errs.follow_up_date = "Follow-up date cannot be before visit date";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const cleanPhone = formData.phone.replace(/\s|-/g, "");

      // Check duplicate phone if changed
      if (cleanPhone !== originalPhone) {
        const { data: existing } = await supabase
          .from("inquiries")
          .select("id, full_name")
          .eq("gym_id", selectedGym.id)
          .eq("phone", cleanPhone)
          .neq("id", params.id)
          .maybeSingle();

        if (existing) {
          setErrors({ phone: `This phone number already exists for inquiry: ${existing.full_name}` });
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase
        .from("inquiries")
        .update({
          full_name: formData.full_name.trim(),
          phone: cleanPhone,
          visit_date: formData.visit_date,
          follow_up_date: formData.follow_up_date || null,
          interested_plan: formData.interested_plan || null,
          status: formData.status,
          notes: formData.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id);

      if (error) {
        if (error.code === "23505") {
          setErrors({ phone: "A inquiry with this phone number already exists for this gym." });
        } else {
          throw error;
        }
        setLoading(false);
        return;
      }

      alert("Inquiry updated successfully!");
      router.push("/inquiries");
    } catch (error) {
      console.error("Error updating inquiry:", error);
      alert("Failed to update inquiry. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Edit Inquiry" />
        <div className="flex items-center justify-center h-96">
          <div className="w-10 h-10 border-4 border-[#f0813d] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Edit Inquiry" />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {/* Full Name */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <label className="block text-sm font-semibold text-gray-800">
            Full Name <span className="text-[#f0813d]">*</span>
          </label>
          <input
            type="text"
            className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none transition text-gray-900 ${
              errors.full_name ? "border-[#f0813d]" : "border-gray-200"
            }`}
            placeholder="Enter full name"
            value={formData.full_name}
            onChange={(e) => updateForm("full_name", e.target.value)}
          />
          {errors.full_name && <p className="text-xs text-[#f0813d]">{errors.full_name}</p>}
        </div>

        {/* Phone */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <label className="block text-sm font-semibold text-gray-800">
            Phone Number <span className="text-[#f0813d]">*</span>
          </label>
          <input
            type="tel"
            className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none transition text-gray-900 ${
              errors.phone ? "border-[#f0813d]" : "border-gray-200"
            }`}
            placeholder="10-digit phone number"
            value={formData.phone}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
              updateForm("phone", val);
            }}
            maxLength={10}
            inputMode="tel"
          />
          {errors.phone && <p className="text-xs text-[#f0813d]">{errors.phone}</p>}
        </div>

        {/* Visit Date */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <label className="block text-sm font-semibold text-gray-800">
            Visit Date <span className="text-[#f0813d]">*</span>
          </label>
          <input
            type="date"
            className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none transition text-gray-900 ${
              errors.visit_date ? "border-[#f0813d]" : "border-gray-200"
            }`}
            value={formData.visit_date}
            onChange={(e) => updateForm("visit_date", e.target.value)}
          />
          {errors.visit_date && <p className="text-xs text-[#f0813d]">{errors.visit_date}</p>}
        </div>

        {/* Follow-Up Date */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <label className="block text-sm font-semibold text-gray-800">Follow-Up Date</label>
          <input
            type="date"
            className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none transition text-gray-900 ${
              errors.follow_up_date ? "border-[#f0813d]" : "border-gray-200"
            }`}
            value={formData.follow_up_date}
            onChange={(e) => updateForm("follow_up_date", e.target.value)}
            min={formData.visit_date || undefined}
          />
          {errors.follow_up_date && <p className="text-xs text-[#f0813d]">{errors.follow_up_date}</p>}
          <p className="text-xs text-gray-500">Must be on or after visit date</p>
        </div>

        {/* Interested Plan */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <label className="block text-sm font-semibold text-gray-800">Interested Plan</label>
          <div className="flex flex-wrap gap-2">
            {PLAN_OPTIONS.map((plan) => (
              <button
                key={plan}
                type="button"
                onClick={() => updateForm("interested_plan", formData.interested_plan === plan ? "" : plan)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  formData.interested_plan === plan
                    ? "bg-[#f0813d] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {plan}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <label className="block text-sm font-semibold text-gray-800">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => updateForm("status", s.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  formData.status === s.value
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <label className="block text-sm font-semibold text-gray-800">Notes / Remarks</label>
          <textarea
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none transition text-gray-900 resize-none"
            rows={3}
            placeholder="Additional notes..."
            value={formData.notes}
            onChange={(e) => updateForm("notes", e.target.value)}
          />
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
            disabled={loading}
            className="flex-1 py-3 bg-[#f0813d] text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-[#f0813d] active:scale-[0.98] transition shadow-sm"
          >
            {loading ? "Updating..." : "Update Inquiry"}
          </button>
        </div>
      </form>
    </div>
  );
}
