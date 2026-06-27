"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  MessageCircle,
  Calendar,
  AlertTriangle,
  UserX,
  UserPlus,
  ChevronRight,
  Send,
  Clock,
  TrendingDown,
  Cake,
} from "lucide-react";

// ══════════════════════════════════════════════════════════════
// Quick Messaging Dashboard Widget
// Shows messaging stats and quick actions on admin dashboard
// ══════════════════════════════════════════════════════════════
export default function MessagingDashboard({ gymId }) {
  const router = useRouter();
  const [stats, setStats] = useState({
    expiry_3_days: 0,
    expiry_7_days: 0,
    inactive_members: 0,
    no_visit_7_days: 0,
    new_joins_today: 0,
    new_joins_7_days: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      // Try RPC function first
      const { data, error } = await supabase.rpc("get_messaging_dashboard_stats", {
        p_gym_id: gymId,
      });

      if (error) throw error;
      if (data) {
        setStats(data);
      }
    } catch (err) {
      console.error("Error fetching messaging stats:", err);
      // Fallback to manual queries
      try {
        const today = new Date().toISOString().split("T")[0];
        const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        // Fetch expiring memberships in 3 days
        const { count: expiry3 } = await supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gte("end_date", today)
          .lte("end_date", threeDaysLater);

        // Fetch expiring memberships in 7 days
        const { count: expiry7 } = await supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gte("end_date", today)
          .lte("end_date", sevenDaysLater);

        // Fetch inactive members (no active membership)
        const { data: membersData } = await supabase
          .from("members")
          .select("id, memberships(status)")
          .eq("gym_id", gymId);

        const inactiveCount = (membersData || []).filter(
          (m) => !m.memberships?.some((ms) => ms.status === "active")
        ).length;

        // New joins today
        const { count: newToday } = await supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("gym_id", gymId)
          .eq("join_date", today);

        setStats({
          expiry_3_days: expiry3 || 0,
          expiry_7_days: expiry7 || 0,
          inactive_members: inactiveCount || 0,
          no_visit_7_days: 0,
          new_joins_today: newToday || 0,
          new_joins_7_days: 0,
        });
      } catch (fallbackErr) {
        console.error("Fallback stats fetch failed:", fallbackErr);
      }
    }
    setLoading(false);
  }, [gymId]);

  useEffect(() => {
    if (!gymId) return;
    fetchStats();
  }, [gymId, fetchStats]);

  // Navigate to messaging page with a pre-selected filter
  const handleQuickMessage = (filter) => {
    router.push(`/messaging?filter=${filter}`);
  };

  const quickStats = [
    {
      id: "expiry_3_days",
      label: "Expiring in 3 Days",
      value: stats.expiry_3_days,
      icon: AlertTriangle,
      color: "red",
      bgColor: "bg-orange-50",
      textColor: "text-[#f0813d]",
      iconBg: "bg-orange-100",
      filter: "expiry_3_days",
      urgent: true,
    },
    {
      id: "expiry_7_days",
      label: "Expiring in 7 Days",
      value: stats.expiry_7_days,
      icon: Clock,
      color: "orange",
      bgColor: "bg-orange-50",
      textColor: "text-[#f0813d]",
      iconBg: "bg-orange-100",
      filter: "expiry_7_days",
    },
    {
      id: "inactive_members",
      label: "Inactive Members",
      value: stats.inactive_members,
      icon: UserX,
      color: "gray",
      bgColor: "bg-gray-50",
      textColor: "text-gray-600",
      iconBg: "bg-gray-100",
      filter: "inactive",
    },
    {
      id: "new_joins",
      label: "New Joins Today",
      value: stats.new_joins_today,
      icon: UserPlus,
      color: "green",
      bgColor: "bg-orange-50",
      textColor: "text-[#f0813d]",
      iconBg: "bg-orange-100",
      filter: "joined_7_days",
    },
  ];

  return (
    <div className="bg-white rounded-xl p-4 mx-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-[#f0813d] to-[#9c4400] rounded-lg flex items-center justify-center shadow-[0_8px_18px_rgba(240,129,61,0.22)]">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Quick Messaging</h3>
            <p className="text-xs text-gray-500">Send WhatsApp messages</p>
          </div>
        </div>
        <button
          onClick={() => router.push("/messaging")}
          className="text-xs text-[#f0813d] font-medium flex items-center gap-1 active:text-[#f0813d]"
        >
          View all
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {quickStats.map((stat) => {
            const Icon = stat.icon;
            const hasItems = stat.value > 0;

            return (
              <button
                key={stat.id}
                onClick={() => hasItems && handleQuickMessage(stat.filter)}
                disabled={!hasItems}
                className={`relative p-3 rounded-xl text-left transition ${
                  stat.bgColor
                } ${hasItems ? "active:scale-98" : "opacity-60"}`}
              >
                {/* Urgent Badge */}
                {stat.urgent && stat.value > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#f0813d] rounded-full animate-pulse" />
                )}

                <div className={`w-8 h-8 ${stat.iconBg} rounded-lg flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 ${stat.textColor}`} />
                </div>

                <div className={`text-xl font-bold ${stat.textColor}`}>{stat.value}</div>
                <div className="text-xs text-gray-600 truncate">{stat.label}</div>

                {/* Send indicator */}
                {hasItems && (
                  <div className="absolute bottom-2 right-2 opacity-50">
                    <Send className="w-3 h-3 text-gray-400" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Quick Send Button */}
      <button
        onClick={() => router.push("/messaging")}
        className="w-full mt-3 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:from-[#f0813d] active:to-[#f0813d] transition"
      >
        <MessageCircle className="w-4 h-4" />
        Open Messaging Center
      </button>
    </div>
  );
}
