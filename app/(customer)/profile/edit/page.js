"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import ProfileImageUpload from "@/components/shared/ProfileImageUpload";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/contexts/ToastContext";

export default function EditProfilePage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [memberId, setMemberId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    profileImage: null,
  });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const storedMember = localStorage.getItem("member");
      if (!storedMember) {
        router.push("/auth/login");
        return;
      }

      const member = JSON.parse(storedMember);
      setMemberId(member.id);

      const { data: memberData, error } = await supabase
        .from("members")
        .select("id, full_name, phone, email, profile_image")
        .eq("id", member.id)
        .single();

      if (error) throw error;

      setFormData({
        name: memberData.full_name || "",
        email: memberData.email || "",
        phone: memberData.phone || "",
        profileImage: memberData.profile_image || null,
      });
    } catch (err) {
      console.error("Error fetching profile:", err);
      showError("Failed to load profile");
    } finally {
      setFetching(false);
    }
  };

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (newImageUrl) => {
    setFormData((prev) => ({ ...prev, profileImage: newImageUrl }));
    // Update localStorage as well
    const storedMember = localStorage.getItem("member");
    if (storedMember) {
      const member = JSON.parse(storedMember);
      member.profile_image = newImageUrl;
      localStorage.setItem("member", JSON.stringify(member));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("members")
        .update({
          full_name: formData.name,
          email: formData.email || null,
        })
        .eq("id", memberId);

      if (error) throw error;

      // Update localStorage
      const storedMember = localStorage.getItem("member");
      if (storedMember) {
        const member = JSON.parse(storedMember);
        member.full_name = formData.name;
        member.email = formData.email;
        localStorage.setItem("member", JSON.stringify(member));
      }

      showSuccess("Profile updated successfully!");
      router.back();
    } catch (err) {
      console.error("Error updating profile:", err);
      showError("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-[#1a1c1c] text-white pb-24">
        <Header title="Edit Profile" />
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#f0813d] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1c1c] text-white pb-24 animate-fadeIn font-sans selection:bg-[#f0813d] selection:text-black">
      <Header title="Edit Profile" />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {/* Profile Photo */}
        <div className="rounded-3xl border border-white/6 bg-[#2d2926] p-6 shadow-lg flex flex-col items-center">
          <ProfileImageUpload
            currentImage={formData.profileImage}
            onImageChange={handleImageChange}
            memberId={memberId}
            size="lg"
            editable={true}
          />
        </div>

        {/* Form Fields */}
        <div className="rounded-3xl border border-white/6 bg-[#2d2926] p-4 shadow-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 border border-white/8 bg-zinc-950/50 text-white placeholder-zinc-500 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d]"
              value={formData.name}
              onChange={(e) => updateForm("name", e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              className="w-full px-4 py-3 border border-white/8 rounded-xl outline-none bg-zinc-950/40 text-zinc-500"
              value={formData.phone}
              disabled
            />
            <p className="text-xs text-zinc-500 mt-1">
              Contact admin to change phone number
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Email
            </label>
            <input
              type="email"
              className="w-full px-4 py-3 border border-white/8 bg-zinc-950/50 text-white placeholder-zinc-500 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d]"
              value={formData.email}
              onChange={(e) => updateForm("email", e.target.value)}
              placeholder="Enter your email"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 bg-white/5 text-zinc-300 rounded-xl font-medium border border-white/8 active:scale-95 transition-transform"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-xl font-medium disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
