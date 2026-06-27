"use client";

import { useAuthContext } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
import { useUserRole } from "@/lib/hooks/useUserRole";

export default function AnalyticsPage() {
  const { canViewFinance } = useUserRole();
  const [dateRange, setDateRange] = useState("month");
  const [activeSection, setActiveSection] = useState("overview");
  const [loading, setLoading] = useState(true);
  const { selectedGym } = useAuthContext();
  
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    retentionRate: 0,
    avgAttendance: 0
  });
  
  const [memberGrowth, setMemberGrowth] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [dropoffMembers, setDropoffMembers] = useState([]);
  const [planPopularity, setPlanPopularity] = useState([]);
  const [revenueData, setRevenueData] = useState([]);

  // Fetch analytics when gym is available or dateRange changes
  useEffect(() => {
    if (selectedGym?.id) {
      fetchAnalyticsData(selectedGym.id);
    } else {
      setLoading(false);
    }
  }, [selectedGym?.id, dateRange]);


  const fetchAnalyticsData = async (gymId) => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMemberStats(gymId),
        fetchMemberGrowth(gymId),
        fetchAttendanceData(gymId),
        fetchDropoffMembers(gymId),
        fetchPlanPopularity(gymId),
        fetchRevenueData(gymId)
      ]);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
    setLoading(false);
  };

  const fetchMemberStats = async (gymId) => {
    try {
      // Total members
      const { count: totalCount } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("gym_id", gymId);

      // Active members (with active memberships)
      const { data: activeMembers } = await supabase
        .from("memberships")
        .select("member_id")
        .eq("gym_id", gymId)
        .eq("status", "active")
        .gte("end_date", new Date().toISOString().split('T')[0]);

      const activeCount = activeMembers?.length || 0;

      // Avg attendance (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: attendanceRecords } = await supabase
        .from("attendance")
        .select("member_id")
        .eq("gym_id", gymId)
        .gte("check_in_date", thirtyDaysAgo.toISOString().split('T')[0]);

      const avgAttendance = activeCount > 0 
        ? ((attendanceRecords?.length || 0) / activeCount / 4.3).toFixed(1)
        : 0;

      setStats({
        totalMembers: totalCount || 0,
        activeMembers: activeCount,
        retentionRate: totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0,
        avgAttendance: parseFloat(avgAttendance)
      });
    } catch (error) {
      console.error("Error fetching member stats:", error);
    }
  };

  const fetchMemberGrowth = async (gymId) => {
    try {
      const daysToFetch = dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : dateRange === 'quarter' ? 90 : 365;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysToFetch);

      const { data } = await supabase
        .from("members")
        .select("created_at")
        .eq("gym_id", gymId)
        .gte("created_at", startDate.toISOString());

      // Group by day for week, by week for month/quarter/year
      const grouped = {};
      data?.forEach(member => {
        const date = new Date(member.created_at);
        let key;
        
        if (dateRange === 'week') {
          key = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
        } else {
          const weekNum = Math.floor((date - startDate) / (7 * 24 * 60 * 60 * 1000));
          key = `Week ${weekNum + 1}`;
        }
        
        grouped[key] = (grouped[key] || 0) + 1;
      });

      const growthData = Object.entries(grouped).map(([label, value]) => ({
        label,
        value
      }));

      setMemberGrowth(growthData);
    } catch (error) {
      console.error("Error fetching member growth:", error);
    }
  };

  const fetchAttendanceData = async (gymId) => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data } = await supabase
        .from("attendance")
        .select("check_in_date")
        .eq("gym_id", gymId)
        .gte("check_in_date", sevenDaysAgo.toISOString().split('T')[0]);

      // Group by day of week
      const grouped = {};
      data?.forEach(record => {
        const date = new Date(record.check_in_date);
        const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
        grouped[day] = (grouped[day] || 0) + 1;
      });

      const attendData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
        label: day,
        value: grouped[day] || 0
      }));

      setAttendanceData(attendData);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  const fetchDropoffMembers = async (gymId) => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get active members
      const { data: activeMembers } = await supabase
        .from("memberships")
        .select("member_id, members(id, full_name)")
        .eq("gym_id", gymId)
        .eq("status", "active")
        .gte("end_date", new Date().toISOString().split('T')[0]);

      if (!activeMembers) return;

      // Get their last attendance
      const dropoffs = [];
      for (const membership of activeMembers.slice(0, 10)) {
        const { data: lastAttendance } = await supabase
          .from("attendance")
          .select("check_in_date")
          .eq("member_id", membership.member_id)
          .order("check_in_date", { ascending: false })
          .limit(1);

        if (lastAttendance && lastAttendance.length > 0) {
          const daysMissed = Math.floor(
            (new Date() - new Date(lastAttendance[0].check_in_date)) / (1000 * 60 * 60 * 24)
          );

          if (daysMissed >= 7) {
            dropoffs.push({
              id: membership.member_id,
              name: membership.members.full_name,
              lastVisit: new Date(lastAttendance[0].check_in_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric"
              }),
              daysMissed,
              status: daysMissed >= 14 ? "critical" : "warning"
            });
          }
        }
      }

      setDropoffMembers(dropoffs.slice(0, 4));
    } catch (error) {
      console.error("Error fetching dropoff members:", error);
    }
  };

  const fetchPlanPopularity = async (gymId) => {
    try {
      // Get all membership plans
      const { data: plans } = await supabase
        .from("membership_plans")
        .select("id, name")
        .eq("gym_id", gymId)
        .eq("is_active", true);

      if (!plans) return;

      // Count active memberships for each plan
      const planStats = await Promise.all(
        plans.map(async (plan) => {
          const { count } = await supabase
            .from("memberships")
            .select("*", { count: "exact", head: true })
            .eq("plan_id", plan.id)
            .eq("status", "active");

          return {
            plan: plan.name,
            members: count || 0
          };
        })
      );

      const total = planStats.reduce((sum, p) => sum + p.members, 0);
      const colors = ["bg-[#f0813d]", "bg-[#f0813d]", "bg-[#f0813d]", "bg-[#f0813d]", "bg-[#f0813d]"];

      const formattedPlans = planStats
        .map((stat, index) => ({
          ...stat,
          percentage: total > 0 ? Math.round((stat.members / total) * 100) : 0,
          color: colors[index % colors.length]
        }))
        .filter(p => p.members > 0)
        .sort((a, b) => b.members - a.members);

      setPlanPopularity(formattedPlans);
    } catch (error) {
      console.error("Error fetching plan popularity:", error);
    }
  };

  const fetchRevenueData = async (gymId) => {
    try {
      const fourMonthsAgo = new Date();
      fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

      const { data: payments } = await supabase
        .from("payments")
        .select("amount, paid_at, created_at")
        .eq("gym_id", gymId)
        .eq("status", "paid")
        .or(`paid_at.gte.${fourMonthsAgo.toISOString()},and(paid_at.is.null,created_at.gte.${fourMonthsAgo.toISOString()})`);

      // Group by month
      const monthlyData = {};
      payments?.forEach(payment => {
        const date = new Date(payment.paid_at || payment.created_at);
        const monthKey = date.toLocaleDateString("en-US", { month: "short" });
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { revenue: 0, count: 0 };
        }
        
        monthlyData[monthKey].revenue += parseFloat(payment.amount);
        monthlyData[monthKey].count += 1;
      });

      const revenueArray = Object.entries(monthlyData).map(([month, data]) => ({
        month,
        revenue: Math.round(data.revenue),
        attendance: data.count
      }));

      setRevenueData(revenueArray.slice(-4));
    } catch (error) {
      console.error("Error fetching revenue data:", error);
    }
  };

  // Helper function to format currency with masking for trainers
  const formatRevenue = (amount) => {
    if (!canViewFinance) return '*****';
    return `₹${amount.toLocaleString()}`;
  };

  const maxAttendance = Math.max(...attendanceData.map((d) => d.value), 1);
  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue), 1);
  const maxMemberGrowth = Math.max(...memberGrowth.map((d) => d.value), 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Analytics Dashboard" />
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f0813d] mx-auto mb-4"></div>
              <p className="text-gray-600">Loading analytics data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedGym) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Analytics Dashboard" />
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-gray-600 mb-4">No gym selected</p>
              <p className="text-sm text-gray-500">Please select a gym from settings to view analytics</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Analytics" showBack={false} />

      <main className="px-4 py-4 space-y-4">
        {/* Date Range Filter */}
        <div className="flex gap-2">
          {["week", "month", "quarter", "year"].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                dateRange === range
                  ? "bg-black text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        {/* Section Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["overview", "members", "attendance", "revenue"].map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize whitespace-nowrap ${
                activeSection === section
                  ? "bg-black text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {section}
            </button>
          ))}
        </div>

        {/* Overview Section */}
        {activeSection === "overview" && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                title="Total Members"
                value={stats.totalMembers}
                icon="👥"
              />
              <MetricCard
                title="Active Members"
                value={stats.activeMembers}
                icon="✅"
              />
              <MetricCard
                title="Retention Rate"
                value={`${stats.retentionRate}%`}
                icon="🔄"
              />
              <MetricCard
                title="Avg. Visits/Week"
                value={stats.avgAttendance}
                icon="📅"
              />
            </div>

            {/* Plan Popularity */}
            {planPopularity.length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Plan Popularity
                </h3>
                <div className="space-y-3">
                  {planPopularity.map((plan) => (
                    <div key={plan.plan}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{plan.plan}</span>
                        <span className="font-medium">
                          {plan.members} members ({plan.percentage}%)
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${plan.color} rounded-full`}
                          style={{ width: `${plan.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Insights */}
            <div className="bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-xl p-4 text-white">
              <h3 className="font-semibold mb-3">💡 Quick Insights</h3>
              <ul className="space-y-2 text-sm text-orange-100">
                <li>• Total Members: {stats.totalMembers}</li>
                <li>• Active Members: {stats.activeMembers}</li>
                <li>• Retention Rate: {stats.retentionRate}%</li>
                <li>• {dropoffMembers.length} members need follow-up</li>
              </ul>
            </div>
          </>
        )}

        {/* Members Section */}
        {activeSection === "members" && (
          <>
            {/* Member Growth Chart */}
            {memberGrowth.length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Member Growth</h3>
                </div>
                <div className="flex items-end justify-between h-32 gap-2">
                  {memberGrowth.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-[#f0813d] rounded-t"
                        style={{
                          height: `${(day.value / maxMemberGrowth) * 100}%`,
                          minHeight: day.value > 0 ? "8px" : "0",
                        }}
                      ></div>
                      <span className="text-xs text-gray-500 mt-2">
                        {day.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-sm text-gray-500">New Members ({dateRange})</p>
                    <p className="text-xl font-bold text-gray-900">
                      {memberGrowth.reduce((sum, d) => sum + d.value, 0)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Drop-off Detection */}
            {dropoffMembers.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">
                    ⚠️ Drop-off Alert
                  </h3>
                  <span className="text-xs bg-orange-100 text-[#f0813d] px-2 py-1 rounded-full">
                    {dropoffMembers.length} members
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {dropoffMembers.map((member) => (
                    <div
                      key={member.id}
                      className="p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            member.status === "critical"
                              ? "bg-orange-100 text-[#f0813d]"
                              : "bg-orange-100 text-[#f0813d]"
                          }`}
                        >
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {member.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            Last: {member.lastVisit}
                          </p>
                        </div>
                      </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          member.status === "critical"
                            ? "text-[#f0813d]"
                            : "text-[#f0813d]"
                        }`}
                      >
                        {member.daysMissed} days
                      </p>
                      <p className="text-xs text-gray-500">missed</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
        )}

        {/* Attendance Section */}
        {activeSection === "attendance" && (
          <>
            {/* Attendance Chart */}
            {attendanceData.length > 0 ? (
              <>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    Weekly Attendance
                  </h3>
                  <div className="flex items-end justify-between h-40 gap-2">
                    {attendanceData.map((day, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <span className="text-xs font-medium text-gray-900 mb-1">
                          {day.value}
                        </span>
                        <div
                          className="w-full bg-[#f0813d] rounded-t"
                          style={{
                            height: `${(day.value / maxAttendance) * 100}%`,
                            minHeight: day.value > 0 ? "8px" : "0",
                          }}
                        ></div>
                        <span className="text-xs text-gray-500 mt-2">
                          {day.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Attendance Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-orange-50 rounded-xl p-4">
                    <p className="text-[#f0813d] text-sm">Avg Daily</p>
                    <p className="text-2xl font-bold text-[#f0813d]">
                      {Math.round(attendanceData.reduce((sum, d) => sum + d.value, 0) / attendanceData.length)}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-4">
                    <p className="text-[#f0813d] text-sm">Peak Day</p>
                    <p className="text-2xl font-bold text-[#f0813d]">
                      {attendanceData.reduce((max, d) => d.value > max.value ? d : max, attendanceData[0]).label}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                <p className="text-gray-500">No attendance data available</p>
              </div>
            )}

            {/* Peak Hours */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">Peak Hours</h3>
              <div className="space-y-3">
                {[
                  {
                    time: "6:00 AM - 8:00 AM",
                    percentage: 35,
                    label: "Morning Rush",
                  },
                  {
                    time: "5:00 PM - 7:00 PM",
                    percentage: 40,
                    label: "Evening Rush",
                  },
                  {
                    time: "8:00 AM - 12:00 PM",
                    percentage: 15,
                    label: "Mid Morning",
                  },
                  {
                    time: "12:00 PM - 5:00 PM",
                    percentage: 10,
                    label: "Afternoon",
                  },
                ].map((slot, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{slot.time}</span>
                      <span className="font-medium">{slot.percentage}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#f0813d] rounded-full"
                        style={{ width: `${slot.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Consistency Score */}
            <div className="bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-xl p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Consistency Score</p>
                  <p className="text-3xl font-bold">78%</p>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center">
                  <span className="text-2xl">📊</span>
                </div>
              </div>
              <p className="text-sm text-orange-100 mt-2">
                78% of active members visit 3+ times per week
              </p>
            </div>
          </>
        )}

        {/* Revenue Section */}
        {activeSection === "revenue" && (
          <>
            {/* Revenue Chart */}
            {revenueData.length > 0 ? (
              <>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    Monthly Revenue
                  </h3>
                  <div className="space-y-4">
                    {revenueData.map((month, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{month.month}</span>
                          <span className="font-medium text-gray-900">
                            {formatRevenue(month.revenue)}
                          </span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#f0813d] to-[#f0813d] rounded-full"
                            style={{
                              width: canViewFinance ? `${(month.revenue / maxRevenue) * 100}%` : '0%',
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Revenue Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-orange-50 rounded-xl p-4">
                    <p className="text-[#f0813d] text-sm">Total Revenue</p>
                    <p className="text-2xl font-bold text-[#f0813d]">
                      {formatRevenue(revenueData.reduce((sum, d) => sum + d.revenue, 0))}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-4">
                    <p className="text-[#f0813d] text-sm">Avg Monthly</p>
                    <p className="text-2xl font-bold text-[#f0813d]">
                      {formatRevenue(Math.round(revenueData.reduce((sum, d) => sum + d.revenue, 0) / revenueData.length))}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                <p className="text-gray-500">No revenue data available</p>
              </div>
            )}
          </>
        )}

        {/* Download Report Button */}
        <button className="w-full py-3 bg-black text-white rounded-xl font-medium flex items-center justify-center gap-2">
          <span>📥</span>
          Download Report
        </button>
      </main>
    </div>
  );
}

// Metric Card Component
function MetricCard({ title, value, icon }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{title}</p>
    </div>
  );
}
