"use client";

import { useAuthContext } from "@/contexts/AuthContext";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { XCircle } from "lucide-react";

function AttendanceHistoryContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const [filterTime, setFilterTime] = useState("all");
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { selectedGym } = useAuthContext();
  
  // Format the date for display
  const displayDate = dateParam 
    ? new Date(dateParam).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    : "No Date";

  // Get gym from localStorage
  // gym now comes from AuthContext


  // Fetch attendance data for the specific date
  useEffect(() => {
    const fetchAttendanceHistory = async () => {
      if (!selectedGym?.id || !dateParam) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("attendance")
          .select(`
            id,
            member_id,
            check_in_time,
            check_out_time,
            membership_status,
            members (
              id,
              full_name,
              phone
            )
          `)
          .eq("gym_id", selectedGym.id)
          .eq("check_in_date", dateParam)
          .order("check_in_time", { ascending: false });

        if (error) {
          console.error("Error fetching attendance:", error);
          setAttendanceData([]);
        } else {
          // Transform data
          const transformedData = (data || []).map((record) => {
            const checkInTime = new Date(`1970-01-01T${record.check_in_time}`);
            const checkOutTime = record.check_out_time 
              ? new Date(`1970-01-01T${record.check_out_time}`)
              : null;
            
            let duration = "N/A";
            if (checkOutTime) {
              const diffMs = checkOutTime - checkInTime;
              const diffMins = Math.floor(diffMs / 60000);
              const hours = Math.floor(diffMins / 60);
              const mins = diffMins % 60;
              duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            }

            return {
              id: record.id,
              name: record.members?.full_name || "Unknown",
              checkIn: checkInTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              checkOut: checkOutTime
                ? checkOutTime.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "N/A",
              duration: duration,
              checkInHour: checkInTime.getHours(),
              membershipStatus: record.membership_status || "ACTIVE",
            };
          });
          
          setAttendanceData(transformedData);
        }
      } catch (err) {
        console.error("Error:", err);
        setAttendanceData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceHistory();
  }, [selectedGym?.id, dateParam]);

  // Calculate statistics
  const stats = {
    total: attendanceData.length,
    peakTime: "N/A",
    avgDuration: "N/A",
    expired: attendanceData.filter(r => r.membershipStatus === "EXPIRED").length,
  };

  if (attendanceData.length > 0) {
    // Calculate peak time (most common hour)
    const hourCounts = {};
    attendanceData.forEach(record => {
      const hour = record.checkInHour;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const peakHour = Object.keys(hourCounts).reduce((a, b) => 
      hourCounts[a] > hourCounts[b] ? a : b, null);
    
    if (peakHour) {
      const startHour = parseInt(peakHour);
      const endHour = startHour + 2;
      const formatHour = (h) => {
        const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const ampm = h >= 12 ? "PM" : "AM";
        return `${hour12} ${ampm}`;
      };
      stats.peakTime = `${formatHour(startHour)}-${formatHour(endHour)}`;
    }

    // Calculate average duration (only for checked-out members)
    const durationsInMinutes = attendanceData
      .filter(r => r.duration !== "N/A")
      .map(r => {
        const parts = r.duration.split(" ");
        let totalMins = 0;
        parts.forEach(part => {
          if (part.includes("h")) {
            totalMins += parseInt(part) * 60;
          } else if (part.includes("m")) {
            totalMins += parseInt(part);
          }
        });
        return totalMins;
      });

    if (durationsInMinutes.length > 0) {
      const avgMins = Math.floor(
        durationsInMinutes.reduce((a, b) => a + b, 0) / durationsInMinutes.length
      );
      const hours = Math.floor(avgMins / 60);
      const mins = avgMins % 60;
      stats.avgDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }
  }

  // Filter attendance by time of day
  const filteredAttendance = attendanceData.filter(record => {
    if (filterTime === "all") return true;
    const hour = record.checkInHour;
    if (filterTime === "morning") return hour >= 5 && hour < 12;
    if (filterTime === "afternoon") return hour >= 12 && hour < 17;
    if (filterTime === "evening") return hour >= 17 || hour < 5;
    return true;
  });

  const timeFilters = ["all", "morning", "afternoon", "evening"];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Attendance History" />
        <main className="px-4 py-4">
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title={`Attendance - ${displayDate}`} />

      <main className="px-4 py-4">
        {/* Expired Membership Alert */}
        {stats.expired > 0 && (
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-[#f0813d] rounded-xl p-4 mb-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-[#f0813d] rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-orange-900 mb-1">
                  ⚠️ {stats.expired} Expired {stats.expired === 1 ? 'Membership' : 'Memberships'}
                </h3>
                <p className="text-xs text-[#f0813d] leading-relaxed">
                  {stats.expired === 1 
                    ? 'A member with expired membership checked in on this date.'
                    : `${stats.expired} members with expired memberships checked in on this date.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl p-6 text-white mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-gray-300 text-sm">Total</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.peakTime}</p>
              <p className="text-gray-300 text-sm">Peak Time</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.avgDuration}</p>
              <p className="text-gray-300 text-sm">Avg Duration</p>
            </div>
          </div>
        </div>

        {/* Time Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {timeFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterTime(filter)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                filterTime === filter
                  ? "bg-black text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {/* Attendance List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {filteredAttendance.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg mb-2">No attendance records found</p>
              <p className="text-sm">
                {filterTime !== "all" 
                  ? `No records for ${filterTime} time period`
                  : "No one checked in on this date"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredAttendance.map((record) => (
                <div key={record.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-gray-800 to-gray-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {record.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{record.name}</p>
                          {record.membershipStatus === "EXPIRED" && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-100 text-[#f0813d] rounded border border-[#f0813d]">
                              EXPIRED
                            </span>
                          )}
                        </div>
                        {record.membershipStatus === "EXPIRED" && (
                          <div className="flex items-center gap-1 text-xs text-[#f0813d] bg-orange-50 px-2 py-1 rounded mt-1 mb-1">
                            <XCircle className="w-3 h-3" />
                            <span className="font-medium">Membership expired</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="text-[#f0813d]">
                            ↓ {record.checkIn}
                          </span>
                          <span className={record.checkOut === "N/A" ? "text-gray-400" : "text-[#f0813d]"}>
                            ↑ {record.checkOut}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {record.duration}
                      </p>
                      <p className="text-xs text-gray-500">duration</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AttendanceHistoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Attendance History" />
        <main className="px-4 py-4">
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
          </div>
        </main>
      </div>
    }>
      <AttendanceHistoryContent />
    </Suspense>
  );
}
