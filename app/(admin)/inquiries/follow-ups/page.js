"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
import {
  Phone,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
  MessageSquare,
  UserPlus,
} from "lucide-react";

const STATUS_CONFIG = {
  new: { label: "New", color: "bg-orange-100 text-[#f0813d]" },
  contacted: { label: "Contacted", color: "bg-orange-100 text-[#f0813d]" },
  follow_up: { label: "Follow-Up", color: "bg-orange-100 text-[#f0813d]" },
  joined: { label: "Joined", color: "bg-orange-100 text-[#f0813d]" },
  not_interested: { label: "Not Interested", color: "bg-gray-100 text-gray-600" },
};

export default function FollowUpCallsPage() {
  const router = useRouter();
  const [selectedGym, setSelectedGym] = useState(null);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [showOverdue, setShowOverdue] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      setSelectedGym(JSON.parse(storedGym));
    } else {
      router.push("/admin/dashboard");
    }
  }, [router]);

  const fetchFollowUps = useCallback(async () => {
    if (!selectedGym) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      // Fetch overdue count (always)
      const { count: oCount } = await supabase
        .from("inquiries")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", selectedGym.id)
        .lt("follow_up_date", today)
        .not("status", "in", '("joined","not_interested")');

      setOverdueCount(oCount || 0);

      // Build query based on mode
      let query = supabase
        .from("inquiries")
        .select("*")
        .eq("gym_id", selectedGym.id)
        .not("status", "in", '("joined","not_interested")')
        .order("follow_up_date", { ascending: true });

      if (showOverdue) {
        query = query.lt("follow_up_date", today);
      } else {
        query = query.eq("follow_up_date", selectedDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInquiries(data || []);
    } catch (error) {
      console.error("Error fetching follow-ups:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedGym, selectedDate, showOverdue]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  const changeDate = (direction) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + direction);
    setSelectedDate(d.toISOString().split("T")[0]);
    setShowOverdue(false);
  };

  const quickAction = async (id, action) => {
    setActionLoading(id);
    try {
      const updates = {};
      if (action === "contacted") {
        updates.status = "contacted";
      } else if (action === "joined") {
        updates.status = "joined";
      } else if (action === "not_interested") {
        updates.status = "not_interested";
      } else if (action === "reschedule") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        updates.follow_up_date = tomorrow.toISOString().split("T")[0];
        updates.status = "follow_up";
      }
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase.from("inquiries").update(updates).eq("id", id);
      if (error) throw error;
      fetchFollowUps();
    } catch (error) {
      console.error("Error updating inquiry:", error);
      alert("Failed to update. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const isToday = selectedDate === today;
  const displayDate = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Follow-Up Calls" />

      <div className="px-4 py-4 space-y-4">
        {/* Date Navigation */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <p className={`font-semibold ${isToday && !showOverdue ? "text-[#f0813d]" : "text-gray-800"}`}>
                {showOverdue ? "All Overdue" : displayDate}
              </p>
              {isToday && !showOverdue && <p className="text-xs text-gray-500">Today</p>}
            </div>
            <button
              onClick={() => changeDate(1)}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Quick Date Buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => { setSelectedDate(today); setShowOverdue(false); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                isToday && !showOverdue ? "bg-[#f0813d] text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                const tmr = new Date();
                tmr.setDate(tmr.getDate() + 1);
                setSelectedDate(tmr.toISOString().split("T")[0]);
                setShowOverdue(false);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                selectedDate === (() => { const t = new Date(); t.setDate(t.getDate() + 1); return t.toISOString().split("T")[0]; })() && !showOverdue
                  ? "bg-[#f0813d] text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              Tomorrow
            </button>
            {overdueCount > 0 && (
              <button
                onClick={() => setShowOverdue(true)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                  showOverdue ? "bg-[#f0813d] text-white" : "bg-orange-50 text-[#f0813d]"
                }`}
              >
                Overdue ({overdueCount})
              </button>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-gray-600 font-medium">
            {loading ? "Loading..." : `${inquiries.length} follow-up${inquiries.length !== 1 ? "s" : ""}`}
          </p>
          <button
            onClick={() => router.push("/inquiries")}
            className="text-sm text-[#f0813d] font-medium"
          >
            All Inquiries →
          </button>
        </div>

        {/* Follow-Up List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
                <div className="flex gap-2">
                  <div className="h-8 bg-gray-200 rounded w-20"></div>
                  <div className="h-8 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : inquiries.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">
              {showOverdue ? "No overdue follow-ups!" : "No follow-ups scheduled for this date"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {showOverdue ? "You're all caught up" : "Try selecting a different date"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {inquiries.map((inq) => {
              const isOverdue = inq.follow_up_date < today;
              const statusConf = STATUS_CONFIG[inq.status] || STATUS_CONFIG.new;

              return (
                <div
                  key={inq.id}
                  className={`bg-white rounded-xl p-4 shadow-sm ${
                    isOverdue ? "border-l-4 border-[#f0813d]" : ""
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                        <User size={18} className="text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{inq.full_name}</p>
                        <a
                          href={`tel:${inq.phone}`}
                          className="text-xs text-[#f0813d] flex items-center gap-1"
                        >
                          <Phone size={11} />
                          {inq.phone}
                        </a>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConf.color}`}>
                      {statusConf.label}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                    {inq.interested_plan && (
                      <span className="flex items-center gap-1">
                        <MessageSquare size={12} /> {inq.interested_plan}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> Visited: {new Date(inq.visit_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                    {isOverdue && (
                      <span className="flex items-center gap-1 text-[#f0813d] font-medium">
                        <AlertTriangle size={12} /> Overdue
                      </span>
                    )}
                  </div>

                  {inq.notes && (
                    <p className="text-xs text-gray-500 italic mb-3 line-clamp-2">"{inq.notes}"</p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`tel:${inq.phone}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-[#f0813d] rounded-lg text-xs font-medium hover:bg-orange-100 transition"
                    >
                      <Phone size={13} /> Call
                    </a>
                    <button
                      onClick={() => quickAction(inq.id, "contacted")}
                      disabled={actionLoading === inq.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-[#f0813d] rounded-lg text-xs font-medium hover:bg-orange-100 transition disabled:opacity-50"
                    >
                      <CheckCircle size={13} /> Contacted
                    </button>
                    <button
                      onClick={() => quickAction(inq.id, "reschedule")}
                      disabled={actionLoading === inq.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-[#f0813d] rounded-lg text-xs font-medium hover:bg-orange-100 transition disabled:opacity-50"
                    >
                      <Clock size={13} /> Reschedule
                    </button>
                    <button
                      onClick={() => quickAction(inq.id, "joined")}
                      disabled={actionLoading === inq.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-[#f0813d] rounded-lg text-xs font-medium hover:bg-orange-100 transition disabled:opacity-50"
                    >
                      <UserPlus size={13} /> Joined
                    </button>
                    <button
                      onClick={() => router.push(`/inquiries/${inq.id}/edit`)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
