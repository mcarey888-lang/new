/**
 * Track presentation adapter — Journey 1 Part B.
 *
 * Derives the Track UI's view model from state the recording engine already
 * holds. It is PRESENTATION ONLY and deliberately has no access to anything
 * that could change recording semantics: no timers, no geolocation, no storage,
 * no network, no activity creation.
 *
 * The rules it enforces:
 *   · Start is never gated on anything. `canStart` is always true — there is no
 *     branch here that could make recording wait for a fix, a name, tiles, a
 *     backend or a network.
 *   · Missing data degrades to null, which the UI renders as an em dash. A
 *     prototype value is never substituted.
 *   · One physical activity keeps one id, from Start through Details.
 */

export type TrackStatus = "idle" | "tracking" | "paused" | "finished";
export type GpsQuality = "acquiring" | "good" | "weak" | "unavailable";

export interface TrackMetrics {
  elapsedSecs: number;
  distanceKm: number;
  elevGainM: number;
  currentAltM: number | null;
  paceMinPerKm: number | null;
}

/**
 * Start must never be conditional. This is a function rather than a constant so
 * the intent is greppable, and a test asserts it ignores every argument.
 */
export function canStartRecording(_ctx?: {
  isOffline?: boolean; hasFix?: boolean; hasRouteName?: boolean; hasNetwork?: boolean;
}): true {
  return true;
}

/** Human pace, or null when there is not enough movement to state one. */
export function paceMinPerKm(distanceKm: number, elapsedSecs: number): number | null {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(elapsedSecs)) return null;
  if (distanceKm <= 0.05 || elapsedSecs <= 0) return null;
  return (elapsedSecs / 60) / distanceKm;
}

export function formatPace(pace: number | null): string {
  if (pace === null || !Number.isFinite(pace) || pace <= 0) return "—";
  /* Round to whole seconds FIRST, then split. Rounding the seconds after
     taking the minute loses the carry: 5.999 min/km would print 5:00. */
  const totalSecs = Math.round(pace * 60);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

/** Any figure the engine has not produced shows as an em dash, never as 0. */
export function formatMetres(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "—" : `${Math.round(v)} m`;
}
export function formatKm(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v.toFixed(2)} km`;
}

/**
 * A figure split from its unit.
 *
 * The recording sheet prints the number large and the unit small beneath it,
 * the way every hill-walking recorder does, so these have to come apart. The
 * rules for rounding live here and only here — the joined-up `fmtKm` and
 * `fmtM` on the Track screen are built from these, so a figure cannot read one
 * way in the sheet and another in the same screen's prose.
 */
export interface SplitFigure {
  value: string;
  /** Lower case as stored. The sheet upper-cases it in the stylesheet. */
  unit: string;
}

/**
 * Under a kilometre the figure is given in metres: "420 m" is read at a glance
 * on a wet screen where "0.42 km" is not.
 */
export function splitDistance(km: number): SplitFigure {
  if (!Number.isFinite(km)) return { value: "—", unit: "km" };
  return km < 1
    ? { value: String(Math.round(km * 1000)), unit: "m" }
    : { value: km.toFixed(2), unit: "km" };
}

/** Metres, grouped, because an ungrouped 1284500 is unreadable. */
export function splitMetres(m: number): SplitFigure {
  if (!Number.isFinite(m)) return { value: "—", unit: "m" };
  return { value: Math.round(m).toLocaleString(), unit: "m" };
}

/** Pace, or an em dash when there is not yet enough movement to state one. */
export function splitPace(pace: number | null): SplitFigure {
  const formatted = formatPace(pace);
  if (formatted === "—") return { value: "—", unit: "/km" };
  return { value: formatted.replace(" /km", ""), unit: "/km" };
}

/** Status pill copy for the recording header. */
export function statusLabel(status: TrackStatus, isOffline: boolean): string {
  if (status === "paused") return "PAUSED";
  if (status === "finished") return "COMPLETE";
  if (status === "tracking") return isOffline ? "RECORDING · OFFLINE" : "RECORDING";
  return isOffline ? "READY · OFFLINE" : "READY";
}

/**
 * Offline is reported as a normal condition, not an error: recording works
 * either way, and the copy says so rather than implying something is broken.
 */
export function offlineNotice(isOffline: boolean, status: TrackStatus): string | null {
  if (!isOffline) return null;
  return status === "idle"
    ? "No signal. Recording works offline — your activity saves to this device."
    : "No signal. Still recording; this will sync when you are back online.";
}

export function gpsLabel(quality: GpsQuality): string {
  return { acquiring: "Finding GPS", good: "GPS good", weak: "GPS weak", unavailable: "GPS unavailable" }[quality];
}

/** Controls available in each phase. The engine owns the transitions. */
export function availableControls(status: TrackStatus): {
  start: boolean; pause: boolean; resume: boolean; finish: boolean;
} {
  return {
    start:  status === "idle",
    pause:  status === "tracking",
    resume: status === "paused",
    /* Finish stays available while paused — the engine supports it and
       removing it would strand a paused recording. */
    finish: status === "tracking" || status === "paused",
  };
}

/**
 * The context banner above the map: which session or route this recording
 * belongs to. Returns null when it was launched standalone.
 */
export function trackContext(meta: {
  hillName?: string | null; routeName?: string | null; sessionLabel?: string | null;
}): { title: string; subtitle: string | null } | null {
  const title = meta.sessionLabel?.trim() || meta.hillName?.trim();
  if (!title) return null;
  const subtitle = [meta.hillName?.trim() !== title ? meta.hillName?.trim() : null,
                    meta.routeName?.trim()].filter(Boolean).join(" · ") || null;
  return { title, subtitle };
}

/** Converts canonical GeoJSON longitude/latitude into the map's latitude/longitude tuples. */
export function canonicalRouteMapPoints(
  coordinates: ReadonlyArray<readonly [longitude: number, latitude: number]>,
): Array<[latitude: number, longitude: number]> {
  return coordinates.map(([longitude, latitude]) => [latitude, longitude]);
}

/**
 * Activity identity across the whole journey.
 *
 * The id is minted once at Start and carried unchanged through recording,
 * completion and details editing. This helper exists so a test can assert that
 * property directly, and so no screen is tempted to mint a second one.
 */
export function assertSameActivity(startId: string, laterId: string): boolean {
  return Boolean(startId) && startId === laterId;
}

/** Details editing works ON the stored activity — it never creates one. */
export interface ActivityDetailsDraft {
  activityId: string;
  name: string;
  notes: string;
  photoCount: number;
}
export function applyDetails(
  existing: { activityId: string; name: string; notes: string; photoCount: number },
  patch: Partial<Omit<ActivityDetailsDraft, "activityId">>,
): ActivityDetailsDraft {
  return {
    activityId: existing.activityId,          /* never reassigned */
    name: patch.name ?? existing.name,
    notes: patch.notes ?? existing.notes,
    photoCount: patch.photoCount ?? existing.photoCount,
  };
}

/** Approved Activity Details copy. */
export const ACTIVITY_DETAILS_COPY = {
  title: "Activity Details",
  subtitle: "Add photos, notes and details to your hike.",
  cta: "Save Details",
  /* Reassurance that the record already exists before this screen is used. */
  reassurance: "Saved to this device already — this just adds the detail.",
} as const;

/**
 * Track Ready has four questions to answer before the thumb reaches Start:
 * WHAT am I recording, WHERE, is the PHONE ready, and CAN I START.
 *
 * This answers the first two. Unlike `trackContext` it never returns null —
 * a free hike with nothing chosen is still a legitimate thing to record, and
 * saying so is better than leaving the question unanswered.
 *
 * It states only what the launch already knows. It never invents a place.
 */
export interface ReadyBrief {
  what: string;
  where: string;
  /** True when no route or hill was chosen — the screen says so plainly. */
  isOpenGround: boolean;
}

export function readyBrief(meta: {
  sessionLabel?: string | null;
  hillName?: string | null;
  routeName?: string | null;
  activityTitle?: string | null;
}): ReadyBrief {
  const session = meta.sessionLabel?.trim() || null;
  const hill = meta.hillName?.trim() || null;
  const route = meta.routeName?.trim() || null;
  const title = meta.activityTitle?.trim() || null;

  const what = session ?? hill ?? title ?? "Free hike";
  /* WHERE reports the route, and the hill only when the headline is not
     already the hill. With nothing chosen it says that plainly — it never
     claims open ground when a hill is in fact known. */
  const place = [route, hill !== what ? hill : null].filter(Boolean).join(" · ") || null;

  return {
    what,
    where: place ?? "No route chosen — record any path",
    isOpenGround: place === null,
  };
}
