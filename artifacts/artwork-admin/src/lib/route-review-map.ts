export type LonLat = [number, number];
export type Parsed = { ok: true; coords: LonLat[] } | { ok: false; error: string };
export type Summit = { lat: number; lon: number };

export const ENDPOINT_TOLERANCE_M = 5;
export const OUT_BACK_TOLERANCE_M = 0.5;
export const SUMMIT_TOLERANCE_M = 30;

export function parseCoordinates(input: unknown): Parsed {
  if (!Array.isArray(input) || input.length < 2) return { ok: false, error: "Geometry needs at least two coordinates." };
  const out: LonLat[] = [];
  for (const c of input) {
    if (!Array.isArray(c) || c.length !== 2 || typeof c[0] !== "number" || typeof c[1] !== "number"
      || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) {
      return { ok: false, error: "Geometry contains an invalid longitude/latitude pair." };
    }
    out.push([c[0], c[1]]);
  }
  return { ok: true, coords: out };
}

export function haversineM(a: LonLat, b: LonLat): number {
  const r = Math.PI / 180, R = 6371008.8;
  const dLat = (b[1] - a[1]) * r;
  let dLon = Math.abs(b[0] - a[0]); if (dLon > 180) dLon = 360 - dLon;
  dLon *= r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Display-only longitude unwrap so lines crossing the antimeridian stay continuous. Input is not mutated. */
export function unwrapForDisplay(coords: LonLat[]): LonLat[] {
  const out: LonLat[] = []; let offset = 0;
  coords.forEach((c, i) => {
    if (i) { const d = c[0] + offset - out[i - 1][0]; if (d > 180) offset -= 360; else if (d < -180) offset += 360; }
    out.push([c[0] + offset, c[1]]);
  });
  return out;
}

export function boundsOf(coords: LonLat[]) {
  const u = unwrapForDisplay(coords);
  const xs = u.map((c) => c[0]), ys = u.map((c) => c[1]);
  return { west: Math.min(...xs), east: Math.max(...xs), south: Math.min(...ys), north: Math.max(...ys), crossesDateline: u.some((c, i) => c[0] !== coords[i][0]) };
}

function cumulative(coords: LonLat[]): number[] {
  const d = [0];
  for (let i = 1; i < coords.length; i++) d.push(d[i - 1] + haversineM(coords[i - 1], coords[i]));
  return d;
}
export type RouteAnalysis = {
  lengthM: number;
  start: LonLat; end: LonLat;
  startFinishCombined: boolean;
  outAndBack: boolean;
  turnaround: LonLat | null;
  summitReference: LonLat | null;
  turnaroundNearSummitM: number | null;
  turnaroundIsSummit: boolean;
};

export function analyseRoute(coords: LonLat[], summit: Summit | null): RouteAnalysis {
  const cum = cumulative(coords), length = cum[cum.length - 1];
  const start = coords[0], end = coords[coords.length - 1];
  const combined = haversineM(start, end) <= ENDPOINT_TOLERANCE_M;
  let outAndBack = false, turnaround: LonLat | null = null;
  if (combined && length > 0) {
    outAndBack = true;
    for (let k = 0; k < Math.floor(coords.length / 2) && outAndBack; k++) {
      if (haversineM(coords[k], coords[coords.length - 1 - k]) > OUT_BACK_TOLERANCE_M) outAndBack = false;
    }
    if (outAndBack) {
      // Curving routes can turn back nearer the start than an earlier vertex.
      // The middle vertex of matching reversed halves is the turnaround.
      turnaround = coords[Math.floor(coords.length / 2)];
      if (haversineM(start, turnaround) <= ENDPOINT_TOLERANCE_M) { outAndBack = false; turnaround = null; }
    }
  }
  const ref: LonLat | null = summit ? [summit.lon, summit.lat] : null;
  const near = ref && turnaround ? haversineM(turnaround, ref) : null;
  return { lengthM: length, start, end, startFinishCombined: combined, outAndBack, turnaround,
    summitReference: ref, turnaroundNearSummitM: near, turnaroundIsSummit: near !== null && near <= SUMMIT_TOLERANCE_M };
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
export function extractSummit(mountain: unknown): Summit | null {
  if (!mountain || typeof mountain !== "object") return null;
  const m = mountain as Record<string, unknown>;
  let lat = n(m.latitude ?? m.lat), lon = n(m.longitude ?? m.lon ?? m.lng);
  const c = m.coordinates ?? m.coordinate;
  if ((lat === null || lon === null) && Array.isArray(c)) { lon = n(c[0]); lat = n(c[1]); }
  else if ((lat === null || lon === null) && c && typeof c === "object") {
    const o = c as Record<string, unknown>; lat = n(o.latitude ?? o.lat); lon = n(o.longitude ?? o.lon ?? o.lng);
  }
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
