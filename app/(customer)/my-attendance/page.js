/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";

export default function CustomerAttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState({
    totalDays: 0,
    presentDays: 0,
    streak: 0,
    avgDuration: "0h 0m",
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }));
  const [viewMode, setViewMode] = useState("list"); // list or calendar

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      
      // Get logged-in member from localStorage
      const storedMember = localStorage.getItem("member");
      if (!storedMember) {
        router.push("/auth/login");
        return;
      }

      const member = JSON.parse(storedMember);

      // Fetch attendance data
      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("member_id", member.id)
        .order("check_in_date", { ascending: false })
        .order("check_in_time", { ascending: false });

      if (error) throw error;

      // Format attendance data
      const formattedAttendance = (attendanceData || []).map(a => {
        const checkInTime = a.check_in_time ? formatTime(a.check_in_time) : "";
        const checkOutTime = a.check_out_time ? formatTime(a.check_out_time) : "";
        
        let duration = "N/A";
        if (checkInTime && checkOutTime) {
          const checkIn = new Date(`2000-01-01 ${a.check_in_time}`);
          const checkOut = new Date(`2000-01-01 ${a.check_out_time}`);
          const diffMs = checkOut - checkIn;
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          duration = `${hours}h ${minutes}m`;
        }

        return {
          id: a.id,
          date: a.check_in_date,
          checkIn: checkInTime,
          checkOut: checkOutTime,
          duration: duration,
        };
      });

      setAttendance(formattedAttendance);

      // Calculate monthly stats
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      const thisMonthAttendance = formattedAttendance.filter(a => {
        const attendanceDate = new Date(a.date);
        return attendanceDate.getMonth() === currentMonth && 
               attendanceDate.getFullYear() === currentYear;
      });

      // Calculate streak
      let streak = 0;
      if (formattedAttendance.length > 0) {
        const sortedDates = formattedAttendance
          .map(a => new Date(a.date))
          .sort((a, b) => b - a);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const latestAttendance = sortedDates[0];
        if (latestAttendance && 
            (latestAttendance.toDateString() === today.toDateString() || 
             latestAttendance.toDateString() === yesterday.toDateString())) {
          
          let currentDate = new Date(latestAttendance);
          currentDate.setHours(0, 0, 0, 0);
          let i = 0;
          
          while (i < sortedDates.length) {
            const attendanceDate = new Date(sortedDates[i]);
            attendanceDate.setHours(0, 0, 0, 0);
            
            if (attendanceDate.getTime() === currentDate.getTime()) {
              streak++;
              currentDate.setDate(currentDate.getDate() - 1);
              i++;
            } else if (attendanceDate < currentDate) {
              break; // Gap in streak
            } else {
              i++;
            }
          }
        }
      }

      // Calculate average duration
      let totalMinutes = 0;
      let durationCount = 0;
      formattedAttendance.forEach(a => {
        if (a.checkIn && a.checkOut) {
          const checkIn = new Date(`2000-01-01 ${a.checkIn.replace(' AM', '').replace(' PM', '')}`);
          const checkOut = new Date(`2000-01-01 ${a.checkOut.replace(' AM', '').replace(' PM', '')}`);
          const diffMs = checkOut - checkIn;
          const minutes = Math.floor(diffMs / (1000 * 60));
          totalMinutes += minutes;
          durationCount++;
        }
      });

      const avgMinutes = durationCount > 0 ? Math.round(totalMinutes / durationCount) : 0;
      const avgHours = Math.floor(avgMinutes / 60);
      const avgMins = avgMinutes % 60;
      const avgDuration = `${avgHours}h ${avgMins}m`;

      // Get total days in current month
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const daysPassed = today.getDate();

      setMonthlyStats({
        totalDays: daysPassed,
        presentDays: thisMonthAttendance.length,
        streak: streak,
        avgDuration: avgDuration,
      });

    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return "";
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Generate calendar data
  const generateCalendarDays = () => {
    const days = [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get first day of month and number of days
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    const presentDates = attendance
      .filter(a => {
        const attendanceDate = new Date(a.date);
        return attendanceDate.getMonth() === currentMonth && 
               attendanceDate.getFullYear() === currentYear;
      })
      .map(a => new Date(a.date).getDate());

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, isPresent: false, isToday: false });
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isPresent: presentDates.includes(i),
        isToday: i === today.getDate() && 
                 currentMonth === today.getMonth() && 
                 currentYear === today.getFullYear(),
      });
    }
    return days;
  };

  const calendarDays = generateCalendarDays();

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="My Attendance" />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f0813d]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="My Attendance" />

      <main className="px-4 py-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">This Month</p>
                <p className="text-3xl font-bold">{monthlyStats.presentDays}</p>
                <p className="text-orange-100 text-sm">
                  of {monthlyStats.totalDays} days
                </p>
              </div>
              <span className="text-4xl opacity-50">📅</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Current Streak</p>
                <p className="text-3xl font-bold">{monthlyStats.streak}</p>
                <p className="text-orange-100 text-sm">days 🔥</p>
              </div>
              <span className="text-4xl opacity-50">⚡</span>
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-900">
              {monthlyStats.avgDuration}
            </p>
            <p className="text-sm text-gray-500">Avg. Session</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-900">
              {Math.round(
                (monthlyStats.presentDays / monthlyStats.totalDays) * 100
              )}
              %
            </p>
            <p className="text-sm text-gray-500">Consistency</p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode("list")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
              viewMode === "list"
                ? "bg-black text-white"
                : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            📋 List View
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
              viewMode === "calendar"
                ? "bg-black text-white"
                : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            📅 Calendar
          </button>
        </div>

        {/* List View */}
        {viewMode === "list" && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Recent Sessions</h3>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm text-gray-600 bg-transparent outline-none"
              >
                <option>January 2025</option>
                <option>December 2024</option>
                <option>November 2024</option>
              </select>
            </div>
            {attendance.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No attendance records found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {attendance.map((record) => (
                <div key={record.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatDate(record.date)}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-[#f0813d] rounded-full"></span>
                          {record.checkIn}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-[#f0813d] rounded-full"></span>
                          {record.checkOut}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {record.duration}
                      </p>
                      <p className="text-xs text-gray-500">workout</p>
                    </div>
                  </div>
                </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Calendar View */}
        {viewMode === "calendar" && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <button className="p-2 hover:bg-gray-100 rounded-lg">←</button>
              <h3 className="font-semibold text-gray-900">{selectedMonth}</h3>
              <button className="p-2 hover:bg-gray-100 rounded-lg">→</button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                <div key={i} className="text-center text-xs text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => (
                <div
                  key={day.day !== null ? day.day : `empty-${index}`}
                  className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium ${
                    day.day === null
                      ? ""
                      : day.isToday
                      ? "bg-black text-white"
                      : day.isPresent
                      ? "bg-orange-100 text-[#f0813d]"
                      : "text-gray-400"
                  }`}
                >
                  {day.day}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded bg-orange-100"></div>
                <span className="text-gray-600">Present</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded bg-black"></div>
                <span className="text-gray-600">Today</span>
              </div>
            </div>
          </div>
        )}

        {/* Motivation Card */}
        <div className="mt-4 bg-gradient-to-r from-[#f0813d] to-[#f0813d] rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💪</span>
            <div>
              <p className="font-semibold">Keep it up!</p>
              <p className="text-sm text-orange-100">
                You're on a {monthlyStats.streak} day streak. Don t break the
                chain!
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

