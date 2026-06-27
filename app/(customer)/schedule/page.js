"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";

export default function SchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [gymTimings, setGymTimings] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [workoutPlans, setWorkoutPlans] = useState([]);
  const [attendanceDates, setAttendanceDates] = useState([]);

  useEffect(() => {
    fetchScheduleData();
  }, []);

  const fetchScheduleData = async () => {
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

      // Fetch gym timings
      if (!memberError && memberDetails?.gym_id) {
        const { data: gymData, error: gymError } = await supabase
          .from("gyms")
          .select("weekday_open, weekday_close, weekend_open, weekend_close")
          .eq("id", memberDetails.gym_id)
          .single();

        if (!gymError && gymData) {
          const formatTime = (time) => {
            if (!time) return "";
            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            return `${displayHour}:${minutes} ${ampm}`;
          };

          setGymTimings({
            weekday: gymData.weekday_open && gymData.weekday_close
              ? `${formatTime(gymData.weekday_open)} - ${formatTime(gymData.weekday_close)}`
              : "Not set",
            weekend: gymData.weekend_open && gymData.weekend_close
              ? `${formatTime(gymData.weekend_open)} - ${formatTime(gymData.weekend_close)}`
              : "Not set",
          });
        }
      }

      // Fetch assigned workout plans
      const { data: memberWorkouts, error: workoutsError } = await supabase
        .from("member_workouts")
        .select(`
          workout_plans (
            title
          )
        `)
        .eq("member_id", member.id);

      if (!workoutsError && memberWorkouts) {
        setWorkoutPlans(memberWorkouts.map(mw => mw.workout_plans?.title).filter(Boolean));
      }

      // Fetch attendance dates for this week
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("check_in_date")
        .eq("member_id", member.id)
        .gte("check_in_date", weekStart.toISOString().split('T')[0])
        .lte("check_in_date", weekEnd.toISOString().split('T')[0]);

      if (!attendanceError && attendanceData) {
        setAttendanceDates(attendanceData.map(a => a.check_in_date));
      }

      // Fetch upcoming events (membership expiry)
      const { data: membershipData, error: membershipError } = await supabase
        .from("memberships")
        .select("end_date, status")
        .eq("member_id", member.id)
        .eq("status", "active")
        .order("end_date", { ascending: true })
        .limit(1);

      if (!membershipError && membershipData && membershipData.length > 0) {
        const endDate = new Date(membershipData[0].end_date);
        const today = new Date();
        if (endDate > today) {
          setUpcoming([{
            id: 1,
            title: "Plan Renewal",
            date: endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            time: "-",
            type: "payment",
          }]);
        }
      }

    } catch (error) {
      console.error("Error fetching schedule data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekDays = () => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + (selectedWeek * 7)); // Start of week (Sunday)
    
    const days = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      
      const dateStr = date.toISOString().split('T')[0];
      const isToday = date.toDateString() === new Date().toDateString();
      const hasAttendance = attendanceDates.includes(dateStr);
      
      days.push({
        date: dateStr,
        day: dayNames[i],
        dayNumber: date.getDate(),
        isToday: isToday,
        completed: hasAttendance,
        workout: workoutPlans.length > 0 ? workoutPlans[0] : "Workout",
      });
    }
    
    return days;
  };

  const weekDays = getWeekDays();
  const todaySchedule = weekDays.find(d => d.isToday) || weekDays[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Schedule" showBack={false} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f0813d]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Schedule" showBack={false} />

      <main className="px-4 py-4 space-y-4">
        {/* Week Selector */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setSelectedWeek((prev) => prev - 1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              ←
            </button>
            <h3 className="font-semibold text-gray-900">
              {selectedWeek === 0
                ? "This Week"
                : selectedWeek > 0
                ? "Next Week"
                : "Last Week"}
            </h3>
            <button
              onClick={() => setSelectedWeek((prev) => prev + 1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              →
            </button>
          </div>

          {/* Week Days */}
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => (
              <div
                key={day.date}
                className={`text-center p-2 rounded-lg ${
                  day.isToday
                    ? "bg-black text-white"
                    : day.completed
                    ? "bg-orange-100"
                    : ""
                }`}
              >
                <p className="text-xs mb-1">{day.day}</p>
                <p
                  className={`text-lg font-bold ${
                    day.isToday ? "" : "text-gray-900"
                  }`}
                >
                  {day.dayNumber}
                </p>
                {day.completed && !day.isToday && (
                  <span className="text-[#f0813d] text-xs">✓</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Today's Schedule */}
        {todaySchedule && (
          <div className="bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-xl p-5 text-white">
            <p className="text-orange-100 text-sm">
              Today - {todaySchedule.day}
            </p>
            <h2 className="text-xl font-bold mb-3">
              {todaySchedule.workout || "No workout assigned"}
            </h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <span>🕐</span> {gymTimings?.weekday ? gymTimings.weekday.split(' - ')[0] : "Check gym timings"}
              </span>
              <span className="flex items-center gap-1">
                <span>⏱️</span> 45-60 min
              </span>
            </div>
          </div>
        )}

        {/* Weekly Schedule List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Weekly Plan</h3>
          </div>
          {weekDays.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {weekDays.map((day) => (
                <div
                  key={day.date}
                  className={`p-4 flex items-center justify-between ${
                    day.isToday ? "bg-orange-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                        day.isToday
                          ? "bg-[#f0813d] text-white"
                          : day.completed
                          ? "bg-orange-100 text-[#f0813d]"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {day.completed ? "✓" : day.day.charAt(0)}
                    </div>
                    <div>
                      <p
                        className={`font-medium ${
                          day.isToday ? "text-orange-900" : "text-gray-900"
                        }`}
                      >
                        {day.workout}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(day.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric"
                        })}
                      </p>
                    </div>
                  </div>
                  {day.isToday && (
                    <span className="px-2 py-1 bg-[#f0813d] text-white text-xs rounded-full">
                      Today
                    </span>
                  )}
                  {day.completed && !day.isToday && (
                    <span className="px-2 py-1 bg-orange-100 text-[#f0813d] text-xs rounded-full">
                      Attended
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p>No schedule data available</p>
            </div>
          )}
        </div>

        {/* Gym Timings */}
        {gymTimings && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">🏋️ Gym Timings</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Weekdays (Mon-Fri)</span>
                <span className="font-medium">{gymTimings.weekday}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Weekends (Sat-Sun)</span>
                <span className="font-medium">{gymTimings.weekend}</span>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Events */}
        {upcoming.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">📅 Upcoming</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {upcoming.map((event) => (
                <div key={event.id} className="p-4 flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      event.type === "training"
                        ? "bg-orange-100"
                        : event.type === "checkup"
                        ? "bg-orange-100"
                        : "bg-orange-100"
                    }`}
                  >
                    {event.type === "training"
                      ? "💪"
                      : event.type === "checkup"
                      ? "📏"
                      : "💳"}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{event.title}</p>
                    <p className="text-sm text-gray-500">
                      {event.date} • {event.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
