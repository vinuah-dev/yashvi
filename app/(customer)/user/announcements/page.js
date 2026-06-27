"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";

export default function CustomerAnnouncementsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [gymId, setGymId] = useState(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
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
        console.error("Error fetching member:", memberError);
        return;
      }

      setGymId(memberDetails.gym_id);

      // Fetch active announcements for the member's gym
      const { data: announcementsData, error: announcementsError } = await supabase
        .from("announcements")
        .select("*")
        .eq("gym_id", memberDetails.gym_id)
        .eq("status", "active")
        .order("announced_at", { ascending: false });

      if (announcementsError) {
        console.error("Error fetching announcements:", announcementsError);
        setAnnouncements([]);
        return;
      }

      console.log("Raw announcements data:", announcementsData);
      console.log("Announcements count:", announcementsData?.length || 0);

      // Show all active announcements (status='active' already filtered in query)
      // For now, show all active announcements regardless of expiry to debug
      // TODO: Re-enable expiry filtering after verifying dates are correct
      const activeAnnouncements = announcementsData || [];
      
      console.log("Active announcements to display:", activeAnnouncements);
      console.log("Active announcements count:", activeAnnouncements.length);
      
      // Set announcements
      setAnnouncements(activeAnnouncements);
    } catch (error) {
      console.error("Error in fetchAnnouncements:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Announcements" showBack={false} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f0813d]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Announcements" showBack={false} />

      <main className="px-4 py-4">
        {announcements.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center mt-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📢</span>
            </div>
            <p className="text-gray-700 font-medium mb-2">No Announcements</p>
            <p className="text-gray-500 text-sm">
              There are no active announcements at the moment. Check back later!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                onClick={() => router.push(`/user/announcements/${announcement.id}`)}
                className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-[#f0813d] to-[#f0813d] p-4 text-white">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">{announcement.title}</h3>
                      <p className="text-orange-100 text-xs">
                        {formatDate(announcement.announced_at)} • {formatTime(announcement.announced_at)}
                      </p>
                    </div>
                    <span className="text-2xl">📢</span>
                  </div>
                </div>

                {/* Content Preview */}
                <div className="p-4">
                  <p className="text-gray-700 text-sm line-clamp-3">
                    {announcement.message}
                  </p>
                  
                  {announcement.expires_at && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        Expires: {formatDate(announcement.expires_at)}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center text-[#f0813d] text-sm font-medium">
                    <span>Read more</span>
                    <span className="ml-2">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

