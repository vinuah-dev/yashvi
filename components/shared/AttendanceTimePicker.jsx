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
  const hasValue = parts?.hour || parts?.minute || parts?.meridiem;

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        {hasValue && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-[10px] font-medium text-[#f0813d] hover:text-[#9c4400] disabled:opacity-40 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex items-center gap-1 bg-gray-50 rounded-xl border border-gray-200 px-2 py-1.5">
        {/* Hour */}
        <select
          value={parts?.hour || ""}
          onChange={(e) => onPartChange("hour", e.target.value)}
          disabled={disabled}
          className="flex-1 min-w-0 bg-transparent border-none text-sm font-semibold text-gray-800 focus:outline-none focus:ring-0 appearance-none text-center cursor-pointer disabled:opacity-50"
        >
          <option value="">--</option>
          {ATTENDANCE_HOUR_OPTIONS.map((hour) => (
            <option key={hour} value={hour}>{hour}</option>
          ))}
        </select>
        <span className="text-gray-400 font-bold text-sm select-none">:</span>
        {/* Minute */}
        <select
          value={parts?.minute || ""}
          onChange={(e) => onPartChange("minute", e.target.value)}
          disabled={disabled}
          className="flex-1 min-w-0 bg-transparent border-none text-sm font-semibold text-gray-800 focus:outline-none focus:ring-0 appearance-none text-center cursor-pointer disabled:opacity-50"
        >
          <option value="">--</option>
          {ATTENDANCE_MINUTE_OPTIONS.map((minute) => (
            <option key={minute} value={minute}>{minute}</option>
          ))}
        </select>
        {/* Divider */}
        <div className="w-px h-5 bg-gray-300 mx-0.5" />
        {/* Meridiem */}
        <select
          value={parts?.meridiem || ""}
          onChange={(e) => onPartChange("meridiem", e.target.value)}
          disabled={disabled}
          className="w-12 min-w-0 bg-transparent border-none text-xs font-bold text-[#9c4400] focus:outline-none focus:ring-0 appearance-none text-center cursor-pointer disabled:opacity-50"
        >
          <option value="">AM</option>
          {ATTENDANCE_MERIDIEM_OPTIONS.map((meridiem) => (
            <option key={meridiem} value={meridiem}>{meridiem}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
