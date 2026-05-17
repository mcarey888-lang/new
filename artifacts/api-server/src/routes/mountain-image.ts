import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ── Wikipedia photo cache ─────────────────────────────────────────────────────

const photoCache = new Map<string, string | null>(); // name → image URL or null

/**
 * Try to get a real summit/mountain photo from Wikipedia.
 * Uses the REST summary API first (fast, single request).
 * Falls back to the MediaWiki pageimages API for a higher-res thumbnail.
 * Returns the image URL string, or null if nothing found.
 */
async function getWikipediaPhoto(name: string): Promise<string | null> {
  const cached = photoCache.get(name);
  if (cached !== undefined) return cached;

  // Clean the name for Wikipedia: strip common suffixes that confuse the lookup
  const searchName = name
    .replace(/\s*\(.*?\)\s*/g, "")   // remove parenthetical e.g. "(Goûter Route)"
    .replace(/\s+route$/i, "")        // remove trailing "route"
    .trim();

  // 1. REST summary API — fast, returns originalimage.source
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchName)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SummitReady/1.0 (hiking training app; contact@summitready.app)" },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json() as {
        originalimage?: { source: string };
        thumbnail?: { source: string };
        type?: string;
      };
      // Prefer original, fall back to thumbnail
      const src = data.originalimage?.source ?? data.thumbnail?.source ?? null;
      if (src) {
        photoCache.set(name, src);
        return src;
      }
    }
  } catch { /* fall through to next strategy */ }

  // 2. MediaWiki pageimages API — wider search, higher-res thumbnail
  try {
    const apiUrl =
      `https://en.wikipedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(searchName)}` +
      `&prop=pageimages&pithumbsize=1200&pilicense=any` +
      `&format=json&formatversion=2`;
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "SummitReady/1.0 (hiking training app; contact@summitready.app)" },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json() as {
        query?: { pages?: Array<{ thumbnail?: { source: string } }> };
      };
      const pages = data.query?.pages ?? [];
      const src = pages[0]?.thumbnail?.source ?? null;
      if (src) {
        photoCache.set(name, src);
        return src;
      }
    }
  } catch { /* fall through */ }

  // 3. MediaWiki search — handles misspellings / partial names
  try {
    const searchUrl =
      `https://en.wikipedia.org/w/api.php?action=query` +
      `&list=search&srsearch=${encodeURIComponent(searchName + " mountain")}` +
      `&srlimit=1&format=json&formatversion=2`;
    const sRes = await fetch(searchUrl, {
      headers: { "User-Agent": "SummitReady/1.0 (hiking training app; contact@summitready.app)" },
      signal: AbortSignal.timeout(6000),
    });
    if (sRes.ok) {
      const sData = await sRes.json() as {
        query?: { search?: Array<{ title: string }> };
      };
      const title = sData.query?.search?.[0]?.title;
      if (title && title !== searchName) {
        // Recurse once with the canonical title
        const found = await getWikipediaPhoto(title);
        photoCache.set(name, found);
        return found;
      }
    }
  } catch { /* fall through */ }

  photoCache.set(name, null);
  return null;
}

// ── Geocoding (fallback for Mapbox satellite) ─────────────────────────────────

interface Coord { lat: number; lng: number }
const locationCache = new Map<string, Coord>();

const UK_REGIONS: Record<string, Coord> = {
  "lake district":    { lat: 54.461, lng: -3.073 },
  "peak district":    { lat: 53.363, lng: -1.822 },
  "snowdonia":        { lat: 53.068, lng: -4.076 },
  "yorkshire dales":  { lat: 54.228, lng: -2.147 },
  "brecon beacons":   { lat: 51.883, lng: -3.436 },
  "dartmoor":         { lat: 50.578, lng: -3.905 },
  "cairngorms":       { lat: 57.122, lng: -3.616 },
  "ben nevis":        { lat: 56.797, lng: -5.004 },
  "glencoe":          { lat: 56.681, lng: -4.974 },
  "pennines":         { lat: 54.500, lng: -2.200 },
  "isle of skye":     { lat: 57.363, lng: -6.302 },
};

async function geocodeName(name: string): Promise<Coord> {
  const cached = locationCache.get(name);
  if (cached) return cached;

  const nameLower = name.toLowerCase();
  for (const [key, coord] of Object.entries(UK_REGIONS)) {
    if (nameLower.includes(key)) {
      locationCache.set(name, coord);
      return coord;
    }
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(name + " mountain")}&format=json&limit=1&addressdetails=0`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SummitReady/1.0 (hiking training app)" },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json() as Array<{ lat: string; lon: string }>;
      if (data.length > 0) {
        const coord: Coord = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        locationCache.set(name, coord);
        return coord;
      }
    }
  } catch { /* fall through */ }

  return { lat: 52.5, lng: -1.5 };
}

// ── Satellite fallback ────────────────────────────────────────────────────────

async function serveSatellite(
  req: Parameters<Parameters<typeof router.get>[1]>[0],
  res: Parameters<Parameters<typeof router.get>[1]>[1],
  name: string,
  width: number,
  height: number,
) {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) { res.status(503).end(); return; }

  try {
    const { lat, lng } = await geocodeName(name);

    const url =
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
      `${lng.toFixed(5)},${lat.toFixed(5)},13,0/${width}x${height}@2x` +
      `?access_token=${token}`;

    const imgRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!imgRes.ok) { res.status(imgRes.status).end(); return; }

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await imgRes.arrayBuffer();
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=604800");
    res.set("Content-Length", String(buffer.byteLength));
    res.send(Buffer.from(buffer));
  } catch (err) {
    req.log.warn({ err }, "Mountain satellite fallback failed");
    res.status(500).end();
  }
}

// ── GET /api/mountain-image?name=Ben+Nevis ────────────────────────────────────
//
// 1. Tries Wikipedia for a real summit photograph.
// 2. Falls back to a Mapbox satellite tile centred on the mountain's coords.
//
// The `location` param is also accepted for backwards-compatibility with any
// callers that pass the trail location string instead of the hill name.

router.get("/mountain-image", async (req, res) => {
  const name =
    (typeof req.query["name"]     === "string" && req.query["name"])     ||
    (typeof req.query["location"] === "string" && req.query["location"]) ||
    "";

  const width  = Math.min(parseInt(String(req.query["width"]  ?? "800"), 10) || 800, 1280);
  const height = Math.min(parseInt(String(req.query["height"] ?? "400"), 10) || 400, 800);

  if (!name) {
    res.status(400).end();
    return;
  }

  try {
    const photoUrl = await getWikipediaPhoto(name);

    if (photoUrl) {
      // Proxy the Wikipedia image so we can set cache headers and avoid CORS
      const imgRes = await fetch(photoUrl, {
        headers: { "User-Agent": "SummitReady/1.0 (hiking training app)" },
        signal: AbortSignal.timeout(10000),
      });

      if (imgRes.ok) {
        const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
        const buffer = await imgRes.arrayBuffer();
        res.set("Content-Type", contentType);
        res.set("Cache-Control", "public, max-age=2592000"); // 30 days
        res.set("Content-Length", String(buffer.byteLength));
        res.send(Buffer.from(buffer));
        return;
      }
    }

    // Wikipedia had no image or fetch failed — use satellite
    await serveSatellite(req, res, name, width, height);
  } catch (err) {
    req.log.warn({ err }, "Mountain image failed");
    res.status(500).end();
  }
});

// POST — legacy endpoint kept for compatibility
router.post("/mountain-image", async (_req, res) => {
  res.json({ imageUrl: null });
});

export default router;
