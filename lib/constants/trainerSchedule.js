// Trainer scheduling constants used across forms and modals

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// All possible 1-hour time slots (covers full gym operating hours)
export const ALL_TIME_SLOTS = [
  "5-6 AM",
  "6-7 AM",
  "7-8 AM",
  "8-9 AM",
  "9-10 AM",
  "10-11 AM",
  "11-12 PM",
  "12-1 PM",
  "1-2 PM",
  "2-3 PM",
  "3-4 PM",
  "4-5 PM",
  "5-6 PM",
  "6-7 PM",
  "7-8 PM",
  "8-9 PM",
  "9-10 PM",
];

/**
 * Generate empty time slots object for selected days
 * @param {string[]} days - Array of day names
 * @param {Object} existing - Existing time slots to preserve
 * @returns {Object} Day-keyed object with time slot arrays
 */
export function buildTimeSlotsForDays(days, existing = {}) {
  const slots = {};
  for (const day of days) {
    slots[day] = existing[day] || [];
  }
  return slots;
}

/**
 * Format cost in INR
 * @param {number} cost - Cost in INR
 * @returns {string} Formatted string like "₹500/hour"
 */
export function formatTrainerCost(cost) {
  if (!cost && cost !== 0) return "N/A";
  return `₹${cost.toLocaleString("en-IN")}/hour`;
}
