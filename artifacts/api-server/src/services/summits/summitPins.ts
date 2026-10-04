/**
 * Which summits a map shows, and what a pin may claim about them.
 *
 * Two separate jobs that both have to be right before any of this reaches a
 * screen.
 *
 * WHICH ONES. There are tens of thousands of summits. Drawing them all at
 * national zoom is both unreadable and several megabytes over mobile data, so
 * the map shows fewer, larger hills as you pull back. That is not a
 * compromise — no paper map labels every bump at 1:250,000 either.
 *
 * WHAT A PIN SAYS. A summit's height is a fact: it is the same however you got
 * there. Its ascent is not — it depends entirely on which path you took and
 * where you parked. The schema already keeps verified ascent apart from
 * estimated, with the number of recorded climbs beside it, and a pin that
 * flattens all that into a bare "820 m" throws away the only thing that makes
 * the figure worth trusting.
 *
 * Pure. No database, no network. The caller fetches rows; this decides what
 * may be said about them.
 */

/** Below this, the map shows no summit pins at all — at that scale they would
 *  be a smear of dots over a country outline, and nobody is picking a hill
 *  from it. */
export const MIN_PIN_ZOOM = 7;

/** Above this, every summit in view is drawn, however small. */
export const ALL_SUMMITS_ZOOM = 13;

/**
 * The height a summit must reach to be drawn at a given zoom.
 *
 * Height is a poor proxy for how notable a hill is — prominence is the right
 * measure, and a classification (Munro, Wainwright) is better still for
 * somebody choosing a day out. Neither is stored today, so height is what can
 * honestly be used. The bands are expressed as a named ladder rather than a
 * formula so that swapping in prominence later changes this one function.
 *
 * Returns null when nothing should be drawn.
 */
export function heightFloorForZoom(zoom: number): number | null {
  if (!Number.isFinite(zoom) || zoom < MIN_PIN_ZOOM) return null;
  if (zoom >= ALL_SUMMITS_ZOOM) return 0;
  if (zoom >= 12) return 300;
  if (zoom >= 11) return 450;
  if (zoom >= 10) return 600;
  if (zoom >= 9) return 750;
  if (zoom >= 8) return 900;
  return 1000;
}

/**
 * The most pins to return for one view.
 *
 * A cap the client can rely on matters more than the exact number: clustering
 * is cheap, but a response is not, and an unbounded query over a dense area is
 * how a map becomes unusable on a slow connection. Tightest when zoomed out,
 * because that is where a careless rectangle covers the whole country.
 */
export function pinCap(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom < MIN_PIN_ZOOM) return 0;
  if (zoom >= ALL_SUMMITS_ZOOM) return 1500;
  if (zoom >= 10) return 800;
  return 400;
}

/* ── What a pin may claim ───────────────────────────────────────────────── */

export interface SummitRow {
  slug: string;
  name: string;
  country: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  summitElevationM: number | null;
  estimatedGainM: number | null;
  verifiedGainM: number | null;
  verifiedSampleCount: number;
}

export type GainDisplay =
  /** Measured, from real recorded climbs. The count travels with it because
   *  "from 14 climbs" and "from 1 climb" are not the same claim. */
  | { kind: "verified"; metres: number; sampleCount: number }
  /** Worked out rather than measured. Said so, every time. */
  | { kind: "estimated"; metres: number }
  /** Not known. Not zero — a summit with no ascent is not a summit, and a
   *  zero here would be read as a flat walk. */
  | { kind: "unknown" };

/**
 * How much climbing, and how much that figure can be trusted.
 *
 * A non-positive figure is treated as missing. Zero ascent to a summit is not
 * a measurement, it is an empty column, and showing it as 0 m would be the
 * most misleading thing on the card.
 */
export function gainDisplay(row: Pick<SummitRow, "estimatedGainM" | "verifiedGainM" | "verifiedSampleCount">): GainDisplay {
  const verified = row.verifiedGainM;
  if (typeof verified === "number" && Number.isFinite(verified) && verified > 0 && row.verifiedSampleCount > 0) {
    return { kind: "verified", metres: Math.round(verified), sampleCount: row.verifiedSampleCount };
  }
  const estimated = row.estimatedGainM;
  if (typeof estimated === "number" && Number.isFinite(estimated) && estimated > 0) {
    return { kind: "estimated", metres: Math.round(estimated) };
  }
  return { kind: "unknown" };
}

/**
 * The line under the height on a summit card, or null when there is nothing
 * honest to say.
 *
 * Null rather than "Unknown": a card that lists a blank where every other card
 * has a number invites the reader to assume the hill is flat. Saying nothing
 * at all leaves the question open, which is the true state.
 */
export function gainLabel(gain: GainDisplay): string | null {
  switch (gain.kind) {
    case "verified":
      return gain.sampleCount === 1
        ? `${gain.metres} m ascent, from 1 recorded climb`
        : `${gain.metres} m ascent, from ${gain.sampleCount} recorded climbs`;
    case "estimated":
      return `around ${gain.metres} m ascent, estimated`;
    case "unknown":
      return null;
  }
}

export interface SummitPin {
  slug: string;
  name: string;
  /** Where it is. Never null — a summit without coordinates cannot be a pin. */
  lat: number;
  lng: number;
  /** Metres. Null when the record does not carry one; never a stand-in. */
  heightM: number | null;
  /** "Snowdonia, Wales" and the like, or null. */
  place: string | null;
  gain: GainDisplay;
}

/** "Snowdonia, Wales" from the parts that exist, or null when neither does. */
export function placeLabel(row: Pick<SummitRow, "region" | "country">): string | null {
  const parts = [row.region, row.country]
    .map(p => (typeof p === "string" ? p.trim() : ""))
    .filter(p => p.length > 0);
  if (parts.length === 0) return null;
  /* A region that already names its country reads badly doubled up. */
  if (parts.length === 2 && parts[0]!.toLowerCase().includes(parts[1]!.toLowerCase())) return parts[0]!;
  return [...new Set(parts)].join(", ");
}

/**
 * A row becomes a pin, or it does not.
 *
 * A summit with no coordinates cannot be drawn, so it is dropped rather than
 * placed at a plausible-looking default. An island off Africa at 0,0 is the
 * classic version of that bug.
 */
export function toPin(row: SummitRow): SummitPin | null {
  const { latitude: lat, longitude: lng } = row;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (!row.slug || !row.name) return null;
  const height = row.summitElevationM;
  return {
    slug: row.slug,
    name: row.name,
    lat,
    lng,
    heightM: typeof height === "number" && Number.isFinite(height) && height > 0 ? Math.round(height) : null,
    place: placeLabel(row),
    gain: gainDisplay(row),
  };
}

/* ── The rectangle ──────────────────────────────────────────────────────── */

export interface BBox { minLat: number; maxLat: number; minLng: number; maxLng: number }

/**
 * "minLng,minLat,maxLng,maxLat" — the order every mapping tool uses, so the
 * caller can pass what its map gave it without rearranging and getting it
 * wrong.
 */
export function parseBBox(raw: unknown): BBox | null {
  if (typeof raw !== "string") return null;
  const parts = raw.split(",").map(p => Number(p.trim()));
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return null;
  if (minLat >= maxLat || minLng >= maxLng) return null;
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * A rectangle grown by a margin, in degrees of latitude.
 *
 * The map asks for more than it shows so that a short pan does not leave a
 * blank band at the edge while a new request is in flight. Longitude is
 * widened by the same ground distance, which is more degrees the further north
 * you are — at Cape Wrath a degree of longitude is less than half what it is
 * at the equator.
 */
export function padBBox(box: BBox, marginDeg: number): BBox {
  const midLat = (box.minLat + box.maxLat) / 2;
  const cos = Math.max(0.05, Math.cos((midLat * Math.PI) / 180));
  const lngMargin = marginDeg / cos;
  return {
    minLat: Math.max(-90, box.minLat - marginDeg),
    maxLat: Math.min(90, box.maxLat + marginDeg),
    minLng: Math.max(-180, box.minLng - lngMargin),
    maxLng: Math.min(180, box.maxLng + lngMargin),
  };
}
