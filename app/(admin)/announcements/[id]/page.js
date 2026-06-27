"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
import Card from "@/components/shared/Card";

export default function AnnouncementDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedGym, setSelectedGym] = useState(null);

  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      const gym = JSON.parse(storedGym);
      setSelectedGym(gym);
      fetchAnnouncement();
    } else {
      setLoading(false);
    }
  }, [params.id]);

  const fetchAnnouncement = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) throw error;
      setAnnouncement(data);
    } catch (error) {
      console.error("Error fetching announcement:", error);
      alert("Failed to load announcement");
      router.push("/announcements");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Not set";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
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
        <div className="px-4 py-4">
          <Card padding="md" className="text-center py-12">
            <p className="text-gray-500">Announcement not found</p>
            <button
              onClick={() => router.push("/announcements")}
              className="mt-4 text-[#F97316] font-medium"
            >
              Back to Announcements
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Announcement Details" showBack={true} />

      <main className="px-4 py-4 space-y-4">
        <Card padding="md" className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  {announcement.title}
                </h2>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    announcement.status === "active"
                      ? "bg-orange-100 text-[#f0813d]"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {announcement.status}
                </span>
              </div>
              <p className="text-gray-600 whitespace-pre-wrap">
                {announcement.message}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Created:</span>
              <span className="font-medium text-gray-900">
                {formatDate(announcement.created_at)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Announced:</span>
              <span className="font-medium text-gray-900">
                {formatDate(announcement.announced_at)}
              </span>
            </div>
            {announcement.expires_at && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Expires:</span>
                <span className="font-medium text-gray-900">
                  {formatDate(announcement.expires_at)}
                </span>
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push(`/announcements/${announcement.id}/edit`)}
            className="py-3 bg-orange-50 text-[#f0813d] rounded-xl font-semibold hover:bg-orange-100 transition"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => router.push("/announcements")}
            className="py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
          >
            ← Back
          </button>
        </div>
      </main>
    </div>
  );
}

