import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface Coord { lat: number; lng: number }

function simplifyCoords(coords: Coord[], maxPoints: number): Coord[] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const out: Coord[] = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[i]);
  const last = coords[coords.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

const dist2 = (a: Coord, b: Coord) =>
  (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;

// Append a way to an in-progress polyline, reversing the way if that gives
// a closer join to the current tail point.
function appendWay(out: Coord[], way: Coord[]): void {
  if (way.length === 0) return;
  const tail = out[out.length - 1];
  const seg = dist2(tail, way[way.length - 1]) < dist2(tail, way[0])
    ? [...way].reverse()
    : way;
  const exact = dist2(out[out.length - 1], seg[0]) < 1e-12;
  out.push(...(exact ? seg.slice(1) : seg));
}

// Chain OSM relation members in their given order — just reversing individual
// ways as needed to maintain end-to-end continuity.
// Splits into new segments when the gap between consecutive ways exceeds
// MAX_GAP_DEG (~220 m) and returns only the longest continuous segment.
// This handles long-distance trails that have ferry links, road crossings,
// or other discontinuities recorded in the OSM relation.
const MAX_GAP_DEG = 0.002;

function chainRelationMembers(ways: Coord[][]): Coord[] {
  if (ways.length === 0) return [];

  const segments: Coord[][] = [];
  let current: Coord[] = [...ways[0]];

  for (let i = 1; i < ways.length; i++) {
    const tail = current[current.length - 1];
    const w = ways[i];
    const gapF = Math.sqrt(dist2(tail, w[0]));
    const gapR = Math.sqrt(dist2(tail, w[w.length - 1]));
    if (Math.min(gapF, gapR) <= MAX_GAP_DEG) {
      appendWay(current, w);
    } else {
      segments.push(current);
      current = [...w];
    }
  }
  segments.push(current);

  // Return the longest continuous segment (handles gaps mid-relation)
  return segments.reduce(
    (best, s) => s.length > best.length ? s : best,
    [] as Coord[]
  );
}

// Greedy fallback for standalone named ways (no relation available).
// MAX_JUMP_DEG: ~220 m — stops stitching if the nearest remaining segment
// is further away (it's a disconnected section with the same name).
const MAX_JUMP_DEG = 0.002;

function stitchWays(ways: Coord[][]): Coord[] {
  if (ways.length === 0) return [];
  if (ways.length === 1) return ways[0];

  const remaining = ways.map(w => [...w]);
  // Start with the longest segment — better anchor for the greedy chain
  remaining.sort((a, b) => b.length - a.length);
  const out: Coord[] = [...remaining.shift()!];

  while (remaining.length > 0) {
    const tail = out[out.length - 1];
    let bestIdx = -1;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const w = remaining[i];
      const ds = dist2(tail, w[0]);
      const de = dist2(tail, w[w.length - 1]);
      const d = Math.min(ds, de);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }

    if (Math.sqrt(bestDist) > MAX_JUMP_DEG) break;

    appendWay(out, remaining.splice(bestIdx, 1)[0]);
  }

  return out;
}

router.post("/trail-route", async (req, res) => {
  const { name, location, lat, lng } = req.body as {
    name?: string;
    location?: string;
    lat?: number | string;
    lng?: number | string;
  };

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ coords: [], center: null, found: false });
    return;
  }

  const safeName = name.trim().replace(/[^a-zA-Z0-9\s&''-]/g, "");

  try {
    let centerLat = 54.0;
    let centerLng = -2.0;
    const pad = 0.6;

    // Prefer caller-supplied coords (e.g. OSM centre from seeded trails) to
    // avoid a Nominatim geocode call that may be rate-limited or inaccurate.
    const parsedLat = typeof lat === "string" ? parseFloat(lat) : (lat ?? NaN);
    const parsedLng = typeof lng === "string" ? parseFloat(lng) : (lng ?? NaN);

    if (isFinite(parsedLat) && isFinite(parsedLng) &&
        parsedLat >= -90 && parsedLat <= 90 &&
        parsedLng >= -180 && parsedLng <= 180) {
      centerLat = parsedLat;
      centerLng = parsedLng;
    } else if (location) {
      const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
      const geoRes = await fetch(geoUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "SummitReady/1.0 (hiking training app)" },
      });
      if (geoRes.ok) {
        const geoData = await geoRes.json() as Array<{ lat: string; lon: string }>;
        if (geoData.length > 0) {
          centerLat = parseFloat(geoData[0].lat);
          centerLng = parseFloat(geoData[0].lon);
        }
      }
    }

    const south = (centerLat - pad).toFixed(4);
    const north = (centerLat + pad).toFixed(4);
    const west = (centerLng - pad * 1.6).toFixed(4);
    const east = (centerLng + pad * 1.6).toFixed(4);

    const q = `[out:json][timeout:25];
(
  relation["type"="route"]["route"~"hiking|foot|walking"]["name"~"${safeName}",i](${south},${west},${north},${east});
  way["highway"]["name"~"${safeName}",i](${south},${west},${north},${east});
);
out geom;`;

    const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "SummitReady/1.0",
      },
      body: `data=${encodeURIComponent(q)}`,
      signal: AbortSignal.timeout(28000),
    });

    if (!overpassRes.ok) {
      res.json({ coords: [], center: { lat: centerLat, lng: centerLng }, found: false });
      return;
    }

    type OSMNode = { lat: number; lon: number };
    type OSMElement = {
      type: "way" | "relation" | "node";
      geometry?: OSMNode[];
      members?: Array<{ type: string; role?: string; geometry?: OSMNode[] }>;
    };
    const data = await overpassRes.json() as { elements: OSMElement[] };

    // Separate relation member ways (OSM-ordered) from standalone named ways.
    // Relations are preferred — their members are already in route order, so
    // we only need to reverse individual ways to maintain end-to-end continuity.
    // Standalone ways are the greedy-stitch fallback when no relation is found.
    let bestRelationCoords: Coord[] = [];
    const standaloneWays: Coord[][] = [];

    for (const el of data.elements) {
      if (el.type === "relation" && el.members) {
        const memberWays: Coord[][] = [];
        for (const m of el.members) {
          if (m.type === "way" && m.geometry && m.geometry.length > 1) {
            memberWays.push(m.geometry.map(pt => ({ lat: pt.lat, lng: pt.lon })));
          }
        }
        if (memberWays.length > 0) {
          const chained = chainRelationMembers(memberWays);
          // Keep the relation with the most points (likely the full route)
          if (chained.length > bestRelationCoords.length) {
            bestRelationCoords = chained;
          }
        }
      } else if (el.type === "way" && el.geometry && el.geometry.length > 1) {
        standaloneWays.push(el.geometry.map(pt => ({ lat: pt.lat, lng: pt.lon })));
      }
    }

    // Use relation if available; greedy-stitch standalone ways as fallback
    const stitched = bestRelationCoords.length >= 4
      ? bestRelationCoords
      : stitchWays(standaloneWays);

    if (stitched.length > 0) {
      const simplified = simplifyCoords(stitched, 350);
      const avgLat = stitched.reduce((s, c) => s + c.lat, 0) / stitched.length;
      const avgLng = stitched.reduce((s, c) => s + c.lng, 0) / stitched.length;
      res.json({ coords: simplified, center: { lat: avgLat, lng: avgLng }, found: true });
    } else {
      res.json({ coords: [], center: { lat: centerLat, lng: centerLng }, found: false });
    }
  } catch (err) {
    req.log.warn({ err }, "Trail route lookup failed");
    res.json({ coords: [], center: null, found: false });
  }
});

export default router;
