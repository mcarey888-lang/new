/**
 * Pure client-side utility: maps a TrainingWeek's sessions to specific days of
 * the week based on the user's availableDays preference.
 *
 * Sessions are already ordered hills → cardio → bigDay by planGenerator.ts (unchanged).
 * Session[0] maps to availableDays[0], session[1] to availableDays[1], etc.
 * This file intentionally does NOT touch planGenerator.ts.
 */

export interface AssignedSession {
  sessionIdx: number;
  /** 0=Sunday, 1=Monday, …, 6=Saturday. null when no day preference is set. */
  dayOfWeek: number | null;
}

/**
 * Assign sessions to days. Days are sorted Mon-first within the week.
 * If there are more sessions than availableDays entries, the surplus get null.
 * If availableDays is empty/undefined, all sessions get null (fallback rendering).
 */
export function assignSessionsToDays(
  sessionCount: number,
  availableDays: number[] | undefined | null,
): AssignedSession[] {
  const sorted =
    availableDays && availableDays.length > 0
      ? [...availableDays].sort((a, b) => a - b)
      : [];

  return Array.from({ length: sessionCount }, (_, i) => ({
    sessionIdx: i,
    dayOfWeek: sorted[i] ?? null,
  }));
}

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DAY_FULL  = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

/** Returns today's day-of-week index (0=Sunday, …, 6=Saturday). */
export function todayDow(): number {
  return new Date().getDay();
}

/**
 * Given the week's startDate string ("YYYY-MM-DD") and a target day-of-week,
 * returns the "YYYY-MM-DD" for that day within the same calendar week.
 */
export function isoDateForDowInWeek(weekStartDate: string, targetDow: number): string {
  const start = new Date(weekStartDate + "T12:00:00");
  const diff = (targetDow - start.getDay() + 7) % 7;
  const d = new Date(start);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}
