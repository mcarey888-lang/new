import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ── Image source strategy ─────────────────────────────────────────────────────
//
//  0. Curated Wikimedia Commons files — hand-picked, authoritative photos for
//     each of the known bundle mountains. Tried first; never returns paintings.
//
//  1. Wikimedia Commons search       — "photograph" bias in all queries.
//
//  2. Wikipedia pageimages           — lead article image. Skipped when the
//     curated map or Commons search succeeded; Wikipedia is unreliable for
//     famous peaks (often returns historical paintings or prominence charts).
//
//  3. Mapbox satellite               — pixel-perfect aerial. Used when all
//     photo sources fail.

const WIKI_HEADERS = { "User-Agent": "SummitReady/1.0 (hiking training app)" };

interface Coord { lat: number; lng: number }

interface ImageResult {
  thumbUrl: string | null;
  coord:    Coord | null;
}

const imageCache = new Map<string, ImageResult>();

// ── 0. Curated Commons files for known mountains ──────────────────────────────
//
//  Each entry lists candidate filenames in preference order.
//  Looked up via the Commons imageinfo API — if a file is missing we fall
//  through to the next candidate, then to the live search pipeline.

const CURATED_MOUNTAIN_FILES: Record<string, string[]> = {
  // Filenames verified against live Commons imageinfo API — landscape JPEGs confirmed to exist.
  "pendle hill": [
    "Pendle_Hill_and_the_Ribble_Valley_-_geograph.org.uk_-_72304.jpg",
  ],
  "kilimanjaro": [
    "Kilimanjaro_dec_2009_edit2.jpg",   // Classic aerial view from Amboseli, snow cap visible
    "Kilimanjaro_2_edit.jpg",
  ],
  "mont blanc": [
    "Mont_Blanc_from_Aosta_Valley.JPG", // Wide valley view with massif
    "Mont_Blanc_depuis_Mont_Mourex.jpg",
    "Mont_Blanc,_2017.jpg",
  ],
  "ben nevis": [
    "Ben-nevis-from-corpach.jpg",        // Classic view from Corpach
    "Ben_Nevis_from_the_Corpach_area.jpg",
  ],
  "matterhorn": [
    "Matterhorn_and_Riffelhorn_as_seen_from_Gornergrat,_Wallis,_Switzerland,_2012_August.jpg",
    "Matterhorn_(3015374973).jpg",
    "Matterhorn_and_Stellisee_in_Twilight.jpg",
  ],
  "aconcagua": [
    "Aconcagua_SouthSummit2007.jpg",     // Confirmed landscape orientation
    "Aconcagua_RegionofTop.jpg",
  ],
  "mount elbrus": [
    "Winter_Elbrus._South_slope_of_Cheget_Mountain_from_the_top.jpg",
    "Elbrus,_Гора_Эльбрус_2008.jpg",
  ],
  "mount fuji": [
    "Sunrise_with_Mount_Fuji_-_March_2025.jpg",
    "Mt._Fuji_(5334430699).jpg",
    "Mount_fuji_5th_station.jpg",
  ],
  "everest base camp": [
    "Going_back_from_Everest_Base_Camp_(15094746501).jpg",
    "Sagarmatha_National_Park-Gorak_Shep_to_Pheriche_2013-05-06_08-05-31.jpg",
  ],
  "table mountain": [
    "Cape_Town_(ZA),_Table_Mountain_--_2024_--_2821.jpg",
    "Cape_Town_(ZA),_Table_Mountain_--_2024_--_2822.jpg",
  ],
  "tour du mont blanc": [
    "Mont_Blanc_from_Aosta_Valley.JPG",
    "Mont_Blanc,_2017.jpg",
  ],
  "grossglockner": [
    "Großglockner_from_Pasterze_glacier.jpg",
  ],
  "toubkal": [
    "Toubkal_summer.jpg",
  ],
};

const CURATED_LOCAL_MOUNTAIN_FILES: Array<{
  name: string;
  coord: Coord;
  maxDistanceKm: number;
  files: string[];
}> = [
  {
    name: "bull hill",
    coord: { lat: 53.6641933, lng: -2.3544012 },
    maxDistanceKm: 15,
    files: [
      "Bull_Hill_and_West_Moss_-_geograph.org.uk_-_3953179.jpg",
    ],
  },
];

function distanceKm(a: Coord, b: Coord): number {
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function lookupCommonsFile(filename: string): Promise<string | null> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&titles=${encodeURIComponent("File:" + filename)}` +
    `&prop=imageinfo` +
    `&iiprop=url%7Cdimensions%7Cmime` +
    `&iiurlwidth=960` +
    `&format=json&formatversion=2`;

  const res = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;

  const data = await res.json() as {
    query?: {
      pages?: Array<{
        missing?: boolean;
        imageinfo?: Array<{ url?: string; thumburl?: string; mime?: string; width?: number; height?: number }>;
      }>;
    };
  };

  const page = data.query?.pages?.[0];
  if (!page || page.missing) return null;

  const info = page.imageinfo?.[0];
  if (!info) return null;

  // Must be a raster photo format
  const mime = info.mime ?? "";
  if (!mime.startsWith("image/jpeg") && !mime.startsWith("image/png") && !mime.startsWith("image/webp")) return null;

  // Reject portrait orientation
  if (info.width && info.height && info.height > info.width * 1.05) return null;

  return info.thumburl ?? info.url ?? null;
}

async function getCuratedImage(name: string, hintCoord?: Coord): Promise<string | null> {
  const cleaned = cleanName(name).toLowerCase();

  let candidates: string[] = [];
  if (hintCoord) {
    const localMatch = CURATED_LOCAL_MOUNTAIN_FILES.find(entry =>
      cleaned === entry.name && distanceKm(hintCoord, entry.coord) <= entry.maxDistanceKm
    );
    if (localMatch) candidates = localMatch.files;
  }

  for (const [key, files] of Object.entries(CURATED_MOUNTAIN_FILES)) {
    if (candidates.length > 0) break;
    if (cleaned.includes(key) || key.includes(cleaned)) {
      candidates = files;
      break;
    }
  }
  if (candidates.length === 0) return null;

  for (const filename of candidates) {
    try {
      const url = await lookupCommonsFile(filename);
      if (url) return url;
    } catch { /* try next candidate */ }
  }

  return null;
}

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
  // Obvious non-photos
  /portrait/i, /headshot/i, /bust/i, /statue/i, /monument/i, /plaque/i, /gravestone/i, /memorial/i,
  // Artwork / historical illustrations — catch even when "painting" isn't in the name
  /\bpainting\b/i, /watercolou?r/i, /\boil.on\b/i, /\bsketch\b/i, /\bdrawing\b/i,
  /\bartwork\b/i, /\billustration\b/i, /\bengraving\b/i, /\blithograph\b/i,
  /\bprint\b/i, /\bwoodcut\b/i, /\baquatint\b/i,
  // Historical paintings often have dates in the filename
  /\b17\d\d\b/i, /\b18\d\d\b/i, /19th.century/i, /18th.century/i, /17th.century/i,
  // Animals / unrelated subjects
  /\bhorse\b/i, /\bcow\b/i, /\bdog\b/i, /\bsheep\b/i, /\bgoat\b/i,
  /\bbird\b/i, /\bfish\b/i, /\binsect\b/i, /\bbutterfly\b/i,
  // Heraldry / logos
  /coat.of.arms/i, /\bflag\b/i, /\blogo\b/i, /\bbadge\b/i, /heraldic/i,
  // Maps / diagrams
  /\bmap\b/i, /\bdiagram\b/i, /\bchart\b/i, /\bicon\b/i, /\bsign\b/i,
  /prominence/i, /isolation/i, /topograph/i, /\btopo\b/i,
  /elevation.profile/i, /elevation.chart/i, /relief.map/i,
  /\bprofile\b/i, /\bschematic\b/i,
  // People
  /\bperson\b/i, /\bpeople\b/i,
  // SVG / non-photo formats
  /\.svg$/i, /\.gif$/i,
  // Named painters ("by John Smith")
  /_by_[A-Z]/i,
];

function isImageSuitable(url: string, w?: number, h?: number): boolean {
  const filename = decodeURIComponent(url.split("/").pop() ?? "").toLowerCase();
  if (REJECT_PATTERNS.some(p => p.test(filename))) return false;
  // Portrait orientation → likely a person photo
  if (w && h && h > w * 1.05) return false;
  return true;
}

// ── 1. Wikimedia Commons search ───────────────────────────────────────────────

interface CommonsImageInfo {
  url:       string;
  thumburl?: string;
  width?:    number;
  height?:   number;
  mime?:     string;
}

async function searchCommons(query: string): Promise<string | null> {
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

    const mime = info.mime ?? "";
    if (!mime.startsWith("image/jpeg") && !mime.startsWith("image/png") && !mime.startsWith("image/webp")) continue;

    const thumb = info.thumburl ?? info.url;
    if (!thumb) continue;

    if (isImageSuitable(thumb, info.width, info.height)) return thumb;
  }

  return null;
}

async function searchCommonsNear(name: string, coord: Coord): Promise<string | null> {
  const apiUrl =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&generator=geosearch` +
    `&ggsprimary=all` +
    `&ggsnamespace=6` +
    `&ggsradius=10000` +
    `&ggslimit=50` +
    `&ggscoord=${encodeURIComponent(`${coord.lat}|${coord.lng}`)}` +
    `&prop=imageinfo` +
    `&iiprop=url%7Cdimensions%7Cmime` +
    `&iiurlwidth=960` +
    `&format=json&formatversion=2`;

  const res = await fetch(apiUrl, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;

  const data = await res.json() as {
    query?: {
      pages?: Array<{
        title: string;
        imageinfo?: CommonsImageInfo[];
      }>;
    };
  };

  const nameWords = cleanName(name)
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2);

  for (const page of data.query?.pages ?? []) {
    const title = page.title.toLowerCase();
    if (!nameWords.every(word => title.includes(word))) continue;

    const info = page.imageinfo?.[0];
    if (!info) continue;

    const mime = info.mime ?? "";
    if (!mime.startsWith("image/jpeg") && !mime.startsWith("image/png") && !mime.startsWith("image/webp")) continue;

    const thumb = info.thumburl ?? info.url;
    if (thumb && isImageSuitable(thumb, info.width, info.height)) return thumb;
  }

  return null;
}

async function getCommonsImage(name: string, location?: string, coord?: Coord): Promise<string | null> {
  const cleaned = cleanName(name);

  if (coord) {
    try {
      const nearbyResult = await searchCommonsNear(cleaned, coord);
      if (nearbyResult) return nearbyResult;
    } catch { /* fall through to text search */ }
  }

  // Location-specific searches must come first so duplicated names such as
  // Bull Hill resolve near the user's training area rather than another country.
  const queries: string[] = [];
  if (location) {
    const cleanedLoc = cleanName(location);
    queries.push(
      `${cleaned} ${cleanedLoc} photograph`,
      `${cleaned} ${cleanedLoc} landscape`,
    );
  }
  queries.push(
    `${cleaned} mountain photograph`,
    `${cleaned} mountain landscape photograph`,
    `${cleaned} summit photograph`,
    `${cleaned} mountain landscape`,
    `${cleaned} peak photograph`,
    `${cleaned}`,
  );

  for (const q of queries) {
    try {
      const result = await searchCommons(q);
      if (result) return result;
    } catch { /* fall through */ }
  }

  return null;
}

// ── 2. Wikipedia pageimages (coordinates + last-resort image) ─────────────────

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

  try { result = await queryWikipedia(cleaned); } catch { /* fall through */ }

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

async function getImageData(name: string, location?: string, hintCoord?: Coord): Promise<ImageResult> {
  const coordKey = hintCoord ? `${hintCoord.lat.toFixed(4)},${hintCoord.lng.toFixed(4)}` : "";
  const cacheKey = `${name}::${location ?? ""}::${coordKey}`;
  const cached   = imageCache.get(cacheKey);
  if (cached !== undefined) return cached;

  // Step 1: try the curated map first — authoritative photos, never paintings
  const curatedUrl = await getCuratedImage(name, hintCoord).catch(() => null);

  let thumbUrl: string | null = curatedUrl;
  let coord:    Coord  | null = null;

  if (!thumbUrl) {
    // Step 2+3: Commons search + Wikipedia in parallel (for coords + fallback image)
    const [commonsRes, wikiRes] = await Promise.allSettled([
      getCommonsImage(name, location, hintCoord),
      getWikipediaData(name),
    ]);

    thumbUrl =
      (commonsRes.status === "fulfilled" ? commonsRes.value : null) ??
      (wikiRes.status    === "fulfilled" ? wikiRes.value.thumbUrl : null);

    coord = hintCoord ?? (wikiRes.status === "fulfilled" ? wikiRes.value.coord : null);
  } else {
    coord = hintCoord ?? null;
    // Still fetch coords for the Mapbox fallback, without waiting for image
    if (!coord) getWikipediaData(name).then(r => {
      if (r.coord) {
        const existing = imageCache.get(cacheKey);
        if (existing && !existing.coord) imageCache.set(cacheKey, { ...existing, coord: r.coord });
      }
    }).catch(() => {/* ignore */});
  }

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
  return { lat: 54.0, lng: -2.0 };
}

// ── GET /api/mountain-image ───────────────────────────────────────────────────

router.get("/mountain-image", async (req, res) => {
  const rawName     = typeof req.query["name"]     === "string" ? req.query["name"]     : "";
  const rawLocation = typeof req.query["location"] === "string" ? req.query["location"] : "";
  const rawLat      = typeof req.query["lat"]      === "string" ? Number(req.query["lat"]) : NaN;
  const rawLng      = typeof req.query["lng"]      === "string" ? Number(req.query["lng"]) : NaN;
  const hintCoord   = Number.isFinite(rawLat) && Number.isFinite(rawLng)
    ? { lat: rawLat, lng: rawLng }
    : undefined;
  const name        = rawName || rawLocation;

  const width  = Math.min(parseInt(String(req.query["width"]  ?? "800"), 10) || 800, 1280);
  const height = Math.min(parseInt(String(req.query["height"] ?? "400"), 10) || 400,  800);

  if (!name) { res.status(400).end(); return; }

  try {
    const { thumbUrl, coord } = await getImageData(name, rawLocation || undefined, hintCoord);

    // ── Proxy the photo ───────────────────────────────────────────────────────
    if (thumbUrl) {
      const imgRes = await fetch(thumbUrl, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(10000) });
      if (imgRes.ok) {
        const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
        // Double-check we're not proxying an SVG or HTML error page
        if (contentType.includes("svg") || contentType.includes("html") || contentType.includes("text")) {
          // Fall through to Mapbox
        } else {
          const buffer = await imgRes.arrayBuffer();
          res.set("Content-Type",   contentType);
          res.set("Cache-Control",  "public, max-age=2592000"); // 30 days
          res.set("Content-Length", String(buffer.byteLength));
          res.send(Buffer.from(buffer));
          return;
        }
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
