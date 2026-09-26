/**
 * The figures behind the Elevation Bank hero card.
 *
 * Kept separate from the card because the approved mockup shows SIX numbers
 * and the Elevation Bank API returns four of them. The rest have to be derived
 * from activity the app already holds, or — where they genuinely cannot be
 * known — left out. Working that out in a pure function means it is testable,
 * and means the card itself has no opportunity to invent anything.
 *
 * WHAT THE API ACTUALLY RETURNS (`ElevationBankResponse`):
 *   lifetimeAscentM, periodAscentM, creditedActivities, everestEquivalent,
 *   recentCredits[], recentEvents[]
 *
 * WHAT THE MOCKUP ASKS FOR, AND WHERE IT COMES FROM:
 *   lifetime metres      → lifetimeAscentM            (API)
 *   hikes                → creditedActivities         (API)
 *   mountains            → distinct summits           (caller supplies)
 *   expeditions          → saved expeditions          (caller supplies)
 *   moving time          → summed activity time       (caller supplies)
 *   monthly gain         → bucketed credits           (derived here)
 *   "+28% vs last year"  → NOT AVAILABLE              (see below)
 *
 * The year-on-year comparison needs a full prior year of banked ascent, and
 * nothing in the response carries it. It is therefore optional throughout: the
 * card renders without it rather than showing a number nobody computed.
 */

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export interface MonthlyGain {
  /** 0–11, so the caller can format the label however it likes. */
  monthIndex: number;
  label: string;
  ascentM: number;
}

/** One credit, reduced to the two fields the chart needs. */
export interface DatedAscent {
  /** ISO timestamp, as `ElevationBankCredit.effectiveAt` provides. */
  effectiveAt: string;
  ascentM: number;
}

/**
 * Bucket dated ascent into consecutive months ending at `now`.
 *
 * Returns a CONTINUOUS run of months, so a month with no activity shows as an
 * empty column rather than being skipped — a gap in the chart would otherwise
 * read as "no data" when it means "climbed nothing".
 *
 * Credits outside the window are ignored rather than folded into the edges,
 * which would silently overstate the first bar.
 */
export function monthlyGain(
  credits: readonly DatedAscent[],
  months: number,
  now: Date = new Date(),
): MonthlyGain[] {
  if (months <= 0) return [];

  const buckets: MonthlyGain[] = [];
  const index = new Map<string, MonthlyGain>();

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const cell = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const bucket: MonthlyGain = {
      monthIndex: cell.getMonth(),
      label: MONTH_LABELS[cell.getMonth()],
      ascentM: 0,
    };
    buckets.push(bucket);
    index.set(`${cell.getFullYear()}-${cell.getMonth()}`, bucket);
  }

  for (const credit of credits) {
    const at = new Date(credit.effectiveAt);
    if (Number.isNaN(at.getTime())) continue;
    const bucket = index.get(`${at.getFullYear()}-${at.getMonth()}`);
    if (bucket) bucket.ascentM += Math.max(0, credit.ascentM);
  }

  return buckets;
}

/**
 * Hours of moving time, from seconds.
 *
 * Rounded to whole hours because that is what the card shows; a fractional
 * hour would imply a precision the label does not carry.
 */
export function movingHours(totalSeconds: number): number {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;
  return Math.round(totalSeconds / 3600);
}

/**
 * Year-on-year change, ONLY when both years are genuinely known.
 *
 * Returns null when the previous period is absent or zero. A percentage
 * against zero is infinite, not impressive, and a first-year user has no
 * comparison to make.
 */
export function yearOnYearPercent(
  currentM: number | null | undefined,
  previousM: number | null | undefined,
): number | null {
  if (typeof currentM !== "number" || typeof previousM !== "number") return null;
  if (!Number.isFinite(currentM) || !Number.isFinite(previousM)) return null;
  if (previousM <= 0) return null;
  return Math.round(((currentM - previousM) / previousM) * 100);
}

/** `12420` → `"12,420"`. The unit is rendered separately so it can be styled. */
export function formatBankMetres(value: number): string {
  return Math.round(value).toLocaleString("en-GB");
}

/**
 * Bar heights as fractions of the tallest month.
 *
 * Scaled to the peak rather than to a fixed ceiling, so a quiet year still
 * reads as a shape. An all-zero series returns all zeros — no bar is drawn at
 * all, which is the honest rendering of having climbed nothing.
 */
export function barFractions(series: readonly MonthlyGain[]): number[] {
  const peak = Math.max(0, ...series.map(month => month.ascentM));
  if (peak <= 0) return series.map(() => 0);
  return series.map(month => month.ascentM / peak);
}
