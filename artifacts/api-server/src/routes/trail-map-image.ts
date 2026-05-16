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

const MAX_JUMP_DEG = 0.006;

function stitchWays(ways: Coord[][]): Coord[] {
  if (ways.length === 0) return [];
  if (ways.length === 1) return ways[0];
  const dist2 = (a: Coord, b: Coord) => (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;
  const remaining = ways.map(w => [...w]);
  remaining.sort((a, b) => b.length - a.length);
  const stitched: Coord[] = [...remaining.shift()!];
  while (remaining.length > 0) {
    const tail = stitched[stitched.length - 1];
    let bestIdx = -1, bestDist = Infinity, reversed = false;
    for (let i = 0; i < remaining.length; i++) {
      const w = remaining[i];
      const ds = dist2(tail, w[0]);
      const de = dist2(tail, w[w.length - 1]);
      if (ds < bestDist) { bestDist = ds; bestIdx = i; reversed = false; }
      if (de < bestDist) { bestDist = de; bestIdx = i; reversed = true; }
    }
    if (Math.sqrt(bestDist) > MAX_JUMP_DEG) break;
    const w = remaining.splice(bestIdx, 1)[0];
    const seg = reversed ? [...w].reverse() : w;
    const skip = dist2(stitched[stitched.length - 1], seg[0]) < 1e-12;
    stitched.push(...(skip ? seg.slice(1) : seg));
  }
  return stitched;
}

// Encode coords as a Mapbox-compatible polyline overlay string.
// Mapbox Static Images accepts GeoJSON overlays via the path param —
// we use a simplified polyline with at most 100 points to stay well
// within URL length limits.
function toMapboxGeoJsonPath(coords: Coord[], color: string): string {
  const limited = simplifyCoords(coords, 100);
  const coordinates = limited.map(c => [
    Math.round(c.lng * 100000) / 100000,
    Math.round(c.lat * 100000) / 100000,
  ]);
  const geojson = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates },
  };
  return `geojson(${encodeURIComponent(JSON.stringify(geojson))})`;
}

async function fetchRouteCoords(
  name: string,
  location?: string
): Promise<{ coords: Coord[]; center: Coord } | null> {
  const safeName = name.trim().replace(/[^a-zA-Z0-9\s&''-]/g, "");
  let centerLat = 54.0, centerLng = -2.0;
  const pad = 0.6;

  if (location) {
    try {
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
    } catch { /* use defaults */ }
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

  if (!overpassRes.ok) return null;

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

  if (allWays.length === 0) return null;

  const stitched = stitchWays(allWays);
  const center = {
    lat: stitched.reduce((s, c) => s + c.lat, 0) / stitched.length,
    lng: stitched.reduce((s, c) => s + c.lng, 0) / stitched.length,
  };
  return { coords: stitched, center };
}

// GET /api/trail-map-image?name=Kinder+Scout+Circular&location=Peak+District&color=3ECF75&width=800&height=400
router.get("/trail-map-image", async (req, res) => {
  const { name, location, color = "3ECF75", width = "800", height = "400" } =
    req.query as Record<string, string>;

  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    res.status(503).json({ error: "Mapbox token not configured" });
    return;
  }

  if (!name || name.trim().length < 2) {
    res.status(400).end();
    return;
  }

  const w = Math.min(parseInt(width) || 800, 1280);
  const h = Math.min(parseInt(height) || 400, 1280);
  const safeColor = color.replace(/[^0-9a-fA-F]/g, "").slice(0, 6) || "3ECF75";

  try {
    const route = await fetchRouteCoords(name, location);

    let mapboxUrl: string;

    if (route && route.coords.length >= 2) {
      const overlayPath = toMapboxGeoJsonPath(route.coords, safeColor);

      // Style the line: stroke-width 4, color from param, opacity 0.9
      const styledOverlay =
        `geojson(${encodeURIComponent(JSON.stringify({
          type: "Feature",
          properties: { "stroke": `#${safeColor}`, "stroke-width": 4, "stroke-opacity": 0.9 },
          geometry: {
            type: "LineString",
            coordinates: simplifyCoords(route.coords, 100).map(c => [
              Math.round(c.lng * 100000) / 100000,
              Math.round(c.lat * 100000) / 100000,
            ]),
          },
        }))})`;

      // Use "auto" zoom to fit the route, dark style
      mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${styledOverlay}/auto/${w}x${h}@2x?padding=40&access_token=${token}`;
    } else {
      // No OSM data — fall back to a plain location pin using the geocoded center
      let lat = 54.0, lng = -2.0;
      if (location) {
        try {
          const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
          const geoRes = await fetch(geoUrl, {
            signal: AbortSignal.timeout(6000),
            headers: { "User-Agent": "SummitReady/1.0" },
          });
          if (geoRes.ok) {
            const d = await geoRes.json() as Array<{ lat: string; lon: string }>;
            if (d.length > 0) { lat = parseFloat(d[0].lat); lng = parseFloat(d[0].lon); }
          }
        } catch { /* defaults */ }
      }
      mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${lng},${lat},11/${w}x${h}@2x?access_token=${token}`;
    }

    const imgRes = await fetch(mapboxUrl, {
      headers: { "User-Agent": "SummitReady/1.0" },
      signal: AbortSignal.timeout(15000),
    });

    if (!imgRes.ok) {
      const errText = await imgRes.text();
      req.log.warn({ status: imgRes.status, errText }, "Mapbox Static Images request failed");
      res.status(502).end();
      return;
    }

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await imgRes.arrayBuffer();

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.set("Content-Length", String(buffer.byteLength));
    res.send(Buffer.from(buffer));
  } catch (err) {
    req.log.warn({ err }, "Trail map image failed");
    res.status(500).end();
  }
});

export default router;
