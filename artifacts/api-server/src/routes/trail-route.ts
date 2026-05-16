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

// Greedily chain way segments end-to-end so the polyline forms a
// recognisable trail rather than a chaotic zigzag of unordered segments.
// MAX_JUMP_DEG: ~600 m — if the nearest next segment is further away than
// this, stop stitching (it's a separate disconnected trail section).
const MAX_JUMP_DEG = 0.006;

function stitchWays(ways: Coord[][]): Coord[] {
  if (ways.length === 0) return [];
  if (ways.length === 1) return ways[0];

  const dist2 = (a: Coord, b: Coord) =>
    (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;

  const remaining = ways.map(w => [...w]);
  // Start with the longest segment for best anchoring
  remaining.sort((a, b) => b.length - a.length);
  const stitched: Coord[] = [...remaining.shift()!];

  while (remaining.length > 0) {
    const tail = stitched[stitched.length - 1];
    let bestIdx = -1;
    let bestDist = Infinity;
    let reversed = false;

    for (let i = 0; i < remaining.length; i++) {
      const w = remaining[i];
      const ds = dist2(tail, w[0]);
      const de = dist2(tail, w[w.length - 1]);
      if (ds < bestDist) { bestDist = ds; bestIdx = i; reversed = false; }
      if (de < bestDist) { bestDist = de; bestIdx = i; reversed = true; }
    }

    // Stop if the nearest unconnected segment is too far away — it is a
    // separate trail that happens to share the same OSM name.
    if (Math.sqrt(bestDist) > MAX_JUMP_DEG) break;

    const w = remaining.splice(bestIdx, 1)[0];
    const seg = reversed ? [...w].reverse() : w;
    // Skip duplicate start point when segments connect exactly
    const skip = dist2(stitched[stitched.length - 1], seg[0]) < 1e-12;
    stitched.push(...(skip ? seg.slice(1) : seg));
  }

  return stitched;
}

router.post("/trail-route", async (req, res) => {
  const { name, location } = req.body as { name?: string; location?: string };

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ coords: [], center: null, found: false });
    return;
  }

  const safeName = name.trim().replace(/[^a-zA-Z0-9\s&''-]/g, "");

  try {
    let centerLat = 54.0;
    let centerLng = -2.0;
    const pad = 0.6;

    if (location) {
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

    const allWays: Coord[][] = [];

    for (const el of data.elements) {
      if (el.type === "way" && el.geometry && el.geometry.length > 1) {
        allWays.push(el.geometry.map(pt => ({ lat: pt.lat, lng: pt.lon })));
      } else if (el.type === "relation" && el.members) {
        for (const m of el.members) {
          if (m.type === "way" && m.geometry && m.geometry.length > 1) {
            allWays.push(m.geometry.map(pt => ({ lat: pt.lat, lng: pt.lon })));
          }
        }
      }
    }

    if (allWays.length > 0) {
      // Stitch segments into a connected polyline before simplifying
      const stitched = stitchWays(allWays);
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
