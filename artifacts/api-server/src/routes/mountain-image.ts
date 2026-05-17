import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ── Wikipedia photo + coordinates lookup ──────────────────────────────────────
//
// Single MediaWiki request fetches both:
//   - pageimages  → ~960px thumbnail URL (150–250 KB, fast to proxy)
//   - coordinates → lat/lng used by the Mapbox satellite fallback
//
// Both are cached in-process so repeat visits are instant.

const WIKI_HEADERS = { "User-Agent": "SummitReady/1.0 (hiking training app)" };

interface WikiResult {
  thumbUrl: string | null;
  coord: Coord | null;
}
const wikiCache = new Map<string, WikiResult>();

interface Coord { lat: number; lng: number }

function cleanName(name: string): string {
  return name
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/\s+route$/i, "")
    .trim();
}

async function queryWikipedia(title: string): Promise<WikiResult> {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query` +
    `&titles=${encodeURIComponent(title)}` +
    `&prop=pageimages%7Ccoordinates&pithumbsize=800&pilicense=any` +
    `&format=json&formatversion=2`;

  const res = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(7000) });
  if (!res.ok) return { thumbUrl: null, coord: null };

  const data = await res.json() as {
    query?: {
      pages?: Array<{
        thumbnail?:   { source: string };
        coordinates?: Array<{ lat: number; lon: number; primary?: boolean }>;
      }>;
    };
  };

  const page = data.query?.pages?.[0];
  if (!page) return { thumbUrl: null, coord: null };

  const thumbUrl  = page.thumbnail?.source ?? null;
  const coordData = page.coordinates?.find(c => c.primary) ?? page.coordinates?.[0];
  const coord     = coordData ? { lat: coordData.lat, lng: coordData.lon } : null;

  return { thumbUrl, coord };
}

async function getWikiData(raw: string): Promise<WikiResult> {
  const cached = wikiCache.get(raw);
  if (cached !== undefined) return cached;

  const name = cleanName(raw);

  // 1. Direct title lookup (photo + coordinates in one request)
  let result: WikiResult = { thumbUrl: null, coord: null };
  try {
    result = await queryWikipedia(name);
  } catch { /* fall through */ }

  // 2. REST summary fallback for thumbnail (coordinates may still come from step 1)
  if (!result.thumbUrl) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
      const res = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json() as {
          thumbnail?: { source: string };
          coordinates?: { lat: number; lon: number };
        };
        result.thumbUrl = data.thumbnail?.source ?? null;
        if (!result.coord && data.coordinates) {
          result.coord = { lat: data.coordinates.lat, lng: data.coordinates.lon };
        }
      }
    } catch { /* fall through */ }
  }

  // 3. Search for canonical title, retry once
  if (!result.thumbUrl) {
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
          const r2 = await getWikiData(title);
          wikiCache.set(raw, r2);
          return r2;
        }
      }
    } catch { /* fall through */ }
  }

  wikiCache.set(raw, result);
  return result;
}

// ── Mapbox geocoding fallback ─────────────────────────────────────────────────
//
// Used only when Wikipedia has no coordinates.
// Tries Nominatim with and without "mountain" suffix before defaulting.

const UK_PEAKS: Record<string, Coord> = {
  "ben nevis":       { lat: 56.797, lng: -5.004 },
  "snowdon":         { lat: 53.068, lng: -4.076 },
  "scafell pike":    { lat: 54.454, lng: -3.211 },
  "helvellyn":       { lat: 54.527, lng: -3.016 },
  "cairn gorm":      { lat: 57.117, lng: -3.643 },
  "cairngorms":      { lat: 57.122, lng: -3.616 },
  "lake district":   { lat: 54.461, lng: -3.073 },
  "peak district":   { lat: 53.363, lng: -1.822 },
  "snowdonia":       { lat: 53.068, lng: -4.076 },
  "glencoe":         { lat: 56.681, lng: -4.974 },
  "isle of skye":    { lat: 57.363, lng: -6.302 },
};

async function fallbackGeocode(name: string): Promise<Coord> {
  const lower = name.toLowerCase();
  for (const [key, coord] of Object.entries(UK_PEAKS)) {
    if (lower.includes(key)) return coord;
  }
  for (const query of [name, `${name} mountain`]) {
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: WIKI_HEADERS,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json() as Array<{ lat: string; lon: string }>;
        if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch { /* fall through */ }
  }
  return { lat: 46.818, lng: 8.228 }; // centre of Switzerland — sensible Alps default
}

// ── GET /api/mountain-image?name=Allalinhorn ──────────────────────────────────

router.get("/mountain-image", async (req, res) => {
  const name =
    (typeof req.query["name"]     === "string" && req.query["name"])     ||
    (typeof req.query["location"] === "string" && req.query["location"]) ||
    "";

  const width  = Math.min(parseInt(String(req.query["width"]  ?? "800"), 10) || 800, 1280);
  const height = Math.min(parseInt(String(req.query["height"] ?? "400"), 10) || 400, 800);

  if (!name) { res.status(400).end(); return; }

  try {
    const { thumbUrl, coord } = await getWikiData(name);

    // ── Wikipedia thumbnail proxy ────────────────────────────────────────────
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

    const { lat, lng } = coord ?? await fallbackGeocode(name);
    const mapUrl =
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
      `${lng.toFixed(5)},${lat.toFixed(5)},13,0/${width}x${height}@2x` +
      `?access_token=${token}`;

    const imgRes = await fetch(mapUrl, { signal: AbortSignal.timeout(8000) });
    if (!imgRes.ok) { res.status(imgRes.status).end(); return; }

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await imgRes.arrayBuffer();
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=604800"); // 7 days
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
