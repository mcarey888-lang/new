/**
 * Readiness gauge geometry.
 *
 * The approved prototypes fix the mapping and it must not drift:
 *
 *     0   = 12 o'clock
 *     25  = 3 o'clock
 *     50  = 6 o'clock
 *     75  = 9 o'clock
 *     100 = back to 12 o'clock
 *     ...travelling CLOCKWISE.
 *
 * An SVG <Circle> starts its dash at 3 o'clock and runs clockwise, so the ring
 * is rotated -90deg to start at 12. This module owns the arithmetic so the
 * gauge cannot be re-derived (and quietly reversed) per screen.
 *
 * It calculates geometry only. It never scores anything — Readiness 2.0
 * (`utils/readinessV2.ts`) is the sole authority for the number itself.
 */

/** Rotation applied to the ring group so 0 sits at 12 o'clock. */
export const GAUGE_ROTATION_DEG = -90;

export function circumference(radius: number): number {
  return 2 * Math.PI * radius;
}

/** Clamp a score to the drawable range. `null` (unavailable) stays null. */
export function clampScore(score: number | null | undefined): number | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, score));
}

/**
 * Dash array for an arc covering `score` percent of the ring.
 * Returned as a tuple so callers cannot accidentally swap the two values.
 */
export function arcDash(score: number | null | undefined, radius: number): [number, number] {
  const c = circumference(radius);
  const s = clampScore(score);
  if (s === null) return [0, c];
  return [(s / 100) * c, c];
}

/**
 * The angle, in degrees clockwise from 12 o'clock, at which a score sits.
 * Used to place the projected marker and to assert the mapping in tests.
 */
export function scoreToDegrees(score: number | null | undefined): number | null {
  const s = clampScore(score);
  return s === null ? null : (s / 100) * 360;
}

/** Clock position a score reads as, for assertions and accessibility copy. */
export function scoreToClockHour(score: number | null | undefined): number | null {
  const deg = scoreToDegrees(score);
  if (deg === null) return null;
  const hour = (deg / 360) * 12;
  return hour === 12 ? 12 : hour;
}

/**
 * Centre point of the arc end, for a marker dot.
 * `cx`/`cy` are the ring centre; angle is measured clockwise from 12 o'clock.
 */
export function pointOnRing(
  score: number | null | undefined,
  radius: number,
  cx: number,
  cy: number,
): { x: number; y: number } | null {
  const deg = scoreToDegrees(score);
  if (deg === null) return null;
  const rad = ((deg - 90) * Math.PI) / 180;   /* -90 puts 0 at 12 o'clock */
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

/**
 * Projected readiness must never read as earned readiness.
 *
 * This returns the SEGMENT BEYOND the current score — never a full arc from
 * zero — so the projection can only ever be drawn as an extension, in its own
 * colour, on top of what has actually been earned. If the projection is not
 * greater than current, there is nothing to draw.
 */
export function projectedArcDash(
  current: number | null | undefined,
  projected: number | null | undefined,
  radius: number,
): { dash: [number, number]; offset: number } | null {
  const c = clampScore(current);
  const p = clampScore(projected);
  if (c === null || p === null || p <= c) return null;
  const circ = circumference(radius);
  const segment = ((p - c) / 100) * circ;
  return { dash: [segment, circ], offset: -((c / 100) * circ) };
}
