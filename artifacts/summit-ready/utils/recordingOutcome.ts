/**
 * Whether a finished recording actually captured the walk.
 *
 * GPS fails quietly. Under tree cover, in a steep valley, or with location
 * switched off partway, the clock keeps running and the track does not. The
 * person comes back to a six-hour day recorded as two hundred metres, and the
 * app has no way to say so — the save looks the same as any other.
 *
 * Deliberately conservative. A short walk that genuinely was short must not be
 * called a failure, so this only fires where the time says somebody was out
 * and the track says they barely moved.
 */

/** Below this, nothing useful was recorded whatever the clock says. */
export const MIN_USEFUL_DISTANCE_KM = 0.3;

/** Under this, a short distance is simply a short walk. */
export const MIN_SUSPICIOUS_DURATION_SECS = 10 * 60;

export interface RecordingOutcome {
  pointCount: number;
  distanceKm: number;
  elapsedSecs: number;
}

export function recordingLooksFailed(outcome: RecordingOutcome): boolean {
  const { pointCount, distanceKm, elapsedSecs } = outcome;
  if (!Number.isFinite(elapsedSecs) || elapsedSecs <= 0) return false;

  /* Nothing at all, after any amount of time. Permission refused partway,
     or no fix was ever obtained. */
  if (pointCount <= 0) return elapsedSecs >= MIN_SUSPICIOUS_DURATION_SECS;

  /* Out long enough to have walked somewhere, with a track that says
     otherwise. */
  return elapsedSecs >= MIN_SUSPICIOUS_DURATION_SECS
    && Number.isFinite(distanceKm)
    && distanceKm < MIN_USEFUL_DISTANCE_KM;
}

/** What to tell them, or null when the recording is fine. */
export function recordingFailureNote(outcome: RecordingOutcome): string | null {
  if (!recordingLooksFailed(outcome)) return null;
  return outcome.pointCount <= 0
    ? "No GPS was recorded for this hike. You can enter it by hand instead."
    : "Very little was recorded for the time this took — the GPS may have dropped out. You can enter it by hand instead.";
}
