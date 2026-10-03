import { distanceM, nearestOnRoute, type RoutePoint } from "./offRoute";

/**
 * How far along a route somebody has got, and how much climbing is left.
 *
 * NOT DISTANCE WALKED
 * -------------------
 * The obvious measure — add up the GPS track — answers a different question.
 * Somebody who walks to a col, back for a dropped glove, and on again has
 * covered more ground than the route has, and a progress bar driven by that
 * would show them further along than they are. Worse, it never goes backwards,
 * so a wrong turn reads as progress.
 *
 * This projects the current position onto the route and measures along the
 * route to that point. It is the honest answer to "where am I on this walk",
 * and it falls as well as rises, which a position genuinely does.
 *
 * WHEN IT DECLINES TO ANSWER
 * Far enough from the route and there is no meaningful "along" any more — the
 * nearest point might be a kilometre of walking from where they can actually
 * rejoin. Past a limit this reports no progress rather than a confident number
 * about a route the person has left.
 *
 * Pure and offline: the route and its profile are already on the device.
 */

export interface ProfileSample {
  distanceM: number;
  elevationM: number | null;
  /** Climbing done from the start to here, by the engine's own rule. Null
   *  where it is not known, which is not the same as zero. */
  cumulativeAscentM: number | null;
}

export interface RouteProgress {
  /** Metres along the route, measured on the route itself. */
  alongM: number;
  /** Total length of the route. */
  routeLengthM: number;
  /** 0–1. Clamped, because a position beyond the end is still the end. */
  fraction: number;
  /** How far the walker is from the route. */
  offRouteM: number;
}

/** Beyond this, "along the route" stops meaning anything useful. Deliberately
 *  generous: the off-route warning is the thing that tells somebody they have
 *  strayed, and this only needs to stop reporting nonsense. */
export const PROGRESS_MAX_OFF_ROUTE_M = 500;

/** Cumulative length of a route, one entry per point, starting at 0. */
export function cumulativeLengths(route: readonly RoutePoint[]): number[] {
  const out = new Array<number>(route.length).fill(0);
  for (let i = 1; i < route.length; i += 1) {
    out[i] = out[i - 1]! + distanceM(route[i - 1]!, route[i]!);
  }
  return out;
}

export function routeProgress(
  route: readonly RoutePoint[],
  position: RoutePoint,
): RouteProgress | null {
  if (route.length < 2) return null;

  const lengths = cumulativeLengths(route);
  const routeLengthM = lengths[lengths.length - 1]!;
  if (routeLengthM === 0) return null;

  /* The nearest point tells us how far off the route they are. Finding which
     segment it fell on tells us how far along — so both come from one pass
     rather than two that could disagree. */
  const nearest = nearestOnRoute(route, position);
  if (!nearest) return null;
  if (nearest.distanceM > PROGRESS_MAX_OFF_ROUTE_M) return null;

  let alongM = 0;
  let best = Infinity;
  for (let i = 1; i < route.length; i += 1) {
    const a = route[i - 1]!;
    const b = route[i]!;
    const segment = distanceM(a, b);
    if (segment === 0) continue;
    /* Distance from the segment, via the projected point. Recomputed here
       rather than carried, because the projection is cheap and the alternative
       is a second return value that can fall out of step. */
    const da = distanceM(a, position);
    const db = distanceM(b, position);
    const t = Math.max(0, Math.min(1, (da * da - db * db + segment * segment) / (2 * segment * segment)));
    const onSeg: RoutePoint = {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    };
    const d = distanceM(onSeg, position);
    if (d < best) {
      best = d;
      alongM = lengths[i - 1]! + segment * t;
    }
  }

  return {
    alongM,
    routeLengthM,
    fraction: Math.max(0, Math.min(1, alongM / routeLengthM)),
    offRouteM: nearest.distanceM,
  };
}

export interface AscentProgress {
  /** Climbing done up to this point on the route, by the route's own figures. */
  climbedM: number;
  /** The route's total. */
  totalM: number;
  /** What is left. Never negative. */
  remainingM: number;
}

/**
 * Climbing done and left, read from the route's own profile.
 *
 * Both numbers come from the profile, never from the recorded track. Mixing
 * them would subtract a barometer's idea of a climb from a terrain model's and
 * present the difference as metres remaining. The two measure the same hill by
 * different means and do not reconcile; the subtraction would be arithmetic on
 * incompatible units wearing the same name.
 *
 * Null when the profile cannot answer, which is not zero: a route whose
 * elevations never loaded has unknown climbing left, and showing "0 m
 * remaining" at the foot of a mountain is the worst possible wrong answer.
 */
export function ascentProgress(
  profile: readonly ProfileSample[] | null | undefined,
  alongM: number,
): AscentProgress | null {
  if (!profile || profile.length < 2) return null;
  const last = profile[profile.length - 1]!;
  if (typeof last.cumulativeAscentM !== "number") return null;
  const totalM = last.cumulativeAscentM;

  /* The sample at or before the position. Interpolating between samples would
     invent a climb rate inside a thirty-metre step the data does not describe. */
  let climbedM = 0;
  for (const sample of profile) {
    if (sample.distanceM > alongM) break;
    if (typeof sample.cumulativeAscentM === "number") climbedM = sample.cumulativeAscentM;
  }

  return {
    climbedM,
    totalM,
    remainingM: Math.max(0, totalM - climbedM),
  };
}

/**
 * Height on a drawn profile at a distance along it.
 *
 * Lives here rather than in the chart because it is arithmetic, and arithmetic
 * inside a component is arithmetic that does not get tested — this project's
 * test runner reads .ts and not .tsx, so a function in there is invisible to
 * it by construction.
 *
 * Interpolates between samples, which is not invented terrain: it is the same
 * straight run the chart already draws between two readings. A marker placed
 * anywhere else would sit off the curve it belongs to.
 *
 * Clamped at both ends. Continuing the last gradient past the final sample
 * would draw ground nobody measured.
 */
export function elevationAtDistance(
  points: readonly { distanceM: number; elevationM: number }[],
  distanceM: number,
): number | null {
  if (points.length === 0) return null;
  if (distanceM <= points[0]!.distanceM) return points[0]!.elevationM;
  const last = points[points.length - 1]!;
  if (distanceM >= last.distanceM) return last.elevationM;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (distanceM <= b.distanceM) {
      const span = b.distanceM - a.distanceM;
      if (span <= 0) return a.elevationM;
      return a.elevationM + (b.elevationM - a.elevationM) * ((distanceM - a.distanceM) / span);
    }
  }
  return last.elevationM;
}
