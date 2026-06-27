"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";

export default function AddAnnouncementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedGym, setSelectedGym] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    expires_at: "",
  });

  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      const gym = JSON.parse(storedGym);
      setSelectedGym(gym);
    } else {
      router.push("/admin/dashboard");
    }
  }, [router]);

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getAppUsersCount = async (gymId) => {
    try {
      // Get count of members with credentials (app users) for this gym
      const { data: membersWithCredentials, error: membersError } = await supabase
        .from("member_credentials")
        .select(`
          member_id,
          members!inner (
            id,
            gym_id
          )
        `)
        .eq("members.gym_id", gymId);

      if (membersError) {
        console.error("Error fetching app users:", membersError);
        return 0;
      }

      // Count unique members with app access
      const appUsersCount = membersWithCredentials?.filter(
        (cred) => cred.members?.gym_id === gymId
      ).length || 0;

      return appUsersCount;
    } catch (error) {
      console.error("Error counting app users:", error);
      return 0;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedGym) return;

    if (!formData.title.trim() || !formData.message.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      // Get current user for created_by
      const storedUser = localStorage.getItem("gymUser");
      const user = storedUser ? JSON.parse(storedUser) : null;

      // Convert local datetime-local value to proper UTC ISO string
      // datetime-local gives "2026-02-16T22:29" which has no timezone;
      // new Date() parses it as local time, toISOString() converts to UTC.
      const expiresAtUtc = formData.expires_at
        ? new Date(formData.expires_at).toISOString()
        : null;

      // Create announcement
      const { data: announcement, error } = await supabase
        .from("announcements")
        .insert({
          gym_id: selectedGym.id,
          title: formData.title.trim(),
          message: formData.message.trim(),
          status: "active",
          expires_at: expiresAtUtc,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Get count of app users who will see this announcement
      const appUsersCount = await getAppUsersCount(selectedGym.id);

      // Send push notification to all members with app access
      if (appUsersCount > 0) {
        try {
          // Get all member IDs for this gym (members use their own ID, not a user_id field)
          const { data: members, error: membersError } = await supabase
            .from("members")
            .select("id")
            .eq("gym_id", selectedGym.id);

          console.log('📢 Announcement members query result:', members?.length || 0, 'members', 'error:', membersError?.message);
          if (members && members.length > 0) {
            console.log('📋 Member IDs:', members.map(m => m.id));
          }

          if (!membersError && members && members.length > 0) {
            const memberIds = members.map(m => m.id);

            console.log('🚀 Sending announcement to', memberIds.length, 'members');
            // Send notification via API
            const notifResponse = await fetch('/api/notifications/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': String(JSON.parse(localStorage.getItem("gymUser") || "{}")?.id || ""),
              },
              body: JSON.stringify({
                userIds: memberIds,
                notification: {
                  title: `📢 ${formData.title.trim()}`,
                  body: formData.message.trim().substring(0, 100) + (formData.message.length > 100 ? '...' : ''),
                  type: 'announcement',
                  url: '/announcements',
                  data: {
                    announcement_id: announcement.id,
                    gym_id: selectedGym.id
                  }
                }
              })
            });
            const notifJson = await notifResponse.json();
            console.log('✅ Notification API response:', notifJson);
          }
        } catch (notifError) {
          console.error('Error sending notifications:', notifError);
          // Don't fail the announcement creation if notification fails
        }
      }
      
      if (appUsersCount > 0) {
        alert(
          `Announcement created successfully! Push notifications sent to ${appUsersCount} app users.`
        );
      } else {
        alert("Announcement created successfully!");
      }

      router.push("/announcements");
      router.refresh();
    } catch (error) {
      console.error("Error creating announcement:", error);
      alert("Failed to create announcement. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="New Announcement" showBack={true} />

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

        {/* Info Note */}
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
          <div className="flex items-start gap-3">
            <span className="text-xl">📢</span>
            <div>
              <p className="text-sm font-medium text-orange-900">
                Instant Push Notifications
              </p>
              <p className="text-xs text-[#f0813d] mt-1">
                This announcement will be sent as a push notification to all registered app users immediately.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-orange-800 cursor-pointer text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {loading ? "Creating..." : "Create Announcement"}
        </button>
      </form>
    </div>
  );
}

