"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
import ProfileImageUpload from "@/components/shared/ProfileImageUpload";
import { useToast } from "@/contexts/ToastContext";

export default function EditMemberClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useToast();
  const memberId = searchParams.get("id");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [profileImage, setProfileImage] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    selfPlanEditAccess: false,
  });

  useEffect(() => {
    if (memberId) {
      fetchMemberData();
    } else {
      setFetching(false);
    }
  }, [memberId]);

  const fetchMemberData = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("id", memberId)
        .single();

      if (error) {
        console.error("Error fetching member:", error);
        showError("Failed to load member data");
        return;
      }

      if (data) {
        setFormData({
          name: data.full_name || "",
          phone: data.phone || "",
          email: data.email || "",
          selfPlanEditAccess: data.self_plan_edit_access || false,
        });
        setProfileImage(data.profile_image || null);
      }
    } catch (err) {
      console.error("Error:", err);
      showError("Failed to load member data");
    }
    setFetching(false);
  };

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!memberId) {
      showError("No member ID provided");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("members")
        .update({
          full_name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          self_plan_edit_access: formData.selfPlanEditAccess,
        })
        .eq("id", memberId);

      if (error) {
        throw error;
      }

      showSuccess("Member updated successfully!");
      router.back();
    } catch (error) {
      console.error("Error updating member:", error);
      showError("Failed to update member. Please try again.");
    }
    setLoading(false);
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Edit Member" />
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!memberId) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Edit Member" />
        <div className="text-center py-12 px-4">
          <span className="text-4xl">⚠️</span>
          <p className="text-gray-500 mt-2">No member ID provided</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-6 py-2 bg-[#F97316] text-white rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Edit Member" />

      <form onSubmit={handleSubmit} className="px-4 py-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          {/* Profile Image */}
          <div className="flex justify-center pb-2">
            <ProfileImageUpload
              currentImage={profileImage}
              onImageChange={(url) => setProfileImage(url)}
              memberId={memberId}
              size="lg"
              editable={true}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-white"
              value={formData.name}
              onChange={(e) => {
                const value = e.target.value;
                if (/^[a-zA-Z\s]*$/.test(value) || value === '') {
                  updateForm("name", value);
                }
              }}
              pattern="[a-zA-Z\s]+"
              title="Please enter a valid name (letters and spaces only)"
              required
              minLength="2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-white"
              value={formData.phone}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 10) {
                  updateForm("phone", value);
                }
              }}
              pattern="[0-9]{10}"
              maxLength="10"
              title="Please enter a valid 10-digit phone number"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Enter 10 digits only</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Email
            </label>
            <input
              type="email"
              className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-white"
              value={formData.email}
              onChange={(e) => updateForm("email", e.target.value.toLowerCase().trim())}
              title="Please enter a valid email address"
            />
          </div>

          {/* Self Plan Edit Access Toggle */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">✏️</span>
                <div>
                  <p className="font-medium text-gray-900">Self Plan Edit Access</p>
                  <p className="text-xs text-gray-600">Allow member to edit their workout/diet plans from the app</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateForm("selfPlanEditAccess", !formData.selfPlanEditAccess)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.selfPlanEditAccess ? "bg-[#f0813d]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.selfPlanEditAccess ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 active:scale-[0.98] transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
            className="flex-1 py-3.5 bg-gradient-to-r from-[#3B82F6] to-[#f0813d] text-white rounded-xl font-semibold disabled:opacity-50 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
