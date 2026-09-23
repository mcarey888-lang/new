/**
 * Readiness history.
 *
 * The approved Full Readiness design shows how the score has moved. Production
 * stores no such series — but it does not need to, because Readiness 2.0
 * already excludes evidence completed after its `asOf` (`invalid_or_future_timestamp`).
 * Evaluating the SAME engine at a past `asOf` therefore returns what the score
 * genuinely was on that date, from the evidence the user had logged by then.
 *
 * That is what this module does, and all it does:
 *   · it picks the dates to sample for a period,
 *   · it asks the caller's `evaluate` for the score at each one,
 *   · it drops any date the engine could not score.
 *
 * It contains NO scoring, no smoothing, no interpolation and no default. If the
 * engine cannot produce at least two real points, this returns null and the
 * screen shows a designed empty state rather than a line. The hook that owns
 * the engine call is `hooks/useReadinessHistory.ts`; keeping the sampling here
 * means it can be tested without the engine at all.
 */

export type HistoryPeriod = "4W" | "3M" | "1Y" | "ALL";

export const HISTORY_PERIODS: HistoryPeriod[] = ["4W", "3M", "1Y", "ALL"];

export interface HistoryPoint {
  /** ISO timestamp the engine was evaluated at. */
  at: string;
  /** Axis label for this point. */
  label: string;
  /** The engine's overall score on that date. */
  score: number;
}

export interface ReadinessHistorySeries {
  period: HistoryPeriod;
  points: HistoryPoint[];
  /** Lowest and highest score in the series, for the axis. */
  min: number;
  max: number;
}

const DAY = 86_400_000;

/** How far back each period looks, and how many points it samples. */
const PERIOD_SPEC: Record<Exclude<HistoryPeriod, "ALL">, { days: number; samples: number }> = {
  "4W": { days: 28, samples: 5 },
  "3M": { days: 91, samples: 7 },
  "1Y": { days: 365, samples: 7 },
};

/** At most this many points for ALL, so a long history stays readable. */
const ALL_SAMPLES = 7;
/** ALL needs some history to be worth showing. */
const ALL_MIN_DAYS = 21;

function labelFor(period: HistoryPeriod, date: Date, isLast: boolean): string {
  if (isLast) return "Now";
  if (period === "4W") return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (period === "3M") return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (period === "1Y") return date.toLocaleDateString("en-GB", { month: "short" });
  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

/**
 * The dates to evaluate for a period, oldest first, always ending at `now`.
 *
 * `earliestAt` is the first piece of evidence the user has. Sampling before it
 * would only ever produce unscored points, so the window starts there.
 */
export function historySampleDates(
  period: HistoryPeriod,
  now: Date,
  earliestAt?: string | null,
): Date[] {
  const end = now.getTime();
  const earliest = earliestAt ? Date.parse(earliestAt) : Number.NaN;
  const hasEarliest = Number.isFinite(earliest) && earliest <= end;

  let start: number;
  let samples: number;

  if (period === "ALL") {
    if (!hasEarliest) return [];
    if (end - earliest < ALL_MIN_DAYS * DAY) return [];
    start = earliest;
    samples = ALL_SAMPLES;
  } else {
    const spec = PERIOD_SPEC[period];
    start = end - spec.days * DAY;
    samples = spec.samples;
    /* Never reach back past the first evidence — those points cannot score. */
    if (hasEarliest && earliest > start) start = earliest;
  }

  if (!(start < end)) return [];
  const step = (end - start) / (samples - 1);
  return Array.from({ length: samples }, (_, i) => new Date(Math.round(start + step * i)));
}

export interface BuildHistoryInput {
  period: HistoryPeriod;
  now: Date;
  /** ISO date of the user's earliest logged evidence, if any. */
  earliestEvidenceAt?: string | null;
  /** Reads the engine at a point in time. Null when it could not score. */
  evaluate: (asOfIso: string) => number | null;
}

/**
 * Build the series, or null when there is not enough real history to draw.
 *
 * A single point is not a history — the chart would be a dot claiming a trend
 * it cannot support — so two scored points are the minimum.
 */
export function buildReadinessHistory(input: BuildHistoryInput): ReadinessHistorySeries | null {
  const dates = historySampleDates(input.period, input.now, input.earliestEvidenceAt);
  if (dates.length === 0) return null;

  const points: HistoryPoint[] = [];
  dates.forEach((date, i) => {
    const iso = date.toISOString();
    const score = input.evaluate(iso);
    if (score === null || score === undefined || !Number.isFinite(score)) return;
    points.push({
      at: iso,
      label: labelFor(input.period, date, i === dates.length - 1),
      score: Math.round(score),
    });
  });

  if (points.length < 2) return null;

  const scores = points.map(p => p.score);
  return {
    period: input.period,
    points,
    min: Math.min(...scores),
    max: Math.max(...scores),
  };
}

/**
 * The y-axis ticks for a series.
 *
 * Always spans 0–100 so two periods cannot imply different progress from the
 * same numbers — a rescaled axis is how a flat month starts to look like a
 * climb.
 */
export function historyAxisTicks(): number[] {
  return [0, 25, 50, 75, 100];
}

export interface ChartGeometry {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
}

export interface PlottedPoint extends HistoryPoint {
  x: number;
  y: number;
}

/** Maps a series onto a chart box. Pure geometry — no styling, no rounding. */
export function plotHistory(
  series: ReadinessHistorySeries,
  geo: ChartGeometry,
): { points: PlottedPoint[]; yFor: (score: number) => number } {
  const innerW = geo.width - geo.padLeft - geo.padRight;
  const innerH = geo.height - geo.padTop - geo.padBottom;
  const yFor = (score: number) =>
    geo.padTop + innerH * (1 - Math.max(0, Math.min(100, score)) / 100);
  const n = series.points.length;
  const points = series.points.map((p, i) => ({
    ...p,
    x: geo.padLeft + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1)),
    y: yFor(p.score),
  }));
  return { points, yFor };
}

/** An SVG path through the plotted points. */
export function historyLinePath(points: PlottedPoint[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

/** The same path closed to the baseline, for the area fill. */
export function historyAreaPath(points: PlottedPoint[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${historyLinePath(points)} L${last.x.toFixed(1)} ${baselineY.toFixed(1)} `
    + `L${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}
