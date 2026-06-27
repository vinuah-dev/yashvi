"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";

export default function EditAnnouncementPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [selectedGym, setSelectedGym] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    status: "active",
    expires_at: "",
  });

  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      const gym = JSON.parse(storedGym);
      setSelectedGym(gym);
      fetchAnnouncement();
    } else {
      router.push("/admin/dashboard");
    }
  }, [params.id, router]);

  const fetchAnnouncement = async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          title: data.title || "",
          message: data.message || "",
          status: data.status || "active",
          // Convert UTC from DB to local time for datetime-local input
          expires_at: data.expires_at
            ? (() => {
                const d = new Date(data.expires_at);
                return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                  .toISOString()
                  .slice(0, 16);
              })()
            : "",
        });
      }
    } catch (error) {
      console.error("Error fetching announcement:", error);
      alert("Failed to load announcement");
      router.push("/announcements");
    } finally {
      setFetching(false);
    }
  };

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.message.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      // Get current user for updated_by
      const storedUser = localStorage.getItem("gymUser");
      const user = storedUser ? JSON.parse(storedUser) : null;

      // Convert local datetime-local value to proper UTC ISO string
      const expiresAtUtc = formData.expires_at
        ? new Date(formData.expires_at).toISOString()
        : null;

      const { error } = await supabase
        .from("announcements")
        .update({
          title: formData.title.trim(),
          message: formData.message.trim(),
          status: formData.status,
          expires_at: expiresAtUtc,
          updated_by: user?.id || null,
        })
        .eq("id", params.id);

      if (error) throw error;

      alert("Announcement updated successfully!");
      router.push(`/announcements/${params.id}`);
    } catch (error) {
      console.error("Error updating announcement:", error);
      alert("Failed to update announcement. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Edit Announcement" showBack={true} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f0813d]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Edit Announcement" showBack={true} />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {/* Title */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <label className="block text-sm font-semibold text-gray-800">
            Title *
          </label>
          <input
            type="text"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none transition-all duration-200 text-gray-900"
            placeholder="Enter announcement title"
            value={formData.title}
            onChange={(e) => updateForm("title", e.target.value)}
            required
            maxLength={255}
          />
        </div>

        {/* Message */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <label className="block text-sm font-semibold text-gray-800">
            Message *
          </label>
          <textarea
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none transition-all duration-200 text-gray-900 resize-none"
            rows={6}
            placeholder="Enter announcement message"
            value={formData.message}
            onChange={(e) => updateForm("message", e.target.value)}
            required
          />
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <label className="block text-sm font-semibold text-gray-800">
            Status *
          </label>
          <select
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none transition-all duration-200 text-gray-900"
            value={formData.status}
            onChange={(e) => updateForm("status", e.target.value)}
            required
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Expiry Date */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <label className="block text-sm font-semibold text-gray-800">
            Expiry Date (Optional)
          </label>
          <input
            type="datetime-local"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none transition-all duration-200 text-gray-900"
            value={formData.expires_at}
            onChange={(e) => updateForm("expires_at", e.target.value)}
          />
          <p className="text-xs text-gray-500">
            Leave empty if announcement should not expire
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#F97316] text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {loading ? "Updating..." : "Update Announcement"}
        </button>
      </form>
    </div>
  );
}

