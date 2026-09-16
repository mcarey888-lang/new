export interface DurableTrackPoint {
  lat: number;
  lon: number;
  alt: number | null;
  ts: number;
  speed?: number | null;
  acc?: number | null;
}

export interface PointBatch {
  id: string;
  routeId: string;
  points: DurableTrackPoint[];
}

export interface HikeCheckpoint {
  userId?: string;
  version: 2;
  routeId: string;
  routeName: string;
  status: "tracking" | "paused";
  trackPoints: DurableTrackPoint[];
  distanceKm: number;
  elevGainM: number;
  elevLossM: number;
  lastAltM: number | null;
  currentAltM: number | null;
  trackStartMs: number;
  totalPausedMs: number;
  pauseStartMs: number;
  trackingMode: string | null;
  expeditionId: string | null;
  syncState?: "local_only" | "queued" | "synced";
  hillMeta: Record<string, unknown>;
  savedAt: number;
}

export function batchStorageKey(routeId: string, now: number, nonce: string): string {
  return `hike_bg_batch_${routeId}_${now}_${nonce}`;
}

export function selectBatchKeys(keys: readonly string[], routeId: string): string[] {
  const prefix = `hike_bg_batch_${routeId}_`;
  return keys.filter(key => key.startsWith(prefix)).sort();
}

/** Acknowledges only the immutable batches included in the foreground snapshot. */
export function acknowledgeBatchKeys(
  availableKeys: string[],
  processedKeys: string[],
): string[] {
  const processed = new Set(processedKeys);
  return availableKeys.filter(key => !processed.has(key));
}

export function flattenBatches(batches: PointBatch[], routeId: string): DurableTrackPoint[] {
  const byTimestamp = new Map<number, DurableTrackPoint>();
  for (const batch of batches) {
    if (batch.routeId !== routeId) continue;
    for (const point of batch.points) byTimestamp.set(point.ts, point);
  }
  return [...byTimestamp.values()].sort((a, b) => a.ts - b.ts);
}

export function checkpointElapsedSecs(checkpoint: HikeCheckpoint, now: number): number {
  const livePause = checkpoint.status === "paused" && checkpoint.pauseStartMs > 0
    ? now - checkpoint.pauseStartMs
    : 0;
  return Math.max(0, Math.floor(
    (now - checkpoint.trackStartMs - checkpoint.totalPausedMs - livePause) / 1000,
  ));
}

export function shouldRestoreCheckpoint(
  checkpoint: Pick<HikeCheckpoint, "routeId" | "savedAt">,
  options: { now: number; restoreRequested: boolean; requestedRouteId?: string | null },
): boolean {
  if (options.now - checkpoint.savedAt > 24 * 60 * 60 * 1000) return false;
  return options.restoreRequested || (
    !!options.requestedRouteId && checkpoint.routeId === options.requestedRouteId
  );
}