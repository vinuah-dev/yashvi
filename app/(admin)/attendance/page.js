"use client";

import { useAuthContext } from "@/contexts/AuthContext";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
import { DateBandInput } from "@/components/shared/EngagingFormControls";
import { AttendancePageSkeleton } from "@/components/shared/Skeleton";
import { 
  Search, 
  User, 
  Clock, 
  Calendar, 
  CheckCircle, 
  XCircle,
  Filter,
  ChevronRight,
  Plus,
  X,
  Users,
  BarChart3,
  History
} from "lucide-react";

const toLocalDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function AttendancePage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(
    toLocalDateInputValue(new Date())
  );
  const [activeTab, setActiveTab] = useState("today");
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { selectedGym } = useAuthContext();
  const [historyData, setHistoryData] = useState([]);
  const [searchModalQuery, setSearchModalQuery] = useState("");
  const [rawAttendance, setRawAttendance] = useState([]);
  const [rawMembers, setRawMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const getRelativeDateLabel = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(`${dateString}T00:00:00`);
    const difference = Math.round((selected - today) / (1000 * 60 * 60 * 24));

    if (difference === 0) return "Today";
    if (difference === -1) return "Yesterday";
    if (difference === 1) return "Tomorrow";
    if (difference < 0) return `${Math.abs(difference)} days ago`;
    return `In ${difference} days`;
  };

  const formattedSelectedDate = new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  // Fetch attendance data directly from Supabase
  const fetchAttendance = async (gymId, date) => {
    if (!gymId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          id,
          member_id,
          check_in_date,
          check_in_time,
          check_out_time,
          membership_status,
          members (
            id,
            full_name,
            phone
          )
        `)
        .eq("gym_id", gymId)
        .eq("check_in_date", date)
        .order("check_in_time", { ascending: false });

      if (error) {
        console.error("Error fetching attendance:", error);
        setRawAttendance([]);
      } else {
        setRawAttendance(data || []);
      }
    } catch (err) {
      console.error("Error:", err);
      setRawAttendance([]);
    }
    setLoading(false);
  };

  // Fetch members data directly from Supabase
  const fetchMembers = async (gymId) => {
    if (!gymId) return;
    try {
      const { data, error } = await supabase
        .from("members")
        .select(`
          id,
          full_name,
          phone,
          memberships (
            id,
            status,
            membership_plans (
              name
            )
          )
        `)
        .eq("gym_id", gymId)
        .order("full_name", { ascending: true });

      if (error) {
        console.error("Error fetching members:", error);
        setRawMembers([]);
      } else {
        setRawMembers(data || []);
      }
    } catch (err) {
      console.error("Error:", err);
      setRawMembers([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadAttendanceData = async () => {
      if (!selectedGym?.id || cancelled) return;
      await fetchAttendance(selectedGym.id, selectedDate);
      if (cancelled) return;
      await fetchMembers(selectedGym.id);
    };

    loadAttendanceData();

    return () => {
      cancelled = true;
    };
  }, [selectedGym?.id, selectedDate]);

  // Transform attendance data
  const attendance = useMemo(() => {
    if (!rawAttendance?.length) return [];
    
    return rawAttendance.map((record) => ({
      id: record.id,
      memberId: record.member_id,
      name: record.members?.full_name || "Unknown",
      checkIn: new Date(`1970-01-01T${record.check_in_time}`).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      checkOut: record.check_out_time
        ? new Date(`1970-01-01T${record.check_out_time}`).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
      status: record.check_out_time ? "checked-out" : "checked-in",
      membershipStatus: record.membership_status || "ACTIVE",
    }));
  }, [rawAttendance]);

  // Transform members data for the modal
  const members = useMemo(() => {
    if (!rawMembers?.length) return [];
    
    return rawMembers.map((member) => {
      const activeMembership = member.memberships?.find(m => m.status === "active");
      return {
        id: member.id,
        name: member.full_name || "Unnamed Member",
        phone: member.phone || "No Phone",
        plan: activeMembership?.membership_plans?.name || "No Plan",
      };
    });
  }, [rawMembers]);

  async function fetchHistoryData(gymId) {
    try {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return toLocalDateInputValue(date);
      });

      const historyPromises = last7Days.map(async (date) => {
        const { data, error } = await supabase
          .from("attendance")
          .select("id, check_in_time")
          .eq("gym_id", gymId)
          .eq("check_in_date", date);

        if (error) return null;

        const hours = data?.map(record => {
          const hour = new Date(`1970-01-01T${record.check_in_time}`).getHours();
          return hour;
        }) || [];

        const hourCounts = {};
        hours.forEach(hour => {
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        const peakHour = Object.keys(hourCounts).reduce((a, b) => 
          hourCounts[a] > hourCounts[b] ? a : b, null);

        const peakTime = peakHour ? `${peakHour}:00-${parseInt(peakHour) + 2}:00` : "N/A";

        return {
          date: new Date(date).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
          }),
          fullDate: new Date(date).toLocaleDateString("en-IN", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          count: data?.length || 0,
          peakTime: peakTime,
          rawDate: date,
        };
      });

      const historyResults = await Promise.all(historyPromises);
      setHistoryData(historyResults.filter(Boolean));
    } catch (err) {
      console.error("Error fetching history:", err);
      setHistoryData([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const loadHistoryData = async () => {
      if (selectedGym?.id) {
        await fetchHistoryData(selectedGym.id);
      } else if (!cancelled) {
        setLoading(false);
      }
    };

    loadHistoryData();

    return () => {
      cancelled = true;
    };
  }, [selectedGym?.id]);

  const todayStats = {
    total: attendance.length,
    checkedIn: attendance.filter((a) => a.status === "checked-in").length,
    checkedOut: attendance.filter((a) => a.status === "checked-out").length,
    expired: attendance.filter((a) => a.membershipStatus === "EXPIRED").length,
  };

  // Filter attendance by search query
  const filteredAttendance = useMemo(() => {
    if (!searchQuery) return attendance;
    return attendance.filter(record =>
      record.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.memberId?.toString().includes(searchQuery)
    );
  }, [attendance, searchQuery]);

  const handleCheckOut = async (id, memberId) => {
    try {
      const currentTime = new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      const { error } = await supabase
        .from("attendance")
        .update({ check_out_time: currentTime })
        .eq("id", id);

      if (error) {
        console.error("Error checking out:", error);
        alert("Failed to check out. Please try again.");
        return;
      }

      // Refresh attendance data
      fetchAttendance(selectedGym.id, selectedDate);
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to check out. Please try again.");
    }
  };

  const handleMarkAttendance = async (member) => {
    if (!selectedGym) return;

    try {
      const currentTime = new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      const { data: newRecord, error } = await supabase
        .from("attendance")
        .insert({
          gym_id: selectedGym.id,
          member_id: member.id,
          check_in_date: selectedDate,
          check_in_time: currentTime,
          count: 1,
        })
        .select(`
          id,
          member_id,
          check_in_time,
          check_out_time,
          members (
            id,
            full_name,
            phone
          )
        `)
        .single();

      if (error) {
        console.error("Error marking attendance:", error);
        if (error.code === "23505") {
          alert("Member already checked in today!");
        } else {
          alert("Failed to mark attendance. Please try again.");
        }
        return;
      }

      // Refresh attendance data
      fetchAttendance(selectedGym.id, selectedDate);
      setShowMarkModal(false);
      setSearchModalQuery("");
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to mark attendance. Please try again.");
    }
  };

  if (loading) {
    return <AttendancePageSkeleton />;
  }

  if (!selectedGym) {
    return (
      <div className="min-h-screen bg-[#f6f3f1] text-[#1a1c1c] safe-area-inset-bottom">
        <Header title="Attendance" showBack={false} />
        <main className="px-4 py-4">
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-[#f0813d] to-[#9c4400] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">No Gym Selected</h2>
            <p className="text-gray-500 text-sm mb-6 px-4">
              Please select a gym to view and manage attendance
            </p>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="px-6 py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform"
              style={{ minHeight: '44px' }}
            >
              Go to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
      <Header title="Attendance" showBack={false} />

      <main className="px-3 md:px-8 lg:px-12 py-3 md:py-6 space-y-4 max-w-7xl mx-auto w-full">
        {/* Date Selector - Premium Calendar Band */}
        <section className="mx-1 overflow-hidden rounded-[1.75rem] border border-[#f0813d]/30 bg-white shadow-[0_18px_45px_rgba(26,28,28,0.08)]">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#f0813d] to-[#9c4400] p-4 text-white">
            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-white/25 blur-2xl" />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/80">
                  Attendance calendar
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  {getRelativeDateLabel(selectedDate)}
                </h2>
                <p className="mt-1 text-xs font-bold text-white/75">
                  {formattedSelectedDate}
                </p>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15">
                <Calendar className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="relative mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/15 p-3">
                <p className="text-[9px] font-black uppercase tracking-wide text-white/70">Records</p>
                <p className="mt-1 text-lg font-black">{todayStats.total}</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-3">
                <p className="text-[9px] font-black uppercase tracking-wide text-white/70">Active</p>
                <p className="mt-1 text-lg font-black text-white">{todayStats.checkedIn}</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-3">
                <p className="text-[9px] font-black uppercase tracking-wide text-white/70">Closed</p>
                <p className="mt-1 text-lg font-black">{todayStats.checkedOut}</p>
              </div>
            </div>
          </div>
          <div className="p-4">
            <DateBandInput
              label="Select Attendance Date"
              value={selectedDate}
              helper="Use the arrows, presets, or exact date picker to review attendance."
              onChange={setSelectedDate}
              presets={[
                { label: "Today", getValue: () => toLocalDateInputValue(new Date()) },
                {
                  label: "Yesterday",
                  getValue: () => {
                    const date = new Date();
                    date.setDate(date.getDate() - 1);
                    return toLocalDateInputValue(date);
                  },
                },
                {
                  label: "7 days",
                  getValue: () => {
                    const date = new Date();
                    date.setDate(date.getDate() - 7);
                    return toLocalDateInputValue(date);
                  },
                },
              ]}
            />
          </div>
        </section>

        {/* Stats Cards - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-1">
          <div className="relative overflow-hidden bg-white rounded-[24px] p-4 border border-[#ececec] shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Total</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{todayStats.total}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden bg-white rounded-[24px] p-4 border border-[#ececec] shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Active</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">{todayStats.checkedIn}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden bg-white rounded-[24px] p-4 border border-[#ececec] shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Completed</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">{todayStats.checkedOut}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                <History className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        
        <div className="relative overflow-hidden bg-white rounded-[28px] p-4 mx-1 border border-[#ececec] shadow-[0_10px_35px_rgba(0,0,0,0.06)]">
  <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search attendance records..."
              className="w-full pl-11 pr-4 py-3 bg-[#f5f5f5] border border-[#ececec] rounded-2xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm text-[#1a1c1c] placeholder:text-[#8b8b8b] shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Expired Membership Alert */}
        {todayStats.expired > 0 && (
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-[#f0813d] rounded-xl p-3 mx-1 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-[#f0813d] rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-orange-900 mb-1">
                  ⚠️ {todayStats.expired} Expired {todayStats.expired === 1 ? 'Membership' : 'Memberships'}
                </h3>
                <p className="text-xs text-[#f0813d] leading-relaxed">
                  {todayStats.expired === 1 
                    ? 'A member with expired membership checked in today. Contact them for renewal.'
                    : `${todayStats.expired} members with expired memberships checked in today. Contact them for renewal.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white rounded-[28px] p-4 mx-1 border border-[#ececec] shadow-[0_10px_35px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">View</span>
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
            {[
              { id: "today", label: "Today's Log", icon: <Clock className="w-3.5 h-3.5" /> },
              { id: "history", label: "History", icon: <BarChart3 className="w-3.5 h-3.5" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={{ minHeight: '36px' }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Attendance List */}
        {activeTab === "today" && (
          <div className="space-y-4 pb-20">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-semibold text-gray-900 text-sm">Attendance Records</h3>
              <span className="text-xs text-gray-500">
                {filteredAttendance.length} {filteredAttendance.length === 1 ? 'record' : 'records'}
              </span>
            </div>
            
            {filteredAttendance.length === 0 ? (
              <div className="bg-white rounded-xl p-6 text-center border border-gray-200 shadow-sm mx-1">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">No attendance records</h3>
                <p className="text-gray-500 text-sm mb-4">
                  No one has checked in for this date yet
                </p>
                <button
                  onClick={() => setShowMarkModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white font-medium rounded-lg hover:shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 mx-auto"
                  style={{ minHeight: '44px' }}
                >
                  <Plus className="w-5 h-5" />
                  Mark First Entry
                </button>
              </div>
            ) : (
              <>
  <div className="hidden md:grid grid-cols-5 gap-4 px-6 py-4 bg-[#ebe5e1] rounded-2xl mx-1 text-xs font-black uppercase tracking-[0.15em] text-[#6e625c]">
    <div>Member</div>
    <div>Check In</div>
    <div>Check Out</div>
    <div>Status</div>
    <div>Actions</div>
  </div>

  {filteredAttendance.map((record) => (
                <div
                  key={record.id}
                  className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow-md transition-all duration-200 mx-1"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#9c4400] flex items-center justify-center text-white font-bold text-lg shadow-sm">
                        {record.name.charAt(0).toUpperCase()}
                      </div>
                    </div>

                    {/* Member Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 text-sm truncate">
                              {record.name}
                            </h3>
                            {record.membershipStatus === "EXPIRED" && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-100 text-[#f0813d] rounded border border-[#f0813d]">
                                EXPIRED
                              </span>
                            )}
                          </div>
                          {record.membershipStatus === "EXPIRED" && (
                            <div className="flex items-center gap-1 text-xs text-[#f0813d] bg-orange-50 px-2 py-1 rounded mb-1">
                              <XCircle className="w-3 h-3" />
                              <span className="font-medium">Membership expired - Requires renewal</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1 text-xs text-[#f0813d]">
                              <Clock className="w-3 h-3" />
                              <span>In: {record.checkIn}</span>
                            </div>
                            {record.checkOut && (
                              <div className="flex items-center gap-1 text-xs text-[#f0813d]">
                                <Clock className="w-3 h-3" />
                                <span>Out: {record.checkOut}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {record.status === "checked-in" ? (
                            <div className="px-2.5 py-1.5 rounded-lg border bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 text-[#f0813d] flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span className="text-xs font-medium">Active</span>
                            </div>
                          ) : (
                            <div className="px-2.5 py-1.5 rounded-lg border bg-gradient-to-br from-orange-50 to-orange-100 border-[#f0813d]/20 text-[#f0813d] flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span className="text-xs font-medium">Completed</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-2 overflow-x-auto mt-3 pt-3 border-t border-gray-100 pb-1 -mx-1 px-1 no-scrollbar">
                        {record.status === "checked-in" && (
                          <button
                            onClick={() => handleCheckOut(record.id, record.memberId)}
                            className="flex-shrink-0 px-3 py-2 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white text-xs font-medium rounded-lg active:scale-95 transition-all flex items-center gap-2"
                            style={{ minHeight: '36px' }}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Check Out
                          </button>
                        )}
                        
                        <button
                          onClick={() => router.push(`/members/${record.memberId}`)}
                          className="flex-shrink-0 px-3 py-2 bg-[#f0813d]/10 text-[#f0813d] cursor-pointer text-xs font-medium rounded-lg active:bg-orange-100 transition-all flex items-center gap-2"
                          style={{ minHeight: '36px' }}
                        >
                          <User className="w-3.5 h-3.5" />
                          View Profile
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
             ))
}
</>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-3 pb-20">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-semibold text-gray-900 text-sm">Attendance History</h3>
              <span className="text-xs text-gray-500">Last 7 days</span>
            </div>
            
            {historyData.length > 0 ? (
              historyData.map((day, index) => (
                <div
                  key={index}
                  onClick={() => router.push(`/attendance/history?date=${day.rawDate}`)}
                  className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow-md transition-all duration-200 cursor-pointer mx-1 active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{day.fullDate}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <p className="text-xs text-gray-500">
                            Peak: {day.peakTime}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-lg">{day.count}</p>
                      <p className="text-xs text-gray-500">check-ins</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-xl p-6 text-center border border-gray-200 shadow-sm mx-1">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <History className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">No history available</h3>
                <p className="text-gray-500 text-sm">
                  Attendance history will appear here
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mark Attendance FAB */}
      <button
        onClick={() => setShowMarkModal(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-full shadow-xl flex items-center justify-center z-40 hover:shadow-2xl transition-all hover:scale-105 active:scale-95"
        style={{
          boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)',
        }}
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Mark Attendance Modal */}
      {showMarkModal && (
        <MarkAttendanceModal
          members={members}
          attendance={attendance}
          searchQuery={searchModalQuery}
          setSearchQuery={setSearchModalQuery}
          onClose={() => {
            setShowMarkModal(false);
            setSearchModalQuery("");
          }}
          onMarkAttendance={handleMarkAttendance}
        />
      )}
    </div>
  );
}

// Improved Mark Attendance Modal Component
function MarkAttendanceModal({
  members,
  attendance,
  searchQuery,
  setSearchQuery,
  onClose,
  onMarkAttendance,
}) {
  // Get members already checked in today
  const alreadyCheckedIn = attendance
    .filter((a) => a.status === "checked-in")
    .map((a) => a.memberId);

  // Filter members based on search and exclude already checked-in
  const filteredMembers = members.filter((member) => {
    const matchesSearch = 
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone.includes(searchQuery);
    
    const isAlreadyCheckedIn = alreadyCheckedIn.includes(member.id);
    
    return matchesSearch && !isAlreadyCheckedIn;
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-hidden shadow-2xl animate-slide-up">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Mark Attendance</h3>
              <p className="text-gray-500 text-xs mt-0.5">Select a member to check in</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search member by name or phone..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          
          {/* Summary */}
          <div className="flex items-center gap-4 mt-3 text-xs">
            <span className="text-gray-600">
              {filteredMembers.length} available
            </span>
            <span className="text-[#f0813d] font-medium">
              {alreadyCheckedIn.length} already checked in
            </span>
          </div>
        </div>

        {/* Member List */}
        <div className="overflow-y-auto max-h-[60vh] p-2">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <User className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">No members found</h3>
              <p className="text-gray-500 text-xs mb-4">
                {searchQuery 
                  ? "Try a different search term" 
                  : "All members are already checked in or no members available"}
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 text-[#f0813d] text-sm font-medium hover:text-[#f0813d] active:scale-95 transition-transform"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  onClick={() => onMarkAttendance(member)}
                  className="flex items-center gap-3 p-3 hover:bg-[#f0813d]/10 rounded-xl transition-all cursor-pointer border border-gray-100 hover:border-[#f0813d]/20 group active:scale-95"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br from-[#f0813d] to-[#9c4400] shadow-sm">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {member.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {member.phone}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg">
                        {member.plan}
                      </span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 bg-white sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-lg active:scale-95 transition-all duration-200"
            style={{ minHeight: '44px' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
