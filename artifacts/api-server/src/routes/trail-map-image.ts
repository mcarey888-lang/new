import { Router, type IRouter } from "express";
import sharp from "sharp";

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

function nameHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0) / 0x100000000;
}

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

// ── OS Maps tile stitching ────────────────────────────────────────────────────
// Fetches a grid of OS Maps Outdoor raster tiles and composites them into a
// single PNG image centred on the trail location. No synthetic route overlay —
// OS Outdoor tiles show every footpath, contour and stile directly.

function latLngToTileXY(lat: number, lng: number, z: number): { x: number; y: number } {
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, z));
  const latRad = lat * Math.PI / 180;
  const y = Math.floor(
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, z),
  );
  return { x, y };
}

async function fetchTile(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SummitReady/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

/** Pick zoom level so the visible tile area roughly matches the trail distance. */
function pickZoom(distanceKm: number | undefined): number {
  if (!distanceKm || distanceKm <= 0) return 13;
  if (distanceKm > 20) return 12;
  if (distanceKm < 3)  return 14;
  return 13;
}

async function buildOSMapsThumbnail(opts: {
  center: Coord;
  width: number;
  height: number;
  distanceKm: number | undefined;
  osKey: string;
  color: string;
}): Promise<Buffer | null> {
  const { center, width, height, distanceKm, osKey, color } = opts;
  const zoom = pickZoom(distanceKm);
  const centerTile = latLngToTileXY(center.lat, center.lng, zoom);
  const TILE = 256;

  // 3 tiles wide × 2 tiles tall gives enough coverage at all target zoom levels
  const COLS = 3;
  const ROWS = 2;
  const startX = centerTile.x - Math.floor(COLS / 2);
  const startY = centerTile.y - Math.floor(ROWS / 2);

  // Fetch all tiles in parallel
  const tileUrls: string[][] = [];
  for (let row = 0; row < ROWS; row++) {
    const rowUrls: string[] = [];
    for (let col = 0; col < COLS; col++) {
      rowUrls.push(
        `https://api.os.uk/maps/raster/v1/zxy/Outdoor_3857/${zoom}/${startX + col}/${startY + row}.png?key=${osKey}`,
      );
    }
    tileUrls.push(rowUrls);
  }

  const tileBuffers = await Promise.all(
    tileUrls.map(row => Promise.all(row.map(fetchTile))),
  );

  // If any tile failed to load, fall through to Mapbox fallback
  if (tileBuffers.some(row => row.some(t => t === null))) return null;

  const totalW = COLS * TILE;
  const totalH = ROWS * TILE;

  // Build sharp composite list
  const composites: sharp.OverlayOptions[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      composites.push({
        input: tileBuffers[row][col] as Buffer,
        left: col * TILE,
        top:  row * TILE,
      });
    }
  }

  // Coloured pin dot at the trail centre (SVG circle)
  const pinX = Math.round(totalW / 2) - 9;
  const pinY = Math.round(totalH / 2) - 9;
  const pinColor = color.startsWith("#") ? color : `#${color}`;
  const pinSvg = Buffer.from(
    `<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="9" cy="9" r="7" fill="${pinColor}" stroke="white" stroke-width="2.5"/>` +
    `</svg>`,
  );
  composites.push({ input: pinSvg, left: pinX, top: pinY });

  try {
    // Stitch tiles + pin, then crop a centred strip to the target dimensions
    const cropLeft = Math.max(0, Math.round((totalW - width)  / 2));
    const cropTop  = Math.max(0, Math.round((totalH - height) / 2));
    const cropW    = Math.min(width,  totalW - cropLeft);
    const cropH    = Math.min(height, totalH - cropTop);

    const stitched = await sharp({
      create: { width: totalW, height: totalH, channels: 4, background: { r: 220, g: 220, b: 210, alpha: 1 } },
    })
      .composite(composites)
      .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
      .resize(width, height, { fit: "cover" })
      .png()
      .toBuffer();

    return stitched;
  } catch { return null; }
}

// ── Mapbox Directions route (fallback) ────────────────────────────────────────

function loopWaypoints(center: Coord, radiusKm: number): Array<[number, number]> {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  const angles = [0, 120, 240];
  const radii  = [1.0, 0.95, 1.05];
  const pts: Array<[number, number]> = [[center.lng, center.lat]];
  for (let i = 0; i < angles.length; i++) {
    const rad = (angles[i] * Math.PI) / 180;
    pts.push([
      center.lng + dLng * Math.sin(rad) * radii[i],
      center.lat + dLat * Math.cos(rad) * radii[i],
    ]);
  }
  pts.push([center.lng, center.lat]);
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
    trailLat,
    trailLng,
  } = req.query as Record<string, string>;

  const token = process.env.MAPBOX_TOKEN;
  if (!token) { res.status(503).json({ error: "Mapbox token not configured" }); return; }
  if (!name || name.trim().length < 2) { res.status(400).end(); return; }

  const w = Math.min(parseInt(width) || 800, 1280);
  const h = Math.min(parseInt(height) || 400, 1280);
  const safeColor = color.replace(/[^0-9a-fA-F]/g, "").slice(0, 6) || "3ECF75";
  const isDev = process.env.NODE_ENV === "development";
  const distanceKm = distance ? parseFloat(distance) : undefined;
  const osKey = process.env.OS_MAPS_KEY || undefined;

  try {
    // Resolve centre: prefer AI-provided coords, fall back to geocode + hash offset
    let center: Coord;
    const parsedTrailLat = trailLat ? parseFloat(trailLat) : NaN;
    const parsedTrailLng = trailLng ? parseFloat(trailLng) : NaN;
    if (isFinite(parsedTrailLat) && isFinite(parsedTrailLng)) {
      center = { lat: parsedTrailLat, lng: parsedTrailLng };
    } else {
      const base = await geocodeLocation(location || "United Kingdom");
      center = trailCenter(base, name.trim());
    }

    // ── OS Maps tile stitching (preferred when key is available) ──────────────
    if (osKey) {
      const thumbnail = await buildOSMapsThumbnail({
        center,
        width: w,
        height: h,
        distanceKm: isFinite(distanceKm ?? NaN) ? distanceKm : undefined,
        osKey,
        color: safeColor,
      });

      if (thumbnail) {
        if (isDev) {
          req.log.info({ center, source: "os-maps" }, "trail-map-image result");
        }
        const cacheHeader = isDev ? "no-store" : "public, max-age=86400";
        res.set("Content-Type", "image/png");
        res.set("Cache-Control", cacheHeader);
        res.set("Content-Length", String(thumbnail.byteLength));
        res.send(thumbnail);
        return;
      }
      // Fall through to Mapbox if tile stitching failed
    }

    // ── Mapbox Static Images fallback ─────────────────────────────────────────
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
        source: "mapbox-fallback",
      }, "trail-map-image result");
    }

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
        "Mapbox Static Images error",
      );
      res.status(502).end();
      return;
    }

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await imgRes.arrayBuffer();

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
