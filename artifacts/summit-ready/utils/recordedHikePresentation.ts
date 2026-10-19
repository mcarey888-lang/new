/** Presentation only: never changes stored measurements or activity credit. */
export type RecordedPoint = { lat: number; lon: number; alt?: number | null };
type HikeFigures = {
  trackPoints?: readonly RecordedPoint[];
  distance?: number;
  elevationGain?: number;
  notes?: string;
};

export function hasRecordedRoute(points?: readonly RecordedPoint[]): boolean {
  return (points?.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)).length ?? 0) >= 2;
}

export function recordedMetricAvailability(hike: HikeFigures) {
  const route = hasRecordedRoute(hike.trackPoints);
  return {
    distance: route || (hike.distance ?? 0) > 0,
    ascent: (hike.elevationGain ?? 0) > 0 || (route
      && (hike.trackPoints?.filter(p => p.alt != null && Number.isFinite(p.alt)).length ?? 0) >= 2),
  };
}

export const TIME_ONLY_NOTES = "Time-only recording — no GPS track.";

export function buildRecordedHikeNotes(input: HikeFigures & {
  elevationLoss: number;
  elapsedSecs: number;
}): string {
  const route = hasRecordedRoute(input.trackPoints);
  if (!route && !((input.distance ?? 0) > 0 || (input.elevationGain ?? 0) > 0)) return TIME_ONLY_NOTES;
  const speed = input.elapsedSecs > 0 && (input.distance ?? 0) > 0
    ? (input.distance! / (input.elapsedSecs / 3600)).toFixed(1) : "—";
  const description = route ? "GPS tracked hike." : "Recording — no GPS track saved.";
  return `${description} Elevation loss: ${input.elevationLoss} m. Avg speed: ${speed} km/h.`;
}

/** Correct only the generated legacy description, without rewriting old data
 * or erasing user-added notes, manual figures, or partial-recording evidence. */
export function recordedHikeNotes(hike: HikeFigures): string {
  const notes = hike.notes ?? "";
  if (hasRecordedRoute(hike.trackPoints) || !notes.startsWith("GPS tracked hike.")) return notes;
  if ((hike.distance ?? 0) > 0 || (hike.elevationGain ?? 0) > 0) {
    return notes.replace("GPS tracked hike.", "Recording — no GPS track saved.");
  }
  return notes.replace(
    /^GPS tracked hike\.(?: Elevation loss: .*? m\. Avg speed: .*? km\/h\.)?/,
    TIME_ONLY_NOTES,
  );
}
