import type { RoutePoint } from "./offRoute";

/**
 * Downloaded map regions, and whether a walk is covered by one.
 *
 * THE QUESTION THIS EXISTS TO ANSWER
 * ----------------------------------
 * Not "have I downloaded some maps" but "will the map work where I am going".
 * Those come apart badly: somebody who downloaded a region last month and is
 * driving to a different valley has maps, and has no maps for the walk, and
 * the app is the only thing in a position to notice before they set off.
 *
 * So coverage is decided against the route, not against a vague idea of
 * nearby, and partial coverage is reported as partial. An offline map that
 * stops halfway up is more dangerous than no offline map at all, because the
 * second one gets checked and the first one gets trusted.
 *
 * Pure: every function here is arithmetic on a list the caller holds. Nothing
 * reads a filesystem or a network, so the rules can be tested without either.
 */

export interface BBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export type RegionStatus =
  /** Never fetched. */
  | "absent"
  /** Fetching now. `progress` is 0–1 where it is known. */
  | "downloading"
  /** On the device and usable. */
  | "ready"
  /** On the device but the data behind it has moved on. Still usable — stale
   *  paths are better than no paths — so this is a prompt, not a block. */
  | "stale"
  /** Started and did not finish. Whatever arrived cannot be trusted. */
  | "failed";

export interface OfflineRegion {
  id: string;
  /** What the person chose, in their words. */
  name: string;
  bounds: BBox;
  status: RegionStatus;
  /** Bytes on the device. Null until something has actually been written —
   *  never an estimate dressed as a measurement. */
  bytes: number | null;
  /** 0–1 while downloading, null when not known. A spinner is honest; a
   *  progress bar that invents a position is not. */
  progress?: number | null;
  /** When the data behind it was published, for deciding staleness. */
  dataPublishedAt?: string | null;
}

/** Only a region in this state can draw a map. */
export function isUsable(region: OfflineRegion): boolean {
  return region.status === "ready" || region.status === "stale";
}

export function containsPoint(bounds: BBox, point: RoutePoint): boolean {
  return point.latitude >= bounds.minLat && point.latitude <= bounds.maxLat
      && point.longitude >= bounds.minLng && point.longitude <= bounds.maxLng;
}

export type Coverage =
  /** Every point of the route is inside a usable region. */
  | { kind: "covered"; regionIds: string[] }
  /**
   * Some of the route is not. `coveredFraction` is of the points, not the
   * distance — cheaper, and the number is only ever used to say "most of" or
   * "part of", never as a measurement.
   */
  | { kind: "partial"; coveredFraction: number; firstGapIndex: number; regionIds: string[] }
  | { kind: "none" }
  /** No route to check. Not the same as uncovered, and must not be shown as a
   *  warning — somebody browsing the map has not planned anything yet. */
  | { kind: "no_route" };

/**
 * Whether a route is covered by the regions on the device.
 *
 * Checks every point rather than the route's bounding box. A box around a
 * route that bends round a ridge includes ground the route never touches, and
 * a region covering that ground would be reported as covering the walk.
 */
export function routeCoverage(
  regions: readonly OfflineRegion[],
  route: readonly RoutePoint[],
): Coverage {
  if (route.length === 0) return { kind: "no_route" };

  const usable = regions.filter(isUsable);
  if (usable.length === 0) return { kind: "none" };

  const used = new Set<string>();
  let covered = 0;
  let firstGapIndex = -1;

  for (let i = 0; i < route.length; i += 1) {
    const point = route[i]!;
    const region = usable.find(r => containsPoint(r.bounds, point));
    if (region) {
      covered += 1;
      used.add(region.id);
    } else if (firstGapIndex === -1) {
      firstGapIndex = i;
    }
  }

  if (covered === 0) return { kind: "none" };
  if (covered === route.length) return { kind: "covered", regionIds: [...used] };
  return {
    kind: "partial",
    coveredFraction: covered / route.length,
    firstGapIndex,
    regionIds: [...used],
  };
}

/**
 * What to tell somebody about to set off, or null when there is nothing to say.
 *
 * Silence when the whole route is covered: an app that congratulates itself
 * for working is an app people stop reading. The warnings are deliberately
 * blunt, because this is read in a car park before signal disappears.
 */
export function coverageWarning(coverage: Coverage): string | null {
  switch (coverage.kind) {
    case "covered":
    case "no_route":
      return null;
    case "none":
      return "No offline map for this route. The map will not work without a signal.";
    case "partial":
      /* Said as a fraction of the route rather than a percentage, because
         "most of" is what somebody needs to decide, and a precise-looking
         number invites a precision this does not have. */
      return coverage.coveredFraction >= 0.9
        ? "Part of this route has no offline map."
        : "Most of this route has no offline map.";
  }
}

export interface StorageSummary {
  /** Bytes across every region that has any. */
  totalBytes: number;
  readyCount: number;
  /** Regions started and not finished. Worth surfacing: a failed download
   *  leaves a person believing they have a map they do not have. */
  failedCount: number;
  downloadingCount: number;
}

export function storageSummary(regions: readonly OfflineRegion[]): StorageSummary {
  let totalBytes = 0;
  let readyCount = 0;
  let failedCount = 0;
  let downloadingCount = 0;
  for (const r of regions) {
    if (typeof r.bytes === "number" && Number.isFinite(r.bytes) && r.bytes > 0) {
      totalBytes += r.bytes;
    }
    if (r.status === "ready" || r.status === "stale") readyCount += 1;
    if (r.status === "failed") failedCount += 1;
    if (r.status === "downloading") downloadingCount += 1;
  }
  return { totalBytes, readyCount, failedCount, downloadingCount };
}

/**
 * Bytes as somebody reads them.
 *
 * Whole numbers past a gigabyte and one decimal below it, because the decision
 * being made is "will this fit on my phone" and nobody makes it to three
 * significant figures.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/**
 * How long a region's data may sit before it is worth refreshing.
 *
 * Paths change slowly, and a map three months old is a far better companion
 * than no map. Long enough that nobody is nagged, short enough that a new
 * right of way turns up within a season.
 */
export const STALE_AFTER_DAYS = 90;

export function isStale(
  region: Pick<OfflineRegion, "dataPublishedAt">,
  now: Date = new Date(),
): boolean {
  if (!region.dataPublishedAt) return false;
  const published = Date.parse(region.dataPublishedAt);
  /* An unparseable date is not evidence of staleness. Treating it as stale
     would nag somebody about a perfectly good map because a string was
     malformed. */
  if (!Number.isFinite(published)) return false;
  return now.getTime() - published > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}
