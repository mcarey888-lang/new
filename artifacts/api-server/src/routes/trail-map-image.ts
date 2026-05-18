import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface Coord { lat: number; lng: number }

// ── Geometry helpers ──────────────────────────────────────────────────────────

function simplifyCoords(coords: Coord[], maxPoints: number): Coord[] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const out: Coord[] = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[i]);
  const last = coords[coords.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function buildGeoJsonLine(coords: Coord[], color: string): string {
  const feature = {
    type: "Feature",
    properties: {
      stroke: `#${color}`,
      "stroke-width": 4,
      "stroke-opacity": 0.9,
    },
    geometry: {
      type: "LineString",
      coordinates: coords.map(c => [
        Math.round(c.lng * 100000) / 100000,
        Math.round(c.lat * 100000) / 100000,
      ]),
    },
  };
  return `geojson(${encodeURIComponent(JSON.stringify(feature))})`;
}

function midpoint(coords: Coord[]): Coord {
  const n = coords.length;
  return {
    lat: coords.reduce((s, c) => s + c.lat, 0) / n,
    lng: coords.reduce((s, c) => s + c.lng, 0) / n,
  };
}

// ── Geocoding ─────────────────────────────────────────────────────────────────
//
// Geocode the LOCATION string only (e.g. "Bacup, Lancashire").
// Cached by location so concurrent trail-card requests share one Nominatim hit
// per region instead of firing one per trail (which triggers rate-limiting).
//
// Per-trail uniqueness is handled separately by trailCenter() below.

const locationCache = new Map<string, Coord>();

const UK_REGIONS: Record<string, Coord> = {
  "lake district":   { lat: 54.461, lng: -3.073 },
  "peak district":   { lat: 53.363, lng: -1.822 },
  "snowdonia":       { lat: 53.068, lng: -4.076 },
  "yorkshire dales": { lat: 54.228, lng: -2.147 },
  "brecon beacons":  { lat: 51.883, lng: -3.436 },
  "dartmoor":        { lat: 50.578, lng: -3.905 },
  "exmoor":          { lat: 51.139, lng: -3.648 },
  "cairngorms":      { lat: 57.122, lng: -3.616 },
  "ben nevis":       { lat: 56.797, lng: -5.004 },
  "glencoe":         { lat: 56.681, lng: -4.974 },
  "pennines":        { lat: 54.500, lng: -2.200 },
  "north york moors":{ lat: 54.365, lng: -0.914 },
  "new forest":      { lat: 50.863, lng: -1.577 },
  "south downs":     { lat: 50.962, lng: -0.553 },
  "cotswolds":       { lat: 51.853, lng: -1.809 },
};

/** djb2 hash of s → float in [0, 1). Deterministic across restarts. */
function nameHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0) / 0x100000000;
}

/**
 * Offset the region centre by a deterministic amount derived from the trail
 * name (up to ±1.5 km per axis).  Guarantees a unique map position for every
 * trail even when multiple trails share the same geocoded town/region centre.
 */
function trailCenter(base: Coord, trailName: string): Coord {
  const h1 = nameHash(trailName);
  const h2 = nameHash(trailName + "\x01");
  const maxKm = 1.5;
  const dLat = (h1 * 2 - 1) * maxKm / 111.32;
  const dLng = (h2 * 2 - 1) * maxKm / (111.32 * Math.cos(base.lat * Math.PI / 180));
  return { lat: base.lat + dLat, lng: base.lng + dLng };
}

async function nominatimSearch(query: string): Promise<Coord | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SummitReady/1.0 (hiking training app)" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* fall through */ }
  return null;
}

async function geocodeLocation(location: string): Promise<Coord> {
  const key = location.toLowerCase().trim();
  const cached = locationCache.get(key);
  if (cached) return cached;

  for (const [region, coord] of Object.entries(UK_REGIONS)) {
    if (key.includes(region)) {
      locationCache.set(key, coord);
      return coord;
    }
  }

  const coord = await nominatimSearch(location);
  const result = coord ?? { lat: 54.0, lng: -2.0 };
  locationCache.set(key, result);
  return result;
}

// ── Mapbox Directions route ───────────────────────────────────────────────────
//
// Creates a realistic loop walk near `center` using the Mapbox walking-directions
// engine, which is built on OSM pedestrian / footway / path data.
//
// Strategy: 5 waypoints placed in an irregular pentagon ~1.2 km from centre,
// then closed back to start.  Mapbox snaps each waypoint to the nearest
// walkable path, so the resulting route follows ACTUAL footpaths even though
// the waypoints themselves are synthetic.

function loopWaypoints(center: Coord, radiusKm: number): Array<[number, number]> {
  // Degree offsets for 1 km.
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));

  // Irregular pentagon — slightly uneven radii so the route looks natural.
  const angles  = [90, 162, 234, 306, 18]; // degrees, starting north
  const radii   = [1.0, 0.85, 1.1, 0.9, 1.05]; // multipliers

  const pts: Array<[number, number]> = [[center.lng, center.lat]];
  for (let i = 0; i < angles.length; i++) {
    const rad = (angles[i] * Math.PI) / 180;
    pts.push([
      center.lng + dLng * Math.sin(rad) * radii[i],
      center.lat + dLat * Math.cos(rad) * radii[i],
    ]);
  }
  pts.push([center.lng, center.lat]); // close the loop
  return pts;
}

async function fetchMapboxRoute(
  center: Coord,
  radiusKm: number,
  token: string,
): Promise<Coord[] | null> {
  const waypoints = loopWaypoints(center, radiusKm);
  const coordStr = waypoints.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${coordStr}` +
    `?geometries=geojson&overview=full&access_token=${token}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SummitReady/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const data = await res.json() as {
      routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
    };
    const rawCoords = data.routes?.[0]?.geometry?.coordinates;
    if (!rawCoords || rawCoords.length < 2) return null;

    return rawCoords.map(([lng, lat]) => ({ lat, lng }));
  } catch { return null; }
}

function estimateRadiusKm(name: string, distanceKm?: number): number {
  if (distanceKm && distanceKm > 0) {
    return Math.min(3.5, Math.max(0.5, distanceKm / 8.48));
  }
  const n = name.toLowerCase();
  if (n.includes("horseshoe") || n.includes("ridge") || n.includes("traverse")) return 2.2;
  if (n.includes("great") || n.includes("long") || n.includes("fell")) return 2.0;
  if (n.includes("summit") || n.includes("mountain") || n.includes("munro")) return 1.8;
  if (n.includes("circular") || n.includes("loop") || n.includes("circuit")) return 1.2;
  if (n.includes("easy") || n.includes("short") || n.includes("gentle")) return 0.8;
  return 1.2;
}

// ── Main handler ─────────────────────────────────────────────────────────────

router.get("/trail-map-image", async (req, res) => {
  const {
    name,
    location,
    color = "3ECF75",
    width = "800",
    height = "400",
    distance,
    userLat,
    userLng,
  } = req.query as Record<string, string>;

  const token = process.env.MAPBOX_TOKEN;
  if (!token) { res.status(503).json({ error: "Mapbox token not configured" }); return; }
  if (!name || name.trim().length < 2) { res.status(400).end(); return; }

  const w = Math.min(parseInt(width) || 800, 1280);
  const h = Math.min(parseInt(height) || 400, 1280);
  const safeColor = color.replace(/[^0-9a-fA-F]/g, "").slice(0, 6) || "3ECF75";
  const isDev = process.env.NODE_ENV === "development";
  const distanceKm = distance ? parseFloat(distance) : undefined;

  try {
    // Geocode the region centre (cached per location string), then apply a
    // deterministic per-trail offset so every trail gets a unique map position.
    const base = await geocodeLocation(location || "United Kingdom");
    const center = trailCenter(base, name.trim());
    const radiusKm = estimateRadiusKm(name, isFinite(distanceKm ?? NaN) ? distanceKm : undefined);
    const routeCoords = await fetchMapboxRoute(center, radiusKm, token);
    const hasRoute = routeCoords !== null && routeCoords.length > 1;

    const pinCenter = hasRoute ? midpoint(routeCoords!) : center;

    if (isDev) {
      req.log.info({
        center,
        radiusKm,
        routePoints: routeCoords?.length ?? 0,
        hasRoute,
      }, "trail-map-image result");
    }

    // Optional live user-location marker (white circle, sent from client GPS).
    const trailPin = `pin-s-marker+${safeColor}(${pinCenter.lng.toFixed(5)},${pinCenter.lat.toFixed(5)})`;
    let userPin = "";
    if (userLat && userLng) {
      const ulat = parseFloat(userLat);
      const ulng = parseFloat(userLng);
      if (isFinite(ulat) && isFinite(ulng)) {
        userPin = `,pin-l-circle+FFFFFF(${ulng.toFixed(5)},${ulat.toFixed(5)})`;
      }
    }

    let mapboxUrl: string;

    if (hasRoute) {
      const simplified = simplifyCoords(routeCoords!, 100);
      const overlay = buildGeoJsonLine(simplified, safeColor);
      mapboxUrl =
        `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/` +
        `${trailPin}${userPin},${overlay}/auto/${w}x${h}@2x?padding=40&access_token=${token}`;
    } else {
      // Fall back to a topo map centred on the region.
      // Zoom 12 gives a 10–12 km view, showing the full walking area.
      mapboxUrl =
        `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/` +
        `${trailPin}${userPin}/${center.lng.toFixed(5)},${center.lat.toFixed(5)},12/${w}x${h}@2x` +
        `?access_token=${token}`;
    }

    const imgRes = await fetch(mapboxUrl, {
      headers: { "User-Agent": "SummitReady/1.0" },
      signal: AbortSignal.timeout(15000),
    });

    if (!imgRes.ok) {
      const errText = await imgRes.text();
      req.log.warn(
        { status: imgRes.status, errText: errText.substring(0, 300), url: mapboxUrl.replace(token, "***") },
        "Mapbox Static Images error"
      );
      res.status(502).end();
      return;
    }

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await imgRes.arrayBuffer();

    // no-store in dev so the Replit reverse proxy never caches stale images
    // during development; cache aggressively in production.
    const cacheHeader = isDev ? "no-store" : "public, max-age=86400";
    res.set("Content-Type", contentType);
    res.set("Cache-Control", cacheHeader);
    res.set("Content-Length", String(buffer.byteLength));
    res.send(Buffer.from(buffer));
  } catch (err) {
    req.log.warn({ err }, "Trail map image failed");
    res.status(500).end();
  }
});

export default router;
