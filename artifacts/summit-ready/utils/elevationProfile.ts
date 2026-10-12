/**
 * The altitude line drawn in the recording sheet while a hike is in progress.
 *
 * It plots ALTITUDE above sea level against time. That is not the same thing
 * as ascent: a walk that drops into a col and re-climbs accumulates ascent
 * this curve cannot show, so the ascent figure beside the chart is read from
 * the recorder and never off this line.
 *
 * Only readings the GPS actually returned are drawn. A fix that arrived with
 * no altitude is dropped rather than interpolated, so a gap appears as a
 * straight run between the readings either side of it, never as invented
 * terrain.
 *
 * The drawn line is an averaged version of those readings — see
 * `buildRecordingProfile` — so the curve's peak can sit a little below the
 * highest single reading. `highM` and `lowM` report the real readings, which
 * is why they are what the accessibility label quotes.
 */

export interface ProfileSample {
  alt: number | null;
  ts: number;
}

export interface ProfilePoint {
  /** 0 at the first reading, 1 at the latest. */
  x: number;
  /** 0 at the top of the box, 1 at the bottom — SVG's direction, not the
   *  mountain's, so callers can multiply straight into a viewBox. */
  y: number;
}

export interface RecordingProfile {
  points: ProfilePoint[];
  /** The lowest and highest altitudes actually recorded, in metres. */
  lowM: number;
  highM: number;
  /** True when the real spread was under MIN_SPAN_M and the line was drawn
   *  against a widened range instead, so flat ground reads as flat. */
  damped: boolean;
}

/** Columns drawn. Beyond this, neighbouring points land on the same pixel of
 *  a phone-width chart and the extra detail is only noise. */
export const PROFILE_COLUMNS = 48;

/** The narrowest range the line is ever drawn against. Without a floor, a
 *  three-metre wander in GPS altitude fills the box and a flat towpath looks
 *  like a climb. */
export const MIN_SPAN_M = 25;

/** Two readings make a straight line, which claims a trend from a pair of
 *  noisy fixes. Four is the fewest that can show a shape rather than assert
 *  a direction. */
export const MIN_PROFILE_SAMPLES = 4;

/**
 * Turn recorded track points into a normalised line, or null when there is
 * not yet enough to draw honestly. Null means the chart is not shown at all:
 * an empty axis at the start of a walk is chrome, not information.
 */
export function buildRecordingProfile(
  samples: readonly ProfileSample[],
  columns: number = PROFILE_COLUMNS,
): RecordingProfile | null {
  const recorded: number[] = [];
  for (const sample of samples) {
    if (typeof sample.alt === "number" && Number.isFinite(sample.alt)) {
      recorded.push(sample.alt);
    }
  }
  if (recorded.length < MIN_PROFILE_SAMPLES) return null;

  /* Averaged into a fixed number of columns so the line keeps its shape as a
     six-hour walk grows, and so one wild fix moves a column rather than
     spiking the whole chart. */
  const cols = Math.max(2, Math.min(Math.floor(columns), recorded.length));
  const binned: number[] = [];
  for (let i = 0; i < cols; i++) {
    const from = Math.floor((i * recorded.length) / cols);
    const to = Math.max(from + 1, Math.floor(((i + 1) * recorded.length) / cols));
    let total = 0;
    for (let j = from; j < to; j++) total += recorded[j];
    binned.push(total / (to - from));
  }

  let lo = Math.min(...binned);
  let hi = Math.max(...binned);
  const damped = hi - lo < MIN_SPAN_M;
  if (damped) {
    const mid = (hi + lo) / 2;
    lo = mid - MIN_SPAN_M / 2;
    hi = mid + MIN_SPAN_M / 2;
  }

  const span = hi - lo;
  const points = binned.map((alt, i) => ({
    x: i / (binned.length - 1),
    y: 1 - (alt - lo) / span,
  }));

  return {
    points,
    lowM: Math.min(...recorded),
    highM: Math.max(...recorded),
    damped,
  };
}

/** The curve itself, scaled into a box of the given size. */
export function profileLinePath(
  points: readonly ProfilePoint[],
  width: number,
  height: number,
): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) =>
      `${i === 0 ? "M" : "L"}${(p.x * width).toFixed(1)} ${(p.y * height).toFixed(1)}`)
    .join(" ");
}

/** The same curve closed down to the baseline, for the fill beneath it. */
export function profileAreaPath(
  points: readonly ProfilePoint[],
  width: number,
  height: number,
): string {
  const line = profileLinePath(points, width, height);
  if (!line) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L${(last.x * width).toFixed(1)} ${height.toFixed(1)} `
    + `L${(first.x * width).toFixed(1)} ${height.toFixed(1)} Z`;
}

/**
 * What a screen reader is told about the chart. It quotes the recorded
 * readings rather than the drawn line, and says so when the range was widened,
 * because "flat" is a finding and not a drawing artefact.
 */
export function profileLabel(profile: RecordingProfile): string {
  const low = Math.round(profile.lowM);
  const high = Math.round(profile.highM);
  if (profile.damped) {
    return `Altitude so far: level, around ${high} metres.`;
  }
  return `Altitude so far: between ${low} and ${high} metres.`;
}
