"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Fingerprint,
  LogIn,
  LogOut,
} from "lucide-react";
import Header from "@/components/layout/Header";

// Trainers punch on the same scanner as members. The first punch of a day is
// their check-in and every later punch moves the check-out forward, so a day
// row shows first-in / last-out.
//
// This screen is the trainer's own view of that — the admin equivalent lives at
// /settings/trainers/attendance.

const getStoredTrainer = () => {
  if (typeof window === "undefined") return null;
  try {
    const user = JSON.parse(localStorage.getItem("gymUser") || "null");
    return user?.role === "trainer" ? user : null;
  } catch {
    return null;
  }
};

const monthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatHours = (hours) => {
  const total = Number(hours || 0);
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  if (h === 0 && m === 0) return "0h";
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const formatDay = (dateStr) => {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : String(d.getDate()).padStart(2, "0");
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

export default function TrainerAttendancePage() {
  const router = useRouter();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAttendance = useCallback(async () => {
    const user = getStoredTrainer();
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trainers/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(user.id || ""),
        },
        body: JSON.stringify({
          p_gym_id: user.gym_id,
          p_trainer_id: user.id,
          p_month: `${month}-01`,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load attendance");
      setData(json.data || null);
    } catch (e) {
      setError(e.message || "Could not load attendance");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month, router]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const shiftMonth = (delta) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    // Attendance can't exist in the future, so don't let the user page into it.
    if (d > new Date()) return;
    setMonth(monthKey(d));
  };

  const summary = data?.summary;
  const days = useMemo(
    () =>
      (data?.attendance_days || [])
        .filter((d) => (d.sessions || []).length > 0)
        .sort((a, b) => String(b.attendance_date).localeCompare(String(a.attendance_date))),
    [data],
  );

  const today = useMemo(
    () => (data?.attendance_days || []).find((d) => d.attendance_date === todayKey()),
    [data],
  );
  const todaySession = today?.sessions?.[0];

  const isCurrentMonth = month === monthKey(new Date());

  return (
    <div className="min-h-screen bg-[#f6f3f1] text-[#1a1c1c] safe-area-inset-bottom pb-24">
      <Header title="My Attendance" />

      <main className="px-3 py-4 space-y-4 max-w-3xl mx-auto w-full">
        {/* Month picker */}
        <div className="flex items-center justify-between rounded-[20px] bg-white border border-[#ececec] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="p-2 rounded-xl text-gray-600 active:scale-95 transition-transform"
            aria-label="Previous month"
            style={{ minHeight: "44px", minWidth: "44px" }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="text-sm font-bold text-gray-900">
            {data?.month?.label || month}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            className="p-2 rounded-xl text-gray-600 disabled:opacity-30 active:scale-95 transition-transform"
            aria-label="Next month"
            style={{ minHeight: "44px", minWidth: "44px" }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="rounded-[24px] bg-white border border-[#ececec] p-8 text-center">
            <p className="text-sm text-gray-500">Loading…</p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[24px] border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Today */}
            {isCurrentMonth && (
              <div className="rounded-[24px] bg-white border border-[#ececec] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-2 mb-3">
                  <Fingerprint className="w-4 h-4 text-[#f0813d]" />
                  <p className="text-sm font-bold text-gray-900">Today</p>
                </div>

                {todaySession ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[#f6f3f1] p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <LogIn className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-xs text-gray-500 font-medium">Check in</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {todaySession.check_in_time || "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#f6f3f1] p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <LogOut className="w-3.5 h-3.5 text-[#f0813d]" />
                        <span className="text-xs text-gray-500 font-medium">Check out</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {todaySession.check_out_time || "Still in"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No punch yet today. Put your finger on the scanner to check in.
                  </p>
                )}
              </div>
            )}

            {/* Month summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[24px] bg-white border border-[#ececec] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <CalendarCheck className="w-4 h-4 text-[#f0813d]" />
                  <span className="text-xs text-gray-500 font-medium">Days worked</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {summary?.worked_days ?? 0}
                  <span className="text-sm font-medium text-gray-400">
                    {" "}
                    / {summary?.working_days ?? 0}
                  </span>
                </p>
              </div>

              <div className="rounded-[24px] bg-white border border-[#ececec] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-4 h-4 text-[#f0813d]" />
                  <span className="text-xs text-gray-500 font-medium">Hours</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatHours(summary?.worked_hours)}
                  <span className="text-sm font-medium text-gray-400">
                    {" "}
                    / {formatHours(summary?.expected_hours)}
                  </span>
                </p>
              </div>
            </div>

            {/* Day by day */}
            <div className="rounded-[24px] bg-white border border-[#ececec] shadow-[0_10px_30px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#ececec]">
                <p className="text-sm font-bold text-gray-900">Day by day</p>
              </div>

              {days.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-gray-500">No attendance recorded this month.</p>
                </div>
              ) : (
                <ul className="divide-y divide-[#f0eeec]">
                  {days.map((day) => (
                    <li key={day.attendance_date} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 shrink-0 text-center">
                          <p className="text-lg font-bold text-gray-900 leading-none">
                            {formatDay(day.attendance_date)}
                          </p>
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">
                            {(day.weekday_name || "").slice(0, 3)}
                          </p>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          {(day.sessions || []).map((s) => (
                            <div
                              key={s.id || s.session_number}
                              className="flex items-center gap-2 text-sm text-gray-700"
                            >
                              <LogIn className="w-3.5 h-3.5 text-green-600 shrink-0" />
                              <span className="font-medium">{s.check_in_time || "—"}</span>
                              <LogOut className="w-3.5 h-3.5 text-[#f0813d] shrink-0 ml-1" />
                              <span className="font-medium">
                                {s.check_out_time || "Still in"}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-[#f0813d]">
                            {formatHours((day.worked_minutes || 0) / 60)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
