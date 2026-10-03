/**
 * Telling somebody they have left their route.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ----------------------------------
 * It never says which way to walk. It says where you are relative to your
 * route — "80 m east of your route" — and stops there.
 *
 * That is not timidity. "Head west" asserts that west is walkable, and on a
 * mountain the straight line back to a path can run over a crag, a gully or a
 * cornice. Nothing in this data knows the difference. Stating a position is a
 * fact the person combines with what they can see; stating a direction is an
 * instruction they may follow in cloud.
 *
 * THE FAILURE THAT MATTERS IS THE FALSE ALARM
 * An alert that fires when nothing is wrong gets dismissed, and the habit of
 * dismissing it survives into the moment it is right. So this is slow to
 * speak: several fixes in a row must agree, the threshold widens when the
 * phone's own accuracy is poor, and a fix too noisy to conclude anything from
 * produces no conclusion rather than a guess.
 *
 * It is pure and offline. Everything it needs is the route already on the
 * device and the fix that just arrived.
 */

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface Fix extends RoutePoint {
  /** Horizontal accuracy in metres as the device reports it. Null or absent
   *  when unknown, which is treated as cautiously as a poor reading. */
  accuracyM?: number | null;
  /** Milliseconds. Only ordering matters, so any monotonic clock will do. */
  at: number;
}

export type OffRouteStatus = "on_route" | "off_route" | "unknown";

/** Eight points is as precise as this should ever sound. A bearing to the
 *  degree would imply a line somebody might try to walk. */
export type Compass = "north" | "north-east" | "east" | "south-east"
                    | "south" | "south-west" | "west" | "north-west";

export interface OffRouteReading {
  status: OffRouteStatus;
  /** Metres from the nearest point on the route, or null when not known. */
  distanceM: number | null;
  /** Where the walker is, as seen from the route. Never where to go. */
  bearing: Compass | null;
  /** The distance being judged against, which moves with GPS accuracy. */
  thresholdM: number | null;
  /** True only on the fix where the alert first fires, or escalates. The
   *  caller uses this to buzz or speak; `status` alone would repeat. */
  announce: boolean;
  /** A sentence to show. Null when there is nothing to say. */
  message: string | null;
}

/** Carried between fixes. Opaque to the caller, who just holds and returns it. */
export interface OffRouteMemory {
  status: OffRouteStatus;
  offStreak: number;
  onStreak: number;
  /** Distance at the last announcement, so a worsening situation can speak
   *  again without a steady one nagging. */
  announcedAtM: number | null;
}

export function initialMemory(): OffRouteMemory {
  return { status: "unknown", offStreak: 0, onStreak: 0, announcedAtM: null };
}

/**
 * Distance that counts as off-route with a perfect fix.
 *
 * 60 m is wider than any mountain path, and wide enough for the ordinary
 * wandering of someone picking a line through boulders. Narrower than this and
 * the alert fires on people who are plainly on their route.
 */
export const BASE_THRESHOLD_M = 60;

/** The threshold grows with the device's own uncertainty. A phone saying ±25 m
 *  cannot distinguish 60 m from 85 m, and alerting on that difference is
 *  alerting on noise. */
export const ACCURACY_MULTIPLE = 2.5;

/** With no accuracy reported, assume it is poor. Being slow to speak costs a
 *  late warning; being quick costs the warning's credibility. */
export const UNKNOWN_ACCURACY_M = 40;

/** Beyond this the fix says nothing useful about being 60 m from anything, so
 *  no conclusion is drawn from it at all. */
export const UNUSABLE_ACCURACY_M = 100;

/** Fixes in a row beyond the threshold before anything is said. */
export const FIXES_TO_ALERT = 3;
/** Fixes in a row back inside before it clears. */
export const FIXES_TO_CLEAR = 2;
/** Coming back must beat the threshold by this much, so somebody walking the
 *  boundary is not told alternately that they are on and off their route. */
export const CLEAR_FACTOR = 0.6;
/** Once announced, say nothing more until it has got this much worse. */
export const ESCALATE_FACTOR = 2;

const EARTH_RADIUS_M = 6371008.8;
const DEG = Math.PI / 180;

export function distanceM(a: RoutePoint, b: RoutePoint): number {
  const la1 = a.latitude * DEG;
  const la2 = b.latitude * DEG;
  const dla = la2 - la1;
  const dlo = (b.longitude - a.longitude) * DEG;
  const h = Math.sin(dla / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dlo / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Where along a→b the nearest point to p falls, clamped to the segment.
 *  Flat projection, which is exact enough over one segment of a route. */
function segmentT(p: RoutePoint, a: RoutePoint, b: RoutePoint, cosLat: number): number {
  const ax = a.longitude * cosLat, ay = a.latitude;
  const bx = b.longitude * cosLat, by = b.latitude;
  const px = p.longitude * cosLat, py = p.latitude;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  return Math.max(0, Math.min(1, t));
}

export interface NearestOnRoute {
  point: RoutePoint;
  distanceM: number;
}

/**
 * The nearest point on the route, and how far away it is.
 *
 * Every segment is tested. A route is a few thousand points at most and this
 * runs once per GPS fix, so an index would be complexity bought with nothing.
 */
export function nearestOnRoute(route: readonly RoutePoint[], fix: RoutePoint): NearestOnRoute | null {
  if (route.length === 0) return null;
  if (route.length === 1) {
    return { point: route[0]!, distanceM: distanceM(route[0]!, fix) };
  }
  const cosLat = Math.cos(fix.latitude * DEG);
  let best: NearestOnRoute | null = null;
  for (let i = 1; i < route.length; i += 1) {
    const a = route[i - 1]!;
    const b = route[i]!;
    const t = segmentT(fix, a, b, cosLat);
    const point: RoutePoint = {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    };
    const d = distanceM(point, fix);
    if (best === null || d < best.distanceM) best = { point, distanceM: d };
  }
  return best;
}

/** Compass direction from `from` to `to`, to eight points. */
export function bearingBetween(from: RoutePoint, to: RoutePoint): Compass {
  const la1 = from.latitude * DEG, la2 = to.latitude * DEG;
  const dlo = (to.longitude - from.longitude) * DEG;
  const y = Math.sin(dlo) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dlo);
  const deg = (Math.atan2(y, x) / DEG + 360) % 360;
  const points: Compass[] = [
    "north", "north-east", "east", "south-east",
    "south", "south-west", "west", "north-west",
  ];
  return points[Math.round(deg / 45) % 8]!;
}

/** The distance being judged against, for this fix's reported accuracy. */
export function thresholdFor(accuracyM: number | null | undefined): number {
  const accuracy = typeof accuracyM === "number" && Number.isFinite(accuracyM) && accuracyM >= 0
    ? accuracyM
    : UNKNOWN_ACCURACY_M;
  return Math.max(BASE_THRESHOLD_M, Math.round(accuracy * ACCURACY_MULTIPLE));
}

const quiet = (status: OffRouteStatus): OffRouteReading => ({
  status, distanceM: null, bearing: null, thresholdM: null, announce: false, message: null,
});

/**
 * Take one fix and say whether the walker is off their route.
 *
 * Pure: the caller holds the memory and passes it back. Nothing here reads a
 * clock, touches storage, or fires anything — which is what makes a whole walk
 * testable as a list of positions.
 */
export function assess(
  memory: OffRouteMemory,
  route: readonly RoutePoint[],
  fix: Fix,
): { memory: OffRouteMemory; reading: OffRouteReading } {
  /* No route to be off. Free hikes are a normal and supported thing to be
     doing, and they must not produce an alert about leaving a route that was
     never chosen. */
  if (route.length < 2) {
    return { memory: { ...initialMemory() }, reading: quiet("unknown") };
  }

  const accuracy = typeof fix.accuracyM === "number" && Number.isFinite(fix.accuracyM)
    ? fix.accuracyM : null;

  /* Too noisy to conclude anything. The streaks are left exactly as they were:
     a bad fix must neither raise an alarm nor clear one, because it is not
     evidence either way. */
  if (accuracy !== null && accuracy > UNUSABLE_ACCURACY_M) {
    return { memory, reading: quiet(memory.status) };
  }

  const nearest = nearestOnRoute(route, fix);
  if (!nearest) return { memory, reading: quiet("unknown") };

  const thresholdM = thresholdFor(accuracy);
  const beyond = nearest.distanceM > thresholdM;
  const wellInside = nearest.distanceM <= thresholdM * CLEAR_FACTOR;

  let { status, offStreak, onStreak, announcedAtM } = memory;
  offStreak = beyond ? offStreak + 1 : 0;
  onStreak = wellInside ? onStreak + 1 : 0;

  let announce = false;

  if (status !== "off_route" && offStreak >= FIXES_TO_ALERT) {
    status = "off_route";
    announce = true;
    announcedAtM = nearest.distanceM;
  } else if (status === "off_route" && onStreak >= FIXES_TO_CLEAR) {
    status = "on_route";
    announcedAtM = null;
  } else if (status === "off_route" && announcedAtM !== null
             && nearest.distanceM >= announcedAtM * ESCALATE_FACTOR) {
    /* Getting steadily further away is new information. Repeating the same
       distance is not, and would be the nagging that teaches people to ignore
       this. */
    announce = true;
    announcedAtM = nearest.distanceM;
  } else if (status === "unknown" && !beyond) {
    status = "on_route";
  }

  const bearing = bearingBetween(nearest.point, fix);
  const rounded = Math.round(nearest.distanceM / 10) * 10;

  return {
    memory: { status, offStreak, onStreak, announcedAtM },
    reading: {
      status,
      distanceM: Math.round(nearest.distanceM),
      bearing,
      thresholdM,
      announce,
      /* Where they are, never where to go. The rounding is honest about the
         precision: "80 m" claims what the data supports, "83 m" does not. */
      message: status === "off_route"
        ? `${rounded} m ${bearing} of your route`
        : null,
    },
  };
}
