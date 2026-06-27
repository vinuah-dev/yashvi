"use client";

import {
  ATTENDANCE_HOUR_OPTIONS,
  ATTENDANCE_MERIDIEM_OPTIONS,
  ATTENDANCE_MINUTE_OPTIONS,
} from "@/lib/utils/trainerAttendance";

export default function AttendanceTimePicker({
  label,
  parts,
  disabled = false,
  onPartChange,
  onClear,
}) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-2.5 sm:border-0 sm:bg-transparent sm:p-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="text-[11px] font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          Clear
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 min-w-0 sm:grid-cols-3">
        <select
          value={parts?.hour || ""}
          onChange={(e) => onPartChange("hour", e.target.value)}
          disabled={disabled}
          className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-transparent"
        >
          <option value="">Hour</option>
          {ATTENDANCE_HOUR_OPTIONS.map((hour) => (
            <option key={hour} value={hour}>{hour}</option>
          ))}
        </select>

        <select
          value={parts?.minute || ""}
          onChange={(e) => onPartChange("minute", e.target.value)}
          disabled={disabled}
          className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-transparent"
        >
          <option value="">Min</option>
          {ATTENDANCE_MINUTE_OPTIONS.map((minute) => (
            <option key={minute} value={minute}>{minute}</option>
          ))}
        </select>

        <select
          value={parts?.meridiem || ""}
          onChange={(e) => onPartChange("meridiem", e.target.value)}
          disabled={disabled}
          className="col-span-2 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-transparent sm:col-span-1"
        >
          <option value="">AM/PM</option>
          {ATTENDANCE_MERIDIEM_OPTIONS.map((meridiem) => (
            <option key={meridiem} value={meridiem}>{meridiem}</option>
          ))}
        </select>
      </div>
    </div>
  );
}