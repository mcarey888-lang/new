/**
 * mountainPath.ts
 *
 * Arc-length–parametrised sampler for the master-route.svg path.
 * Computed once at module load (pure arithmetic, ~5 ms).
 *
 * Exports:
 *   TOTAL_PATH_LENGTH  – total arc length in SVG user units
 *   ROUTE_XS / ROUTE_YS – 1 001 evenly-spaced (by arc length) x/y values
 *   getPointAtFraction(f) – JS-thread helper used for stage-marker placement
 *
 * SVG viewBox: "0 0 380 344"
 * Path: M2 342 … 378 2  (bottom-left to top-right, 27 segments)
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

// ── 27 segments from master-route.svg (viewBox "0 0 380 344") ─────────────────
const SEGS: SegFn[] = [
  // 1 C
  t => cb(t, {x:2,      y:342.001}, {x:18.7464, y:341.787}, {x:53.8256, y:340.339}, {x:60.1716, y:336.249}),
  // 2 C
  t => cb(t, {x:60.1716,y:336.249}, {x:66.5176, y:332.158}, {x:75.1552, y:321.762}, {x:78.6807, y:317.076}),
  // 3 L
  t => ln(t, {x:78.6807,y:317.076}, {x:93.488,  y:301.098}),
  // 4 L
  t => ln(t, {x:93.488, y:301.098}, {x:105.651, y:282.564}),
  // 5 L
  t => ln(t, {x:105.651,y:282.564}, {x:116.757, y:260.835}),
  // 6 C
  t => cb(t, {x:116.757,y:260.835}, {x:117.638, y:258.492}, {x:120.776, y:253.422}, {x:126.276, y:251.888}),
  // 7 C
  t => cb(t, {x:126.276,y:251.888}, {x:131.776, y:250.354}, {x:136.852, y:251.888}, {x:146.371, y:247.414}),
  // 8 L
  t => ln(t, {x:146.371,y:247.414}, {x:155.361, y:241.662}),
  // 9 L
  t => ln(t, {x:155.361,y:241.662}, {x:165.409, y:238.467}),
  // 10 L
  t => ln(t, {x:165.409,y:238.467}, {x:179.159, y:226.324}),
  // 11 L
  t => ln(t, {x:179.159,y:226.324}, {x:186.563, y:217.376}),
  // 12 L
  t => ln(t, {x:186.563,y:217.376}, {x:194.495, y:205.873}),
  // 13 C
  t => cb(t, {x:194.495,y:205.873}, {x:198.549, y:206.299}, {x:207.716, y:206.256}, {x:211.947, y:202.677}),
  // 14 C
  t => cb(t, {x:211.947,y:202.677}, {x:216.177, y:199.098}, {x:222.523, y:188.404}, {x:225.167, y:183.504}),
  // 15 L
  t => ln(t, {x:225.167,y:183.504}, {x:232.571, y:174.557}),
  // 16 C
  t => cb(t, {x:232.571,y:174.557}, {x:234.863, y:170.083}, {x:240.08,  y:160.752}, {x:242.619, y:159.219}),
  // 17 C
  t => cb(t, {x:242.619,y:159.219}, {x:245.792, y:157.301}, {x:248.965, y:154.106}, {x:249.494, y:149.632}),
  // 18 C
  t => cb(t, {x:249.494,y:149.632}, {x:249.917, y:146.053}, {x:252.49,  y:141.75},  {x:253.724, y:140.046}),
  // 19 H (horizontal line → same y)
  t => ln(t, {x:253.724,y:140.046}, {x:262.186, y:140.046}),
  // 20 C
  t => cb(t, {x:262.186,y:140.046}, {x:266.416, y:142.176}, {x:275.406, y:145.798}, {x:277.522, y:143.241}),
  // 21 C
  t => cb(t, {x:277.522,y:143.241}, {x:280.166, y:140.046}, {x:288.098, y:132.376}, {x:289.685, y:127.903}),
  // 22 C
  t => cb(t, {x:289.685,y:127.903}, {x:291.271, y:123.429}, {x:294.444, y:115.76},  {x:298.675, y:113.843}),
  // 23 C
  t => cb(t, {x:298.675,y:113.843}, {x:302.906, y:111.925}, {x:314.011, y:100.422}, {x:316.127, y:98.5043}),
  // 24 C
  t => cb(t, {x:316.127,y:98.5043}, {x:318.242, y:96.587},  {x:324.588, y:79.3313}, {x:328.29,  y:76.7749}),
  // 25 C
  t => cb(t, {x:328.29, y:76.7749}, {x:331.992, y:74.2186}, {x:341.511, y:71.6622}, {x:343.626, y:67.8276}),
  // 26 C
  t => cb(t, {x:343.626,y:67.8276}, {x:345.741, y:63.993},  {x:361.077, y:39.7073}, {x:362.664, y:36.5118}),
  // 27 C  ← summit at (378, 2)
  t => cb(t, {x:362.664,y:36.5118}, {x:363.933, y:33.9554}, {x:370.068, y:20.3213}, {x:378,     y:2.00051}),
];

// ── Build arc-length table (300 steps per segment) ────────────────────────────

const STEPS = 300;
const rawPts: Pt[] = [];
for (const seg of SEGS) {
  for (let j = 0; j < STEPS; j++) rawPts.push(seg(j / STEPS));
}
rawPts.push(SEGS[SEGS.length - 1](1));

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
  const t    = span < 1e-10 ? 0 : (target - cumLen[lo]) / span;
  ROUTE_XS[i] = rawPts[lo].x + (rawPts[hi].x - rawPts[lo].x) * t;
  ROUTE_YS[i] = rawPts[lo].y + (rawPts[hi].y - rawPts[lo].y) * t;
}

/** JS-thread helper — returns the SVG coordinate at fraction [0, 1]. */
export function getPointAtFraction(fraction: number): Pt {
  const idx = Math.max(0, Math.min(N, Math.round(fraction * N)));
  return { x: ROUTE_XS[idx], y: ROUTE_YS[idx] };
}
