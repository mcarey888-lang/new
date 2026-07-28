import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ── Image source strategy ─────────────────────────────────────────────────────
//
//  1. Wikipedia pageimages       — the lead article image chosen by Wikipedia
//     editors for that hill/mountain. Consistent and always relevant.
//
//  2. Wikimedia Commons search   — broader search if no Wikipedia article image
//     is found. Filters by orientation (landscape only) and filename keywords.
//
//  3. Mapbox satellite           — always correct, always landscape. Used when
//     neither Wiki source finds a suitable photo.
//
//  Coordinates are fetched from Wikipedia (separate from image) and used only
//  by the Mapbox fallback.

const WIKI_HEADERS = { "User-Agent": "SummitReady/1.0 (hiking training app)" };

interface Coord { lat: number; lng: number }

interface ImageResult {
  thumbUrl: string | null;
  coord:    Coord | null;
}

const imageCache = new Map<string, ImageResult>();

// ── Name cleaning ─────────────────────────────────────────────────────────────

function cleanName(raw: string): string {
  return raw
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/\b(circular|loop|route|walk|trail|path|way|hike|horseshoe|round|ridge|traverse|tour)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Image suitability filter ──────────────────────────────────────────────────

const REJECT_PATTERNS = [
  /portrait/i, /headshot/i, /bust/i, /painting/i, /drawing/i, /watercolou?r/i,
  /statue/i,   /monument/i, /plaque/i, /gravestone/i, /memorial/i,
  /\bhorse\b/i, /\bcow\b/i,  /\bdog\b/i, /\bsheep\b/i, /\bgoat\b/i,
  /\bbird\b/i,  /\bfish\b/i, /\binsect\b/i, /\bbutterfly\b/i,
  /coat.of.arms/i, /\bflag\b/i, /\blogo\b/i, /\bbadge\b/i, /heraldic/i,
  /\bmap\b/i,   /\bdiagram\b/i, /\bchart\b/i, /\bicon\b/i, /\bsign\b/i,
  /\bperson\b/i, /\bpeople\b/i, /\bportrait\b/i,
  // Topographic / elevation diagrams — Wikipedia lead images for famous peaks
  // often show prominence or isolation charts rather than actual photographs.
  /prominence/i, /isolation/i, /topograph/i, /\btopo\b/i,
  /elevation.profile/i, /elevation.chart/i, /relief.map/i,
  /\bprofile\b/i, /\bsketch\b/i, /\bschematic/i,
];

/**
 * Returns false for images that are clearly not landscape/mountain photos:
 * portrait-oriented (taller than wide) or filenames matching non-landscape keywords.
 */
function isImageSuitable(url: string, w?: number, h?: number): boolean {
  const filename = decodeURIComponent(url.split("/").pop() ?? "").toLowerCase();
  if (REJECT_PATTERNS.some(p => p.test(filename))) return false;
  // Portrait orientation → person photo. Require at least 1:1 aspect ratio.
  if (w && h && h > w * 1.05) return false;
  return true;
}

// ── 1. Wikimedia Commons search ───────────────────────────────────────────────

interface CommonsImageInfo {
  url:      string;
  thumburl?: string;
  width?:   number;
  height?:  number;
  mime?:    string;
}

async function searchCommons(query: string): Promise<string | null> {
  // generator=search in namespace 6 (File:) + imageinfo in one request
  const apiUrl =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&generator=search` +
    `&gsrsearch=${encodeURIComponent(query)}` +
    `&gsrnamespace=6` +
    `&gsrlimit=20` +
    `&prop=imageinfo` +
    `&iiprop=url%7Cdimensions%7Cmime` +
    `&iiurlwidth=960` +
    `&format=json&formatversion=2`;

  const res = await fetch(apiUrl, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;

  const data = await res.json() as {
    query?: {
      pages?: Array<{
        title:      string;
        imageinfo?: CommonsImageInfo[];
      }>;
    };
  };

  const pages = data.query?.pages ?? [];

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;

    // Only accept raster image formats
    const mime = info.mime ?? "";
    if (!mime.startsWith("image/jpeg") && !mime.startsWith("image/png") && !mime.startsWith("image/webp")) continue;

    const thumb = info.thumburl ?? info.url;
    if (!thumb) continue;

    if (isImageSuitable(thumb, info.width, info.height)) return thumb;
  }

  return null;
}

/**
 * Try Commons with progressively broader queries until we find a landscape image.
 * Priority: exact name → "mountain" bias → location fallback.
 */
async function getCommonsImage(name: string, location?: string): Promise<string | null> {
  const cleaned = cleanName(name);

  const queries = [
    `${cleaned} mountain landscape`,
    `${cleaned} fell landscape`,
    `${cleaned} peak`,
    `${cleaned}`,
  ];
  if (location) {
    const cleanedLoc = cleanName(location);
    queries.push(`${cleanedLoc} mountain landscape`, `${cleanedLoc} landscape`);
  }

  for (const q of queries) {
    try {
      const result = await searchCommons(q);
      if (result) return result;
    } catch { /* fall through */ }
  }

  return null;
}

// ── 2. Wikipedia pageimages (coordinates + fallback image) ────────────────────

interface WikiPageRaw {
  thumbnail?: { source: string; width?: number; height?: number };
  original?:  { source: string; width?: number; height?: number };
  coordinates?: Array<{ lat: number; lon: number; primary?: boolean }>;
}

async function queryWikipedia(title: string): Promise<ImageResult> {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query` +
    `&titles=${encodeURIComponent(title)}` +
    `&prop=pageimages%7Ccoordinates` +
    `&pithumbsize=960&piprop=thumbnail%7Coriginal&pilicense=any` +
    `&format=json&formatversion=2`;

  const res = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(7000) });
  if (!res.ok) return { thumbUrl: null, coord: null };

  const data = await res.json() as { query?: { pages?: WikiPageRaw[] } };
  const page  = data.query?.pages?.[0];
  if (!page)  return { thumbUrl: null, coord: null };

  const coordData = page.coordinates?.find(c => c.primary) ?? page.coordinates?.[0];
  const coord     = coordData ? { lat: coordData.lat, lng: coordData.lon } : null;

  const checkW  = page.original?.width  ?? page.thumbnail?.width;
  const checkH  = page.original?.height ?? page.thumbnail?.height;
  const rawUrl  = page.thumbnail?.source ?? null;
  const thumbUrl = rawUrl && isImageSuitable(rawUrl, checkW, checkH) ? rawUrl : null;

  return { thumbUrl, coord };
}

async function getWikipediaData(name: string): Promise<ImageResult> {
  const cleaned = cleanName(name);
  let result: ImageResult = { thumbUrl: null, coord: null };

  // Direct lookup
  try { result = await queryWikipedia(cleaned); } catch { /* fall through */ }

  // Search fallback if no image or coordinates
  if (!result.thumbUrl || !result.coord) {
    try {
      const searchUrl =
        `https://en.wikipedia.org/w/api.php?action=query` +
        `&list=search&srsearch=${encodeURIComponent(cleaned + " mountain OR fell OR peak OR hill")}` +
        `&srlimit=3&format=json&formatversion=2`;
      const res = await fetch(searchUrl, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json() as { query?: { search?: Array<{ title: string }> } };
        for (const hit of data.query?.search ?? []) {
          if (hit.title.toLowerCase() === cleaned.toLowerCase()) continue;
          const r2 = await queryWikipedia(hit.title);
          if (!result.coord)    result.coord    = r2.coord;
          if (!result.thumbUrl) result.thumbUrl = r2.thumbUrl;
          if (result.coord && result.thumbUrl) break;
        }
      }
    } catch { /* fall through */ }
  }

  return result;
}

// ── Master lookup (cached) ────────────────────────────────────────────────────

async function getImageData(name: string, location?: string): Promise<ImageResult> {
  const cacheKey = `${name}::${location ?? ""}`;
  const cached   = imageCache.get(cacheKey);
  if (cached !== undefined) return cached;

  // Run Commons search and Wikipedia lookup concurrently
  const [commonsUrl, wikiData] = await Promise.allSettled([
    getCommonsImage(name, location),
    getWikipediaData(name),
  ]);

  // Commons is tried first: it uses explicit "mountain landscape" queries and
  // avoids the prominence/isolation diagrams that Wikipedia often sets as its
  // lead article image for famous peaks (e.g. Everest, Mont Blanc).
  const thumbUrl =
    (commonsUrl.status === "fulfilled" ? commonsUrl.value : null) ??
    (wikiData.status   === "fulfilled" ? wikiData.value.thumbUrl : null);

  const coord =
    wikiData.status === "fulfilled" ? wikiData.value.coord : null;

  const result: ImageResult = { thumbUrl, coord };
  imageCache.set(cacheKey, result);
  return result;
}

// ── Mapbox geocoding fallback ─────────────────────────────────────────────────

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
      const res = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json() as Array<{ lat: string; lon: string }>;
        if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch { /* fall through */ }
  }
  return { lat: 54.0, lng: -2.0 }; // centre of England — sensible UK default
}

// ── GET /api/mountain-image ───────────────────────────────────────────────────

router.get("/mountain-image", async (req, res) => {
  const rawName     = typeof req.query["name"]     === "string" ? req.query["name"]     : "";
  const rawLocation = typeof req.query["location"] === "string" ? req.query["location"] : "";
  const name        = rawName || rawLocation;

  const width  = Math.min(parseInt(String(req.query["width"]  ?? "800"), 10) || 800, 1280);
  const height = Math.min(parseInt(String(req.query["height"] ?? "400"), 10) || 400,  800);

  if (!name) { res.status(400).end(); return; }

  try {
    const { thumbUrl, coord } = await getImageData(name, rawLocation || undefined);

    // ── Proxy the photo (Commons or Wikipedia) ───────────────────────────────
    if (thumbUrl) {
      const imgRes = await fetch(thumbUrl, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(10000) });
      if (imgRes.ok) {
        const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
        const buffer      = await imgRes.arrayBuffer();
        res.set("Content-Type",   contentType);
        res.set("Cache-Control",  "public, max-age=2592000"); // 30 days
        res.set("Content-Length", String(buffer.byteLength));
        res.send(Buffer.from(buffer));
        return;
      }
    }

    // ── Mapbox satellite fallback ─────────────────────────────────────────────
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
    const buffer      = await imgRes.arrayBuffer();
    res.set("Content-Type",   contentType);
    res.set("Cache-Control",  "public, max-age=604800"); // 7 days
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
