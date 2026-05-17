import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface Coord { lat: number; lng: number }

// ── Geocoding (same region table as trail-map-image) ──────────────────────────

const locationCache = new Map<string, Coord>();

const UK_REGIONS: Record<string, Coord> = {
  "lake district":    { lat: 54.461, lng: -3.073 },
  "peak district":    { lat: 53.363, lng: -1.822 },
  "snowdonia":        { lat: 53.068, lng: -4.076 },
  "yorkshire dales":  { lat: 54.228, lng: -2.147 },
  "brecon beacons":   { lat: 51.883, lng: -3.436 },
  "dartmoor":         { lat: 50.578, lng: -3.905 },
  "exmoor":           { lat: 51.139, lng: -3.648 },
  "cairngorms":       { lat: 57.122, lng: -3.616 },
  "ben nevis":        { lat: 56.797, lng: -5.004 },
  "fort william":     { lat: 56.820, lng: -5.105 },
  "glencoe":          { lat: 56.681, lng: -4.974 },
  "pennines":         { lat: 54.500, lng: -2.200 },
  "north york moors": { lat: 54.365, lng: -0.914 },
  "new forest":       { lat: 50.863, lng: -1.577 },
  "south downs":      { lat: 50.962, lng: -0.553 },
  "cotswolds":        { lat: 51.853, lng: -1.809 },
  "pembrokeshire":    { lat: 51.833, lng: -4.917 },
  "isle of skye":     { lat: 57.363, lng: -6.302 },
  "west pennine":     { lat: 53.652, lng: -2.408 },
  "dark peak":        { lat: 53.452, lng: -1.886 },
  "ashbourne":        { lat: 53.017, lng: -1.734 },
};

async function geocodeLocation(location: string): Promise<Coord> {
  const cached = locationCache.get(location);
  if (cached) return cached;

  const locLower = location.toLowerCase();
  for (const [key, coord] of Object.entries(UK_REGIONS)) {
    if (locLower.includes(key)) {
      locationCache.set(location, coord);
      return coord;
    }
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(location)}&format=json&limit=1&addressdetails=0`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SummitReady/1.0 (hiking training app)" },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json() as Array<{ lat: string; lon: string }>;
      if (data.length > 0) {
        const coord: Coord = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        locationCache.set(location, coord);
        return coord;
      }
    }
  } catch { /* fall through */ }

  // Last resort: centre of England
  return { lat: 52.5, lng: -1.5 };
}

// ── Mapbox satellite hero image ────────────────────────────────────────────────
//
// Returns a Mapbox Static Images satellite tile centred on the trail's location.
// We proxy it through the server so MAPBOX_TOKEN stays server-side.
// GET /api/mountain-image?location=Peak+District,+Derbyshire&width=800&height=400

router.get("/mountain-image", async (req, res) => {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) { res.status(503).end(); return; }

  const location = typeof req.query["location"] === "string" ? req.query["location"] : "";
  const width  = Math.min(parseInt(String(req.query["width"]  ?? "800"), 10) || 800, 1280);
  const height = Math.min(parseInt(String(req.query["height"] ?? "400"), 10) || 400, 800);

  try {
    const { lat, lng } = await geocodeLocation(location || "United Kingdom");

    // satellite-streets-v12 at zoom 12 gives a ~10km wide aerial view — ideal for trail heroes
    const url =
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
      `${lng.toFixed(5)},${lat.toFixed(5)},12,0/${width}x${height}@2x` +
      `?access_token=${token}`;

    const imgRes = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!imgRes.ok) {
      res.status(imgRes.status).end();
      return;
    }

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await imgRes.arrayBuffer();

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=604800"); // 7 days — satellite tiles don't change
    res.set("Content-Length", String(buffer.byteLength));
    res.send(Buffer.from(buffer));
  } catch (err) {
    req.log.warn({ err }, "Mountain image (satellite) failed");
    res.status(500).end();
  }
});

// POST — legacy endpoint kept for compatibility
router.post("/mountain-image", async (req, res) => {
  res.json({ imageUrl: null });
});

export default router;
