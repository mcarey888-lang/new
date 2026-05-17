import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ── Wikipedia photo lookup ────────────────────────────────────────────────────
//
// We use the MediaWiki pageimages API with pithumbsize=800.
// Wikimedia generates a ~960px thumbnail for this request which we proxy.
// The thumbnail is typically 150–250 KB — fast enough for a mobile hero image.
//
// The thumbnail URL is cached in-process so repeat visits are instant.

const photoCache = new Map<string, string | null>();

const WIKI_HEADERS = {
  "User-Agent": "SummitReady/1.0 (hiking training app)",
};

function cleanName(name: string): string {
  return name
    .replace(/\s*\(.*?\)\s*/g, "")  // strip parentheticals "(Goûter Route)" etc.
    .replace(/\s+route$/i, "")
    .trim();
}

async function getWikiThumbUrl(raw: string): Promise<string | null> {
  const cached = photoCache.get(raw);
  if (cached !== undefined) return cached;

  const name = cleanName(raw);
  let found: string | null = null;

  // 1. pageimages API — requests an ~800px thumbnail (Wikimedia returns ~960px)
  try {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(name)}` +
      `&prop=pageimages&pithumbsize=800&pilicense=any` +
      `&format=json&formatversion=2`;

    const res = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json() as {
        query?: { pages?: Array<{ thumbnail?: { source: string } }> };
      };
      found = data.query?.pages?.[0]?.thumbnail?.source ?? null;
    }
  } catch { /* fall through */ }

  // 2. REST summary thumbnail (fallback — smaller but reliable)
  if (!found) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
      const res = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json() as {
          thumbnail?: { source: string };
          originalimage?: { source: string };
        };
        found = data.thumbnail?.source ?? data.originalimage?.source ?? null;
      }
    } catch { /* fall through */ }
  }

  // 3. Search for canonical title, then retry once
  if (!found) {
    try {
      const url =
        `https://en.wikipedia.org/w/api.php?action=query` +
        `&list=search&srsearch=${encodeURIComponent(name + " mountain")}` +
        `&srlimit=1&format=json&formatversion=2`;
      const res = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json() as {
          query?: { search?: Array<{ title: string }> };
        };
        const title = data.query?.search?.[0]?.title;
        if (title && title.toLowerCase() !== name.toLowerCase()) {
          // single recursive call with the canonical title
          found = await getWikiThumbUrl(title);
          photoCache.set(raw, found);
          return found;
        }
      }
    } catch { /* fall through */ }
  }

  photoCache.set(raw, found);
  return found;
}

// ── Geocoding (Mapbox satellite fallback) ─────────────────────────────────────

interface Coord { lat: number; lng: number }
const locationCache = new Map<string, Coord>();

const UK_REGIONS: Record<string, Coord> = {
  "lake district":    { lat: 54.461, lng: -3.073 },
  "peak district":    { lat: 53.363, lng: -1.822 },
  "snowdonia":        { lat: 53.068, lng: -4.076 },
  "yorkshire dales":  { lat: 54.228, lng: -2.147 },
  "brecon beacons":   { lat: 51.883, lng: -3.436 },
  "cairngorms":       { lat: 57.122, lng: -3.616 },
  "ben nevis":        { lat: 56.797, lng: -5.004 },
  "glencoe":          { lat: 56.681, lng: -4.974 },
  "pennines":         { lat: 54.500, lng: -2.200 },
  "isle of skye":     { lat: 57.363, lng: -6.302 },
};

async function geocodeName(name: string): Promise<Coord> {
  const cached = locationCache.get(name);
  if (cached) return cached;
  const lower = name.toLowerCase();
  for (const [key, coord] of Object.entries(UK_REGIONS)) {
    if (lower.includes(key)) { locationCache.set(name, coord); return coord; }
  }
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(name + " mountain")}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SummitReady/1.0 (hiking training app)" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json() as Array<{ lat: string; lon: string }>;
      if (data[0]) {
        const coord: Coord = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        locationCache.set(name, coord);
        return coord;
      }
    }
  } catch { /* fall through */ }
  return { lat: 52.5, lng: -1.5 };
}

// ── GET /api/mountain-image?name=Allalinhorn ──────────────────────────────────
//
// 1. Fetches a ~960px Wikipedia thumbnail and proxies it.
//    Thumbnail is ~150–250 KB — ideal for a mobile hero image.
// 2. Falls back to Mapbox satellite if Wikipedia has no image.

router.get("/mountain-image", async (req, res) => {
  const name =
    (typeof req.query["name"]     === "string" && req.query["name"])     ||
    (typeof req.query["location"] === "string" && req.query["location"]) ||
    "";

  const width  = Math.min(parseInt(String(req.query["width"]  ?? "800"), 10) || 800, 1280);
  const height = Math.min(parseInt(String(req.query["height"] ?? "400"), 10) || 400, 800);

  if (!name) { res.status(400).end(); return; }

  try {
    const thumbUrl = await getWikiThumbUrl(name);

    if (thumbUrl) {
      const imgRes = await fetch(thumbUrl, {
        headers: WIKI_HEADERS,
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

    // ── Mapbox satellite fallback ────────────────────────────────────────────
    const token = process.env.MAPBOX_TOKEN;
    if (!token) { res.status(503).end(); return; }

    const { lat, lng } = await geocodeName(name);
    const mapUrl =
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
      `${lng.toFixed(5)},${lat.toFixed(5)},13,0/${width}x${height}@2x` +
      `?access_token=${token}`;

    const imgRes = await fetch(mapUrl, { signal: AbortSignal.timeout(8000) });
    if (!imgRes.ok) { res.status(imgRes.status).end(); return; }

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await imgRes.arrayBuffer();
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=604800");
    res.set("Content-Length", String(buffer.byteLength));
    res.send(Buffer.from(buffer));

  } catch (err) {
    req.log.warn({ err }, "Mountain image failed");
    res.status(500).end();
  }
});

router.post("/mountain-image", async (_req, res) => {
  res.json({ imageUrl: null });
});

export default router;
