/**
 * Repair hikes recorded by a build that stored seconds in a minutes field.
 *
 * The original repair divided anything over 300 by 60. That number is five
 * hours, which is an ordinary day on a Munro — so a six-hour walk recorded as
 * 360 minutes was rewritten to 6. The result was then written back to storage
 * by the next save, and 6 is under the threshold, so it never ran again: the
 * real duration was gone for good, from exactly the long mountain days this
 * app exists to record. Readiness and the Elevation Bank read the same field,
 * so the loss spread past the hike list.
 *
 * The replacement only touches values that cannot be a duration in minutes.
 */

/** A full day. Past this, minutes is not a plausible reading. */
export const MAX_PLAUSIBLE_MINUTES = 1440;

/**
 * Pace below which a reading cannot be minutes.
 *
 * A person on a hill covers a kilometre in something like 8 to 40 minutes,
 * slower when it is steep or dark. Three hundred minutes per kilometre is not
 * walking, and a value that extreme is the seconds-for-minutes fault showing
 * up in a hike too short for the duration test alone to catch.
 */
export const IMPOSSIBLE_MINUTES_PER_KM = 300;

export interface DurationRecord {
  timeTaken: number;
  distance?: number;
}

/**
 * Whether a stored duration is certainly seconds rather than minutes.
 *
 * Deliberately narrow. Where a value could honestly be either, it is left
 * alone: showing one implausibly long hike is a visible oddity the owner can
 * correct, and silently dividing a real one by sixty is data destroyed
 * without anybody being told.
 */
export function looksLikeSeconds(hike: DurationRecord): boolean {
  const minutes = hike.timeTaken;
  if (!Number.isFinite(minutes) || minutes <= 0) return false;
  if (minutes > MAX_PLAUSIBLE_MINUTES) return true;

  /* Below a day, the duration alone cannot settle it, so the distance has to.
     Without a usable distance there is nothing to check it against, and the
     reading stands. */
  const km = hike.distance;
  if (typeof km !== "number" || !Number.isFinite(km) || km <= 0) return false;
  return minutes / km >= IMPOSSIBLE_MINUTES_PER_KM;
}

/** Convert one record, if and only if it is certainly seconds. */
export function repairDuration<T extends DurationRecord>(hike: T): T {
  return looksLikeSeconds(hike)
    ? { ...hike, timeTaken: Math.max(1, Math.round(hike.timeTaken / 60)) }
    : hike;
}

/** Convert a stored list on load. */
export function repairDurations<T extends DurationRecord>(hikes: T[]): T[] {
  return hikes.map(repairDuration);
}
