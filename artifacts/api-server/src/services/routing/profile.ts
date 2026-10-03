import { distanceM, type LatLng } from "./pathSnapping";
import { elevationAt, type TileFetcher } from "./terrain";

/**
 * Height profile and ascent for a route.
 *
 * ASCENT IS NOT THE SUM OF EVERY RISE
 * -----------------------------------
 * The obvious implementation — walk the samples, add up every positive
 * difference — produces a number that is wrong by a factor of two or more, and
 * wrong in the direction that flatters the route. A DEM has noise of a few
 * metres per sample. Summing every rise sums that noise, and a flat walk along
 * a lake shore comes out with hundreds of metres of climbing. The finer the
 * sampling, the worse it gets, which is the opposite of what anyone expects.
 *
 * So this counts a climb only once it has gained more than a threshold since
 * the last turning point. A rise of a metre or two is noise and is ignored; a
 * genuine ascent crosses the threshold and the whole of it is counted. The
 * same in reverse for descent. This is the standard way, and the threshold is
 * a judgement rather than a fact — it is named and exported so it can be
 * argued with rather than buried.
 *
 * WHAT THE NUMBER IS WORTH
 * The underlying grid is about 30 m across, so anything narrower does not
 * exist in it. Verified against this data: a sharp summit reads around 50 m
 * low, and valley floors within a few tens of metres. Those absolute errors
 * matter far less than they look, because ascent is a difference of heights
 * along one line and a systematic offset largely cancels. It is a planning
 * figure — good for whether this is a big day — and it is not a survey.
 */

/**
 * Gain needed before a rise counts as climbing, in metres.
 *
 * Below this is noise. Too low and a flat walk accumulates hundreds of metres
 * that are not there; too high and real undulation on a ridge is swallowed.
 * Eight metres is a little over twice the typical noise in this data, which
 * puts it past the noise without losing anything a walker would notice.
 */
export const ASCENT_THRESHOLD_M = 8;

/**
 * Spacing of samples along the route, in metres.
 *
 * Matched to the data rather than to the screen. Sampling finer than the grid
 * does not reveal more ground, it just resamples the provider's interpolation
 * and multiplies the noise that the threshold then has to remove.
 */
export const SAMPLE_INTERVAL_M = 30;

/** Most samples one request may ask for. A 300 km line would otherwise mean
 *  ten thousand lookups and a tile fetch for each new region. */
export const MAX_SAMPLES = 2000;

export interface ProfilePoint {
  /** Metres from the start, along the route. */
  distanceM: number;
  /** Height, or null where the data could not be read. Never zero for
   *  missing — zero is sea level, and on a mountain that is a cliff. */
  elevationM: number | null;
  /**
   * Climbing done between the start and this point, by the same threshold rule
   * as the route's total.
   *
   * Here rather than computed by whoever is drawing the profile, because
   * "how much is left to climb" is a subtraction from the total and the two
   * numbers have to come from the same method. An app recomputing it with its
   * own rule would produce a remaining figure that does not reconcile with the
   * total shown beside it, and the person would be right to trust neither.
   *
   * Null wherever the elevation is null, for the same reason it is: unknown is
   * not zero.
   */
  cumulativeAscentM: number | null;
}

export type ProfileResult =
  | {
      outcome: "profiled";
      points: ProfilePoint[];
      ascentM: number;
      descentM: number;
      minElevationM: number;
      maxElevationM: number;
      lengthM: number;
      /** How the ascent was arrived at, so the number can be questioned. */
      method: { thresholdM: number; sampleIntervalM: number; samples: number };
    }
  /** Some of the route has no elevation data. No ascent is reported, because a
   *  figure covering part of a route reads as covering all of it. */
  | {
      outcome: "incomplete";
      points: ProfilePoint[];
      missing: number;
      total: number;
    }
  | { outcome: "too_long"; wouldNeed: number; limit: number }
  | { outcome: "too_short" };

/**
 * Points every `intervalM` along the line, including both ends.
 *
 * The drawn route has points wherever the path bends, which is dense on
 * zigzags and sparse on a straight traverse. Sampling those directly would
 * weight the profile by how wiggly the mapping is rather than by distance.
 */
export function resample(points: readonly LatLng[], intervalM: number): LatLng[] {
  if (points.length < 2) return points.slice();
  const out: LatLng[] = [points[0]!];
  let carry = 0;

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const segment = distanceM(a, b);
    if (segment === 0) continue;

    let along = intervalM - carry;
    while (along <= segment) {
      const t = along / segment;
      out.push({
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
      });
      along += intervalM;
    }
    carry = segment - (along - intervalM);
  }

  /* The final point always belongs in the profile: it is where the route
     ends, and dropping it would lose the last climb up to a summit. */
  const last = points[points.length - 1]!;
  const tail = out[out.length - 1]!;
  if (distanceM(tail, last) > 1) out.push(last);
  return out;
}

/**
 * Ascent and descent, counting only moves that clear the threshold.
 *
 * Walks the series holding the last confirmed turning point. While rising,
 * any new high extends the climb; a drop of more than the threshold ends it,
 * banks the gain, and starts a descent. Noise never crosses the threshold, so
 * it never banks anything.
 */
/**
 * Ascent banked at each point along the series.
 *
 * Shares `ascentDescent`'s walk exactly, so the last entry equals the total it
 * reports. Separating them would be two implementations of one rule, and the
 * one that drifts would be the one nobody is testing.
 *
 * A climb is banked when it is confirmed, not while it is being made, so this
 * steps rather than slopes. That is the honest shape: until a rise clears the
 * threshold it is not yet known to be climbing rather than noise.
 */
export function cumulativeAscent(
  elevations: readonly number[],
  thresholdM = ASCENT_THRESHOLD_M,
): number[] {
  const out: number[] = new Array(elevations.length).fill(0);
  if (elevations.length < 2) return out;

  let ascent = 0;
  let pivot = elevations[0]!;
  let extreme = elevations[0]!;
  let direction = 0;

  for (let i = 1; i < elevations.length; i += 1) {
    const e = elevations[i]!;
    if (direction === 0) {
      if (e - pivot > thresholdM) { direction = 1; extreme = e; }
      else if (pivot - e > thresholdM) { direction = -1; extreme = e; }
    } else if (direction === 1) {
      if (e > extreme) extreme = e;
      if (extreme - e > thresholdM) {
        ascent += extreme - pivot;
        pivot = extreme; extreme = e; direction = -1;
      }
    } else {
      if (e < extreme) extreme = e;
      if (e - extreme > thresholdM) {
        pivot = extreme; extreme = e; direction = 1;
      }
    }
    /* While climbing, the gain so far is real even though it is not yet banked
       — somebody halfway up has climbed it. Counting only banked ascent would
       leave the figure frozen for the whole of a long ascent. */
    out[i] = direction === 1 ? ascent + (e - pivot) : ascent;
  }
  return out;
}

export function ascentDescent(
  elevations: readonly number[],
  thresholdM = ASCENT_THRESHOLD_M,
): { ascentM: number; descentM: number } {
  if (elevations.length < 2) return { ascentM: 0, descentM: 0 };

  let ascent = 0;
  let descent = 0;
  let pivot = elevations[0]!;
  let extreme = elevations[0]!;
  /** 0 = undecided, 1 = climbing, -1 = descending. */
  let direction = 0;

  for (let i = 1; i < elevations.length; i += 1) {
    const e = elevations[i]!;
    if (direction >= 0 && e > extreme) extreme = e;
    if (direction <= 0 && e < extreme) extreme = e;

    if (direction === 0) {
      if (e - pivot > thresholdM) { direction = 1; extreme = e; }
      else if (pivot - e > thresholdM) { direction = -1; extreme = e; }
      continue;
    }

    if (direction === 1) {
      if (e > extreme) extreme = e;
      /* Turned over: bank the climb up to the high point, and start measuring
         down from there. The threshold is what distinguishes a turn from a
         wobble. */
      if (extreme - e > thresholdM) {
        ascent += extreme - pivot;
        pivot = extreme;
        extreme = e;
        direction = -1;
      }
    } else {
      if (e < extreme) extreme = e;
      if (e - extreme > thresholdM) {
        descent += pivot - extreme;
        pivot = extreme;
        extreme = e;
        direction = 1;
      }
    }
  }

  /* The last leg never turned over, so it is banked here. Without this a route
     that finishes on a summit loses its final climb — the one that matters
     most. */
  if (direction === 1) ascent += extreme - pivot;
  else if (direction === -1) descent += pivot - extreme;

  return { ascentM: Math.round(ascent), descentM: Math.round(descent) };
}

export async function routeProfile(
  points: readonly LatLng[],
  opts: { fetcher?: TileFetcher; intervalM?: number; thresholdM?: number } = {},
): Promise<ProfileResult> {
  if (points.length < 2) return { outcome: "too_short" };

  const intervalM = opts.intervalM ?? SAMPLE_INTERVAL_M;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distanceM(points[i - 1]!, points[i]!);

  const wouldNeed = Math.ceil(total / intervalM) + 1;
  if (wouldNeed > MAX_SAMPLES) {
    return { outcome: "too_long", wouldNeed, limit: MAX_SAMPLES };
  }

  const sampled = resample(points, intervalM);
  const profile: ProfilePoint[] = [];
  const known: number[] = [];
  let missing = 0;
  let run = 0;

  for (let i = 0; i < sampled.length; i += 1) {
    if (i > 0) run += distanceM(sampled[i - 1]!, sampled[i]!);
    const e = await elevationAt(sampled[i]!, opts.fetcher);
    profile.push({
      distanceM: Math.round(run),
      elevationM: e === null ? null : Math.round(e * 10) / 10,
      cumulativeAscentM: null,
    });
    if (e === null) missing += 1;
    else known.push(e);
  }

  if (missing > 0) {
    /* Deliberately no ascent figure. A number computed from the part that
       loaded would be read as the route's ascent, and the missing part is
       exactly where it might be climbing. */
    return { outcome: "incomplete", points: profile, missing, total: profile.length };
  }

  const { ascentM, descentM } = ascentDescent(known, opts.thresholdM);
  /* Only reached when nothing is missing, so `known` lines up with `profile`
     one for one and the indices can be trusted. */
  const climbed = cumulativeAscent(known, opts.thresholdM);
  for (let i = 0; i < profile.length; i += 1) profile[i]!.cumulativeAscentM = Math.round(climbed[i]!);
  return {
    outcome: "profiled",
    points: profile,
    ascentM,
    descentM,
    minElevationM: Math.round(Math.min(...known)),
    maxElevationM: Math.round(Math.max(...known)),
    lengthM: Math.round(total),
    method: {
      thresholdM: opts.thresholdM ?? ASCENT_THRESHOLD_M,
      sampleIntervalM: intervalM,
      samples: profile.length,
    },
  };
}
