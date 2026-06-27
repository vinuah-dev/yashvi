"use client";

import { useAuthContext } from "@/contexts/AuthContext";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import AttendanceTimePicker from "@/components/shared/AttendanceTimePicker";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/lib/hooks/useUserRole";
import {
  Search,
  UserCheck,
  CalendarDays,
  CheckCircle,
  RefreshCw,
  Users,
  IndianRupee,
  Clock,
  ChevronRight,
  Save,
} from "lucide-react";
import {
  TRAINER_ATTENDANCE_SESSIONS,
  buildAttendanceDrafts,
  createEmptyTimeParts,
  fromTimeParts,
  formatHoursLabel,
  validateSessionTimes,
} from "@/lib/utils/trainerAttendance";

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatLocalMonth = (date) => formatLocalDate(date).slice(0, 7);

export default function TrainerAttendanceQuickPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canCreateTrainer, loading: roleLoading } = useUserRole();
  const { selectedGym } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [trainers, setTrainers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrainerId, setSelectedTrainerId] = useState(searchParams.get("trainerId") || null);
  const [selectedMonth, setSelectedMonth] = useState(formatLocalMonth(new Date()));
  const [viewMode, setViewMode] = useState("today");
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceData, setAttendanceData] = useState({ month: null, summary: null, attendance_days: [], pt_sessions: [] });
  const [attendanceDrafts, setAttendanceDrafts] = useState({});

  // Set loading false if no gym
  useEffect(() => {
    if (!selectedGym && !roleLoading) {
      setLoading(false);
    }
  }, [selectedGym, roleLoading]);

  const fetchTrainers = useCallback(async () => {
    if (!selectedGym?.id) return;
    setLoading(true);
    try {
      const response = await fetch("/api/trainers/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_gym_id: selectedGym.id }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        console.error("Error fetching trainers:", result.error);
        setTrainers([]);
        return;
      }

      const list = (result.data?.trainers || []).map((trainer) => ({
        gymTrainerId: trainer.id,
        profileId: trainer.profile_id,
        name: `${trainer.first_name || ""} ${trainer.last_name || ""}`.trim(),
        specialization: trainer.specialization,
        isActive: trainer.is_active,
        monthlySalary: trainer.monthly_salary || 0,
      }));

      setTrainers(list);

      if (list.length > 0) {
        const requestedTrainerId = searchParams.get("trainerId");
        const requestedExists = requestedTrainerId && list.some((trainer) => trainer.gymTrainerId === requestedTrainerId);
        if (requestedExists) {
          setSelectedTrainerId(requestedTrainerId);
        } else if (!selectedTrainerId || !list.some((trainer) => trainer.gymTrainerId === selectedTrainerId)) {
          setSelectedTrainerId(list[0].gymTrainerId);
        }
      }
    } catch (error) {
      console.error("Error fetching trainers:", error);
      setTrainers([]);
    } finally {
      setLoading(false);
    }
  }, [searchParams, selectedGym?.id, selectedTrainerId]);

  const fetchAttendanceSummary = useCallback(async (trainerId, monthValue) => {
    if (!selectedGym?.id || !trainerId) return;
    setAttendanceLoading(true);
    try {
      const response = await fetch("/api/trainers/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_gym_id: selectedGym.id,
          p_trainer_id: trainerId,
          p_month: `${monthValue}-01`,
        }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        console.error("Error fetching trainer attendance summary:", result.error);
        setAttendanceData({ month: null, summary: null, attendance_days: [], pt_sessions: [] });
        return;
      }

      setAttendanceData({
        month: result.data?.month || null,
        summary: result.data?.summary || null,
        attendance_days: result.data?.attendance_days || [],
        pt_sessions: result.data?.pt_sessions || [],
      });
    } catch (error) {
      console.error("Error fetching trainer attendance summary:", error);
      setAttendanceData({ month: null, summary: null, attendance_days: [], pt_sessions: [] });
    } finally {
      setAttendanceLoading(false);
    }
  }, [selectedGym?.id]);

  useEffect(() => {
    setAttendanceDrafts(buildAttendanceDrafts(attendanceData.attendance_days || []));
  }, [attendanceData.attendance_days]);

  useEffect(() => {
    if (selectedGym?.id && canCreateTrainer) {
      fetchTrainers();
    }
  }, [selectedGym?.id, canCreateTrainer, fetchTrainers]);

  useEffect(() => {
    if (selectedGym?.id && selectedTrainerId) {
      fetchAttendanceSummary(selectedTrainerId, selectedMonth);
    }
  }, [selectedGym?.id, selectedTrainerId, selectedMonth, fetchAttendanceSummary]);

  const selectedTrainer = trainers.find((trainer) => trainer.gymTrainerId === selectedTrainerId) || null;
  const attendanceDays = attendanceData.attendance_days || [];

  const filteredTrainers = (() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return trainers;
    return trainers.filter((trainer) =>
      trainer.name.toLowerCase().includes(query) ||
      String(trainer.specialization || "").toLowerCase().includes(query)
    );
  })();

  const visibleDays = (() => {
    if (viewMode === "month") return attendanceDays;

    const currentMonth = formatLocalMonth(new Date());
    const focusDate = currentMonth === selectedMonth
      ? formatLocalDate(new Date())
      : `${selectedMonth}-01`;

    const matchingDays = attendanceDays.filter((day) => day.attendance_date === focusDate);
    return matchingDays.length > 0 ? matchingDays : attendanceDays.slice(0, 1);
  })();

  const updateSessionTimePart = (attendanceDate, sessionNumber, field, part, value) => {
    setAttendanceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [attendanceDate]: {
        ...(currentDrafts[attendanceDate] || buildAttendanceDrafts([{ attendance_date: attendanceDate }])[attendanceDate]),
        [sessionNumber]: {
          ...((currentDrafts[attendanceDate] || {})[sessionNumber] || {
            id: null,
            notes: "",
            checkInParts: createEmptyTimeParts(),
            checkOutParts: createEmptyTimeParts(),
          }),
          [field]: {
            ...(((currentDrafts[attendanceDate] || {})[sessionNumber] || {})[field] || createEmptyTimeParts()),
            minute: part === "minute"
              ? value
              : ((((currentDrafts[attendanceDate] || {})[sessionNumber] || {})[field] || {}).minute || "00"),
            [part]: value,
          },
        },
      },
    }));
  };

  const clearSessionTime = (attendanceDate, sessionNumber, field) => {
    setAttendanceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [attendanceDate]: {
        ...(currentDrafts[attendanceDate] || buildAttendanceDrafts([{ attendance_date: attendanceDate }])[attendanceDate]),
        [sessionNumber]: {
          ...((currentDrafts[attendanceDate] || {})[sessionNumber] || {
            id: null,
            notes: "",
            checkInParts: createEmptyTimeParts(),
            checkOutParts: createEmptyTimeParts(),
          }),
          [field]: createEmptyTimeParts(),
        },
      },
    }));
  };

  const resetAttendanceDay = (day) => {
    const emptyDayDraft = TRAINER_ATTENDANCE_SESSIONS.reduce((draftMap, session) => {
      draftMap[session.sessionNumber] = {
        id: null,
        notes: "",
        checkInParts: createEmptyTimeParts(),
        checkOutParts: createEmptyTimeParts(),
      };
      return draftMap;
    }, {});

    setAttendanceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [day.attendance_date]: emptyDayDraft,
    }));
  };

  const saveAttendanceDay = async (day) => {
    if (!selectedGym?.id || !selectedTrainer?.profileId) return;
    const dayDraft = attendanceDrafts[day.attendance_date] || buildAttendanceDrafts([day])[day.attendance_date];
    const storedUser = localStorage.getItem("gymUser");
    const user = storedUser ? JSON.parse(storedUser) : null;

    for (const session of TRAINER_ATTENDANCE_SESSIONS) {
      const draft = dayDraft[session.sessionNumber];
      const validationError = validateSessionTimes(draft?.checkInParts, draft?.checkOutParts);
      if (validationError) {
        alert(`${session.label}: ${validationError}`);
        return;
      }
    }

    setAttendanceSaving(true);
    try {
      const existingSessions = new Map((day.sessions || []).map((session) => [session.session_number, session]));
      const sessionRowsToSave = [];
      const sessionIdsToDelete = [];

      for (const session of TRAINER_ATTENDANCE_SESSIONS) {
        const draft = dayDraft[session.sessionNumber] || {
          id: null,
          notes: "",
          checkInParts: createEmptyTimeParts(),
          checkOutParts: createEmptyTimeParts(),
        };
        const existingSession = existingSessions.get(session.sessionNumber);
        const checkInValue = fromTimeParts(draft.checkInParts);
        const checkOutValue = fromTimeParts(draft.checkOutParts);

        if (!checkInValue && !checkOutValue) {
          if (existingSession?.id) {
            sessionIdsToDelete.push(existingSession.id);
          }
          continue;
        }

        sessionRowsToSave.push({
          gym_id: selectedGym.id,
          trainer_id: selectedTrainer.profileId,
          attendance_date: day.attendance_date,
          session_number: session.sessionNumber,
          check_in_time: checkInValue,
          check_out_time: checkOutValue,
          notes: draft.notes || null,
          marked_by: user?.id || null,
          marked_at: new Date().toISOString(),
        });
      }

      if (sessionIdsToDelete.length > 0) {
        const { error } = await supabase
          .from("trainer_attendance")
          .delete()
          .in("id", sessionIdsToDelete);

        if (error) throw error;
      }

      if (sessionRowsToSave.length > 0) {
        const { error } = await supabase
          .from("trainer_attendance")
          .upsert(sessionRowsToSave, {
            onConflict: "gym_id,trainer_id,attendance_date,session_number",
          });

        if (error) throw error;
      }

      await fetchAttendanceSummary(selectedTrainer.gymTrainerId, selectedMonth);
    } catch (error) {
      console.error("Error updating trainer attendance:", error);
      alert("Failed to update trainer attendance");
    } finally {
      setAttendanceSaving(false);
    }
  };

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Trainer Attendance" />
        <div className="flex items-center justify-center py-16">
          <div className="w-9 h-9 rounded-full border-4 border-[#f0813d]/20 border-t-[#9c4400] animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!selectedGym) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Trainer Attendance" />
        <main className="px-4 py-6">
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <p className="text-gray-600">No gym selected. Open the dashboard first and choose a gym.</p>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="mt-4 px-4 py-2 bg-[#9c4400] text-white rounded-lg font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Trainer Attendance" />

      <main className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Quick Mark Trainer Attendance</h2>
              <p className="text-sm text-gray-500">Select a trainer, mark today first, or switch to full month view.</p>
            </div>
            <button
              onClick={() => router.push("/settings/trainers")}
              className="px-3 py-2 text-sm font-medium text-[#9c4400] bg-[#f0813d]/10 rounded-lg hover:bg-[#f0813d]/15"
            >
              Open Trainer Management
            </button>
          </div>

          <div className="flex gap-3 flex-col lg:flex-row">
            <div className="lg:w-80 shrink-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search trainer..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent"
                />
              </div>

              <div className="max-h-112 overflow-y-auto space-y-2 pr-1">
                {filteredTrainers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                    No trainers found.
                  </div>
                ) : (
                  filteredTrainers.map((trainer) => {
                    const isSelected = trainer.gymTrainerId === selectedTrainerId;
                    return (
                      <button
                        key={trainer.gymTrainerId}
                        onClick={() => {
                          setSelectedTrainerId(trainer.gymTrainerId);
                          setViewMode("today");
                        }}
                        className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                          isSelected
                            ? "border-[#f0813d]/30 bg-[#f0813d]/10"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-gray-900">{trainer.name}</p>
                            <p className="text-xs text-gray-500">
                              {trainer.specialization || "Trainer"}
                              {trainer.monthlySalary ? ` • ₹${Number(trainer.monthlySalary).toLocaleString("en-IN")}` : ""}
                            </p>
                          </div>
                          <ChevronRight className={`w-4 h-4 ${isSelected ? "text-[#f0813d]" : "text-gray-400"}`} />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex-1 space-y-4">
              {selectedTrainer ? (
                <>
                  <div className="bg-[#f0813d]/10 border border-[#f0813d]/10 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-[#f0813d] font-semibold">Selected Trainer</p>
                        <h3 className="text-xl font-bold text-gray-900 mt-1">{selectedTrainer.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{selectedTrainer.specialization || "Trainer"}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent"
                          />
                        </div>
                        <button
                          onClick={() => setViewMode("today")}
                          className={`px-3 py-2 rounded-lg text-sm font-medium ${viewMode === "today" ? "bg-[#9c4400] text-white" : "bg-white text-gray-700 border border-gray-200"}`}
                        >
                          Today First
                        </button>
                        <button
                          onClick={() => setViewMode("month")}
                          className={`px-3 py-2 rounded-lg text-sm font-medium ${viewMode === "month" ? "bg-[#9c4400] text-white" : "bg-white text-gray-700 border border-gray-200"}`}
                        >
                          View All
                        </button>
                        <button
                          onClick={() => fetchAttendanceSummary(selectedTrainer.gymTrainerId, selectedMonth)}
                          className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                          title="Refresh"
                        >
                          <RefreshCw className={`w-4 h-4 text-gray-500 ${attendanceLoading ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    <SummaryCard icon={<CalendarDays className="w-4 h-4 text-gray-600" />} label="Working Days" value={Number(attendanceData.month?.working_days || 0).toLocaleString("en-IN")} />
                    <SummaryCard icon={<Clock className="w-4 h-4 text-[#f0813d]" />} label="Expected Hours" value={formatHoursLabel(Number(attendanceData.summary?.expected_hours || 0) * 60)} tone="blue" />
                    <SummaryCard icon={<UserCheck className="w-4 h-4 text-[#f0813d]" />} label="Worked Hours" value={formatHoursLabel(Number(attendanceData.summary?.worked_hours || 0) * 60)} tone="blue" />
                    <SummaryCard icon={<IndianRupee className="w-4 h-4 text-[#f0813d]" />} label="Salary Earned" value={`₹${Number(attendanceData.summary?.salary_earned || 0).toLocaleString("en-IN")}`} tone="orange" />
                    <SummaryCard icon={<IndianRupee className="w-4 h-4 text-[#f0813d]" />} label="PT Charges" value={`₹${Number(attendanceData.summary?.pt_charges || 0).toLocaleString("en-IN")}`} tone="blue" />
                    <SummaryCard icon={<IndianRupee className="w-4 h-4 text-gray-600" />} label="Hourly Salary" value={`₹${Number(attendanceData.summary?.hourly_salary || 0).toLocaleString("en-IN")}`} />
                    <SummaryCard icon={<IndianRupee className="w-4 h-4 text-[#f0813d]" />} label="Total Payable" value={`₹${Number(attendanceData.summary?.total_payable || 0).toLocaleString("en-IN")}`} tone="orange" />
                  </div>

                  <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="font-semibold text-gray-900">{viewMode === "today" ? "Today’s Attendance Sessions" : "Monthly Attendance Sessions"}</h3>
                        <p className="text-xs text-gray-500">Record up to two check in/check out sessions per day. Salary is calculated from worked hours.</p>
                      </div>
                      <button
                        onClick={() => router.push(`/settings/trainers/${selectedTrainer.gymTrainerId}?tab=attendance`)}
                        className="w-full sm:w-auto text-sm font-medium text-[#9c4400] bg-[#f0813d]/10 px-3 py-2 rounded-lg hover:bg-[#f0813d]/15"
                      >
                        Open Full Trainer Page
                      </button>
                    </div>

                    {attendanceLoading ? (
                      <div className="py-10 text-center text-gray-500">Loading attendance...</div>
                    ) : (
                      <div className="space-y-2 max-h-112 overflow-y-auto pr-1">
                        {visibleDays.map((day) => (
                          <div key={day.attendance_date} className="rounded-xl border border-gray-100 px-3 py-3 sm:px-4 space-y-3">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {new Date(`${day.attendance_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </p>
                                <p className="text-xs text-gray-500">{day.weekday_name}</p>
                              </div>
                              <div className="flex gap-2 flex-wrap text-xs">
                                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">Expected {formatHoursLabel(day.expected_minutes)}</span>
                                <span className="rounded-full bg-[#f0813d]/10 px-2.5 py-1 text-[#9c4400]">Worked {formatHoursLabel(day.worked_minutes)}</span>
                                <span className="rounded-full bg-[#f0813d]/10 px-2.5 py-1 text-[#9c4400]">Salary ₹{Number(day.daily_salary || 0).toLocaleString("en-IN")}</span>
                              </div>
                            </div>

                            {(day.expected_slots || []).length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {day.expected_slots.map((slot) => (
                                  <span key={slot} className="rounded-full bg-[#f0813d]/10 px-2.5 py-1 text-xs font-medium text-[#9c4400]">
                                    {slot}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="grid gap-3 lg:grid-cols-2">
                              {TRAINER_ATTENDANCE_SESSIONS.map((session) => {
                                const draft = attendanceDrafts[day.attendance_date]?.[session.sessionNumber] || {
                                  checkInParts: createEmptyTimeParts(),
                                  checkOutParts: createEmptyTimeParts(),
                                };
                                const existingSession = (day.sessions || []).find((item) => item.session_number === session.sessionNumber);
                                return (
                                  <div key={session.sessionNumber} className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-sm font-semibold text-gray-900">{session.label}</p>
                                      <span className="text-xs text-gray-500">{existingSession?.worked_minutes ? formatHoursLabel(existingSession.worked_minutes) : "0 hrs"}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                      <AttendanceTimePicker
                                        label="Check In"
                                        parts={draft.checkInParts}
                                        disabled={attendanceSaving}
                                        onPartChange={(part, value) => updateSessionTimePart(day.attendance_date, session.sessionNumber, "checkInParts", part, value)}
                                        onClear={() => clearSessionTime(day.attendance_date, session.sessionNumber, "checkInParts")}
                                      />
                                      <AttendanceTimePicker
                                        label="Check Out"
                                        parts={draft.checkOutParts}
                                        disabled={attendanceSaving}
                                        onPartChange={(part, value) => updateSessionTimePart(day.attendance_date, session.sessionNumber, "checkOutParts", part, value)}
                                        onClear={() => clearSessionTime(day.attendance_date, session.sessionNumber, "checkOutParts")}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => resetAttendanceDay(day)}
                                disabled={attendanceSaving}
                                className="w-full sm:w-auto px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                              >
                                Reset
                              </button>
                              <button
                                type="button"
                                onClick={() => saveAttendanceDay(day)}
                                disabled={attendanceSaving}
                                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-[#9c4400] px-3 py-2 text-xs font-medium text-white hover:bg-[#9c4400] disabled:opacity-60"
                              >
                                <Save className="w-3.5 h-3.5" />
                                Save Day
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-[#f0813d]/15 rounded-lg">
                        <IndianRupee className="w-5 h-5 text-[#f0813d]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">PT Charges from Trainer Earnings</h3>
                        <p className="text-xs text-gray-500">Taken automatically from paid trainer-plan earnings for this month.</p>
                      </div>
                    </div>

                    {attendanceData.pt_sessions.length === 0 ? (
                      <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                        No trainer earnings recorded for this month.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {attendanceData.pt_sessions.map((session) => (
                          <div key={session.id} className="rounded-xl border border-gray-100 p-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-gray-900">{session.member_name}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(session.session_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                {session.plan_name ? ` • ${session.plan_name}` : ""}
                              </p>
                              {session.notes && <p className="text-sm text-gray-600 mt-1">{session.notes}</p>}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-[#9c4400]">₹{Number(session.amount || 0).toLocaleString("en-IN")}</p>
                              <p className="text-xs text-gray-500">Trainer share</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Select a Trainer</h3>
                  <p className="text-gray-500 text-sm">Choose a trainer from the list to start marking attendance.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ icon, label, value, tone = "gray" }) {
  const toneClasses = {
    gray: "border-gray-200 bg-gray-50 text-gray-900",
    blue: "border-[#f0813d]/10 bg-[#f0813d]/10 text-[#9c4400]",
    orange: "border-[#f0813d]/10 bg-[#f0813d]/10 text-[#9c4400]",
    orangeDeep: "border-[#f0813d]/10 bg-[#f0813d]/10 text-[#9c4400]",
  };

  return (
    <div className={`rounded-xl border p-3 ${toneClasses[tone] || toneClasses.gray}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-lg font-bold">{value}</p>
    </div>
  );
}