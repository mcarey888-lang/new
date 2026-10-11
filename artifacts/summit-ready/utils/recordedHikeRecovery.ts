import { createRecordedElevation, recordElevation } from "./recordedElevation";

export interface RecordedHikePoint {
  lat: number; lon: number;
  alt?: number | null; ts?: number; acc?: number | null; altAcc?: number | null;
}
export interface ElevationCorrection {
  algorithm: "gps-altitude-filter-v1";
  originalGainM: number; originalLossM?: number; originalNotes: string;
  filteredGainM: number; filteredLossM: number; appliedAt: string;
  usableFixes: number; totalFixes: number;
}
interface ReviewableHike {
  elevationGain: number; elevationLoss?: number; timeTaken: number; notes: string;
  trackPoints?: RecordedHikePoint[]; elevationCorrection?: ElevationCorrection;
}
export type AltitudeReview =
  | { available: false; reason: string }
  | { available: true; gain: number; loss: number; usableFixes: number; totalFixes: number; accuracyMissing: boolean };

/** Historical review never substitutes a summit height or planned route. */
export function reviewRecordedAltitude(hike: ReviewableHike): AltitudeReview {
  const points = hike.trackPoints ?? [];
  let state = createRecordedElevation();
  let usableFixes = 0;
  let firstTs: number | null = null;
  let lastTs: number | null = null;
  let accuracyMissing = false;
  for (const point of points) {
    if (point.alt == null || point.ts == null) continue;
    const next = recordElevation(state, { alt: point.alt, ts: point.ts, altAcc: point.altAcc });
    if (next.last !== state.last && next.last?.ts === point.ts) {
      usableFixes++;
      firstTs ??= point.ts;
      lastTs = point.ts;
      accuracyMissing ||= point.altAcc == null;
    }
    state = next;
  }
  const span = firstTs != null && lastTs != null ? lastTs - firstTs : 0;
  if (usableFixes < 20 || points.length === 0 || usableFixes / points.length < 0.7 ||
      span < 120_000 || (hike.timeTaken > 0 && span < hike.timeTaken * 60_000 * 0.7)) {
    return { available: false, reason: "There aren’t enough usable, timestamped altitude readings to correct this hike safely. Your original recording is unchanged." };
  }
  return {
    available: true, gain: Math.round(state.gain), loss: Math.round(state.loss),
    usableFixes, totalFixes: points.length, accuracyMissing,
  };
}

export function applyRecordedAltitudeReview<T extends ReviewableHike>(hike: T, appliedAt: string): T {
  if (hike.elevationCorrection) throw new Error("This recording has already been reviewed.");
  const review = reviewRecordedAltitude(hike);
  if (!review.available) throw new Error(review.reason);
  const originalLoss = hike.elevationLoss ??
    Number(hike.notes.match(/Elevation loss:\s*([\d.]+)\s*m/i)?.[1] ?? NaN);
  return {
    ...hike, elevationGain: review.gain, elevationLoss: review.loss,
    notes: hike.notes.replace(/Elevation loss:\s*[\d.]+\s*m/i, `Elevation loss: ${review.loss} m`) +
      "\nAltitude reprocessed from saved GPS readings. Filtered estimate, not verified elevation.",
    elevationCorrection: {
      algorithm: "gps-altitude-filter-v1", originalGainM: hike.elevationGain,
      originalLossM: Number.isFinite(originalLoss) ? originalLoss : undefined,
      originalNotes: hike.notes, filteredGainM: review.gain, filteredLossM: review.loss,
      appliedAt, usableFixes: review.usableFixes, totalFixes: review.totalFixes,
    },
  };
}

export function privateRecordedHikeBackup<T extends { id: string; backupRevision?: string; backedUpRevision?: string; syncState?: string }>(
  hike: T, revision = hike.backupRevision ?? new Date().toISOString(),
) {
  // Status on a particular phone is not evidence that the server accepted it.
  const { backedUpRevision: _backedUp, syncState: _sync, ...snapshot } = hike;
  return { hikeId: hike.id, revision, snapshot: { ...snapshot, backupRevision: revision } };
}
