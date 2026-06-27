export const TRAINER_ATTENDANCE_SESSIONS = [
  { sessionNumber: 1, label: "Morning Session" },
  { sessionNumber: 2, label: "Evening Session" },
];

export const ATTENDANCE_HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => `${index + 1}`);
export const ATTENDANCE_MINUTE_OPTIONS = ["00", "15", "30", "45"];
export const ATTENDANCE_MERIDIEM_OPTIONS = ["AM", "PM"];

export function createEmptyTimeParts() {
  return { hour: "", minute: "", meridiem: "" };
}

export function hasAnyTimeParts(parts) {
  return Boolean(parts?.hour || parts?.minute || parts?.meridiem);
}

export function areTimePartsComplete(parts) {
  return Boolean(parts?.hour && parts?.minute && parts?.meridiem);
}

export function toTimeParts(value) {
  if (!value) {
    return createEmptyTimeParts();
  }

  const [hourValue, minuteValue = "00"] = String(value).split(":");
  const hour24 = Number(hourValue);

  if (!Number.isFinite(hour24)) {
    return createEmptyTimeParts();
  }

  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  return {
    hour: `${hour12}`,
    minute: minuteValue.padStart(2, "0").slice(0, 2),
    meridiem,
  };
}

export function fromTimeParts(parts) {
  if (!hasAnyTimeParts(parts)) {
    return "";
  }

  if (!areTimePartsComplete(parts)) {
    return null;
  }

  const hour12 = Number(parts.hour);
  const minute = String(parts.minute || "00").padStart(2, "0");

  if (!Number.isFinite(hour12) || hour12 < 1 || hour12 > 12) {
    return null;
  }

  let hour24 = hour12 % 12;
  if (parts.meridiem === "PM") {
    hour24 += 12;
  }

  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

export function formatHoursFromMinutes(minutes) {
  const hours = Number(minutes || 0) / 60;
  const rounded = Number(hours.toFixed(2));
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
}

export function formatHoursLabel(minutes) {
  return `${formatHoursFromMinutes(minutes)} hrs`;
}

export function isSessionEmpty(session) {
  return !session?.checkIn && !session?.checkOut;
}

export function validateSessionTimes(checkIn, checkOut) {
  const checkInValue = typeof checkIn === "string" ? checkIn : fromTimeParts(checkIn);
  const checkOutValue = typeof checkOut === "string" ? checkOut : fromTimeParts(checkOut);
  const hasCheckIn = typeof checkIn === "string" ? Boolean(checkIn) : hasAnyTimeParts(checkIn);
  const hasCheckOut = typeof checkOut === "string" ? Boolean(checkOut) : hasAnyTimeParts(checkOut);

  if (!hasCheckIn && !hasCheckOut) {
    return null;
  }

  if ((hasCheckIn && !checkInValue) || (hasCheckOut && !checkOutValue)) {
    return "Complete hour, minute, and AM/PM for both times";
  }

  if (!checkInValue || !checkOutValue) {
    return "Both check in and check out are required";
  }

  if (checkOutValue <= checkInValue) {
    return "Check out must be after check in";
  }

  return null;
}

export function buildAttendanceDrafts(attendanceDays) {
  const drafts = {};

  for (const day of attendanceDays || []) {
    const base = {
      1: { id: null, notes: "", checkInParts: createEmptyTimeParts(), checkOutParts: createEmptyTimeParts() },
      2: { id: null, notes: "", checkInParts: createEmptyTimeParts(), checkOutParts: createEmptyTimeParts() },
    };

    for (const session of day.sessions || []) {
      base[session.session_number] = {
        id: session.id || null,
        notes: session.notes || "",
        checkInParts: toTimeParts(session.check_in_time || ""),
        checkOutParts: toTimeParts(session.check_out_time || ""),
      };
    }

    drafts[day.attendance_date] = base;
  }

  return drafts;
}