/**
 * mountainPath.ts
 *
 * Arc-length–parametrised sampler for the fixed master route SVG path.
 * Computed once at module load (pure arithmetic, ~5 ms).
 *
 * Exports:
 *   TOTAL_PATH_LENGTH  – total arc length in SVG user units
 *   ROUTE_XS / ROUTE_YS – 1 001 evenly-spaced (by arc length) x/y values
 *   getPointAtFraction(f) – JS-thread helper used for stage-marker placement
 *
 * Segments are derived directly from the ROUTE_PATH in MountainProgress.tsx
 * so the animation lookup table always matches the visual path exactly.
 */

type Pt = { x: number; y: number };

function cb(t: number, p0: Pt, p1: Pt, p2: Pt, p3: Pt): Pt {
  const u = 1 - t;
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
  };
}
function ln(t: number, p0: Pt, p1: Pt): Pt {
  return { x: p0.x + (p1.x - p0.x)*t, y: p0.y + (p1.y - p0.y)*t };
}

type SegFn = (t: number) => Pt;

// Segments derived directly from ROUTE_PATH (MountainProgress.tsx).
// Upper portion terminates at the actual mountain peak (262, 85) rather than the SVG corner.
const SEGS: SegFn[] = [
  // Lead-in: extends the route start off the left edge for a softer entry
  t => ln(t, {x:-10,y:268},    {x:2,y:268}),
  // Lower ridge
  t => cb(t, {x:2,y:268},      {x:17.8333,y:267.834}, {x:51,y:266.7},        {x:57,y:263.5}),
  t => cb(t, {x:57,y:263.5},   {x:63,y:260.3},        {x:71.1667,y:252.167}, {x:74.5,y:248.5}),
  t => ln(t, {x:74.5,y:248.5}, {x:88.5,y:236}),
  t => ln(t, {x:88.5,y:236},   {x:100,y:221.5}),
  t => ln(t, {x:100,y:221.5},  {x:110.5,y:204.5}),
  t => cb(t, {x:110.5,y:204.5},{x:111.333,y:202.667}, {x:114.3,y:198.7},    {x:119.5,y:197.5}),
  t => cb(t, {x:119.5,y:197.5},{x:124.7,y:196.3},     {x:129.5,y:197.5},    {x:138.5,y:194}),
  t => ln(t, {x:138.5,y:194},  {x:147,y:189.5}),
  t => ln(t, {x:147,y:189.5},  {x:156.5,y:187}),
  t => ln(t, {x:156.5,y:187},  {x:169.5,y:177.5}),
  t => ln(t, {x:169.5,y:177.5},{x:176.5,y:170.5}),
  t => ln(t, {x:176.5,y:170.5},{x:184,y:161.5}),
  t => cb(t, {x:184,y:161.5},  {x:187.833,y:161.834}, {x:196.5,y:161.8},    {x:200.5,y:159}),
  t => cb(t, {x:200.5,y:159},  {x:204.5,y:156.2},     {x:210.5,y:147.834},  {x:213,y:144}),
  t => ln(t, {x:213,y:144},    {x:220,y:137}),
  t => cb(t, {x:220,y:137},    {x:222.167,y:133.5},   {x:227.1,y:126.2},    {x:229.5,y:125}),
  t => cb(t, {x:229.5,y:125},  {x:231.9,y:123.8},     {x:237,y:122.834},    {x:241.5,y:122.5}),
  // Final summit approach — curves to the actual mountain peak at (262, 85)
  t => cb(t, {x:241.5,y:122.5},{x:249,y:111},          {x:257,y:97},          {x:262,y:85}),
];

// ── Build arc-length table (300 steps per segment ≈ 9 300 raw points) ────────

const STEPS = 300;
const rawPts: Pt[] = [];
for (const seg of SEGS) {
  for (let j = 0; j < STEPS; j++) rawPts.push(seg(j / STEPS));
}
rawPts.push(SEGS[SEGS.length - 1](1)); // include final endpoint

const cumLen: number[] = [0];
for (let i = 1; i < rawPts.length; i++) {
  const dx = rawPts[i].x - rawPts[i - 1].x;
  const dy = rawPts[i].y - rawPts[i - 1].y;
  cumLen.push(cumLen[i - 1] + Math.sqrt(dx * dx + dy * dy));
}

export const TOTAL_PATH_LENGTH = cumLen[cumLen.length - 1];

// ── Re-sample 1 001 points at even arc-length intervals ───────────────────────

const N = 1000;
export const ROUTE_XS: number[] = new Array(N + 1);
export const ROUTE_YS: number[] = new Array(N + 1);

for (let i = 0; i <= N; i++) {
  const target = (i / N) * TOTAL_PATH_LENGTH;
  let lo = 0, hi = rawPts.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumLen[mid] <= target) lo = mid; else hi = mid;
  }
  const span = cumLen[hi] - cumLen[lo];
  const t = span < 1e-10 ? 0 : (target - cumLen[lo]) / span;
  ROUTE_XS[i] = rawPts[lo].x + (rawPts[hi].x - rawPts[lo].x) * t;
  ROUTE_YS[i] = rawPts[lo].y + (rawPts[hi].y - rawPts[lo].y) * t;
}

/** JS-thread helper — returns the SVG coordinate at fraction [0, 1]. */
export function getPointAtFraction(fraction: number): Pt {
  const idx = Math.max(0, Math.min(N, Math.round(fraction * N)));
  return { x: ROUTE_XS[idx], y: ROUTE_YS[idx] };
}
