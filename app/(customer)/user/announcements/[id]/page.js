"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";

export default function AnnouncementDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncement();
  }, [params.id]);

  const fetchAnnouncement = async () => {
    try {
      setLoading(true);
      
      // Get logged-in member from localStorage
      const storedMember = localStorage.getItem("member");
      if (!storedMember) {
        router.push("/auth/login");
        return;
      }

      const member = JSON.parse(storedMember);

      // Fetch member details to get gym_id
      const { data: memberDetails, error: memberError } = await supabase
        .from("members")
        .select("gym_id")
        .eq("id", member.id)
        .single();

      if (memberError || !memberDetails) {
        router.push("/auth/login");
        return;
      }

      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("id", params.id)
        .eq("gym_id", memberDetails.gym_id)
        .single();

      if (error) throw error;
      setAnnouncement(data);
    } catch (error) {
      console.error("Error fetching announcement:", error);
      router.push("/user/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Not set";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Announcement" showBack={true} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f0813d]"></div>
        </div>
      </div>
    );
  }

  if (!announcement) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Announcement" showBack={true} />
        <div className="px-4 py-4 text-center">
          <p className="text-gray-500">Announcement not found</p>
          <button
            onClick={() => router.push("/user/dashboard")}
            className="mt-4 px-4 py-2 bg-[#f0813d] text-white rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Announcement" showBack={true} />

      <main className="px-4 py-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#f0813d] to-[#f0813d] p-5 text-white">
            <div className="flex items-start gap-3">
              <span className="text-3xl">📢</span>
              <div className="flex-1">
                <h1 className="text-xl font-bold mb-2">{announcement.title}</h1>
                <p className="text-orange-100 text-sm">
                  {formatDate(announcement.announced_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            <div className="prose max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {announcement.message}
              </p>
            </div>

            {/* Footer Info */}
            {announcement.expires_at && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  <span className="font-medium">Expires:</span>{" "}
                  {formatDate(announcement.expires_at)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={() => router.push("/user/dashboard")}
          className="w-full mt-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
        >
          Back to Home
        </button>
      </main>
    </div>
  );
}

