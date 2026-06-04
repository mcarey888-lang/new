import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, cachedHills } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Normalise a UK postcode that arrives without a space ("bb44bh" → "BB4 4BH")
function normalizeLocation(loc: string): string {
  const stripped = loc.replace(/\s+/g, "").toUpperCase();
  const match = stripped.match(/^([A-Z]{1,2}[0-9][0-9A-Z]?)([0-9][A-Z]{2})$/);
  if (match) return `${match[1]} ${match[2]}`;
  return loc;
}

// Accept both "Easy-Mod" (hyphen) and "Easy–Mod" (en-dash) from the AI
const gradeSchema = z
  .string()
  .transform(v => v.replace(/Easy[\s\-–]+Mod/i, "Easy–Mod").trim())
  .pipe(z.enum(["Easy", "Easy–Mod", "Moderate", "Hard", "Alpine"]));

const HillSchema = z.object({
  name: z.string(),
  elevation: z.number(),
  distance: z.number(),
  repeats: z.number(),
  totalElevation: z.number(),
  surface: z.string(),
  grade: gradeSchema,
  emoji: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  routeType: z.enum(["hill", "circular", "out-and-back"]).nullish(),
  routeDistance: z.number().nullish(),
  estimatedTime: z.string().nullish(),
});

type Hill = z.infer<typeof HillSchema>;

const SEARCH_SYSTEM_PROMPT = `You are an expert on hiking and trail running areas worldwide. Given a specific hill or trail name and a base location, return realistic data for that hill. Return ONLY valid JSON — no markdown, no explanation:

{
  "hill": {
    "name": string,
    "elevation": number,
    "distance": number,
    "repeats": number,
    "totalElevation": number,
    "surface": string,
    "grade": "Easy" | "Easy–Mod" | "Moderate" | "Hard" | "Alpine",
    "emoji": "🌿" | "⛰️" | "🏔️" | "🗻",
    "lat": number,
    "lng": number
  }
}

CRITICAL — elevation definition:
- elevation = the vertical height gained (in metres) walking UP from the typical start point (car park / trailhead) to the summit, for ONE repeat
- This is NOT the summit's altitude above sea level
- This is NOT the total route distance
- Example: Pendle Hill summit is 557m above sea level, but the typical ascent from the Nick of Pendle car park (at ~270m) gains approximately 290m — so elevation = 290
- Example: Snowdon is 1085m above sea level, but the Pyg Track gains ~750m from the Pen-y-Pass car park — so elevation = 750
- Example: Scafell Pike summit is 978m, the Wasdale Head approach gains ~900m — so elevation = 900
- Always use the ASCENT (height gained) for a typical single climb, not the peak's altitude above sea level

Other rules:
- distance = estimated distance in km from the base location to the hill's trailhead
- repeats = recommended number of repeats for a good training session (1-5)
- totalElevation = elevation × repeats
- surface = brief description e.g. "Grassy moorland", "Rocky path"
- grade: Easy ≤ 150m gain, Easy–Mod 150-300m, Moderate 300-500m, Hard 500-700m, Alpine 700m+
- emoji: 🌿 for Easy, ⛰️ for Easy–Mod or Moderate, 🏔️ for Hard, 🗻 for Alpine
- lat/lng = accurate GPS coordinates of the hill summit (decimal degrees, 4 decimal places)
- Use real, accurate elevation gain data for well-known hills and peaks`;

const LOOKUP_SYSTEM_PROMPT = `You are an expert on local hiking and hill training areas. Given a location and radius, return nearby hills and fells that are good for training repeats — prioritising distinct named hills over circular routes. Return ONLY valid JSON — no markdown, no explanation:

{
  "hills": [
    {
      "name": string,
      "elevation": number,
      "distance": number,
      "repeats": number,
      "totalElevation": number,
      "surface": string,
      "grade": "Easy" | "Easy–Mod" | "Moderate" | "Hard" | "Alpine",
      "emoji": "🌿" | "⛰️" | "🏔️" | "🗻",
      "lat": number,
      "lng": number,
      "routeType": "hill" | "circular" | "out-and-back",
      "routeDistance": number | null,
      "estimatedTime": string | null
    }
  ]
}

CRITICAL — elevation definition:
- elevation = the vertical height gained (in metres) walking UP from the typical start point (car park / trailhead) to the summit, for ONE repeat
- This is NOT the summit's altitude above sea level
- This is NOT the total route distance
- Example: Pendle Hill summit is 557m above sea level, but ascending from the Nick of Pendle car park (~270m) gains ~290m — so elevation = 290
- Example: Boulsworth Hill summit is 517m above sea level, ascending from the road at ~280m gains ~240m — so elevation = 240
- Example: Ingleborough summit is 723m, ascending from Horton (~270m) gains ~450m — so elevation = 450
- Always report the ASCENT (height gained walking uphill) not the peak's altitude above sea level

Other rules:
- Return 8-10 results total: at least 7 should be named hills or fells good for training repeats; include at most 1-2 circular/out-and-back routes only if no more distinct hills exist within the radius
- distance = distance from the given location to the trailhead in km (must be within the radius)
- repeats = 1 for routes; recommended repeats (1-5) for hills
- totalElevation = elevation × repeats
- surface = brief description e.g. "Grassy moorland", "Rocky path", "Circular fell walk", "Forest trail"
- grade: Easy ≤ 150m gain, Easy–Mod 150-300m, Moderate 300-500m, Hard 500-700m, Alpine 700m+
- routeType: "hill" for standalone hills good for repeats; "circular" for loop routes; "out-and-back" for there-and-back routes
- routeDistance: total circuit/route distance in km for circular or out-and-back routes; null for hills
- estimatedTime: estimated walking time e.g. "1.5–2 hrs", "3–4 hrs"; null for pure hills
- Use real place names and realistic hills/trails for the given location
- lat/lng = accurate GPS coordinates of the hill summit (decimal degrees, 4 decimal places)
- For UK: include fells, moors, and popular circular walks
- emoji: 🌿 for Easy, ⛰️ for Easy–Mod or Moderate, 🏔️ for Hard, 🗻 for Alpine`;

// ── Haversine distance in km ──────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const GEO_UA = "SummitReady/1.0 (hill training app)";

interface NominatimResult { lat: string; lon: string; class: string; type: string }

/** Geocode a free-text location string to lat/lng using Nominatim (OSM). */
async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(location);
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=3`;
    const res = await fetch(url, { headers: { "User-Agent": GEO_UA }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json() as NominatimResult[];
    if (!data?.length) return null;
    const best = data[0];
    return { lat: parseFloat(best.lat), lng: parseFloat(best.lon) };
  } catch {
    return null;
  }
}

/**
 * Validate and correct a list of hills against the user's real geocoded position.
 * - Rejects hills with zero/missing coords or zero elevation.
 * - Recalculates `distance` from the user's real location (if geocoded).
 * - Filters out hills where the computed distance exceeds radius * 1.4.
 * - Clamps `totalElevation` to elevation × repeats in case AI sends inconsistent values.
 */
function validateAndCorrectHills(
  hills: Hill[],
  userLat: number | null,
  userLng: number | null,
  radiusKm: number,
): Hill[] {
  const MAX_MULTIPLIER = 1.4; // allow 40% over the stated radius (some trailheads are further than crow-flies)

  return hills
    .filter(h => {
      // Must have valid coordinates
      if (!h.lat || !h.lng || Math.abs(h.lat) < 0.01 || Math.abs(h.lng) < 0.01) return false;
      // Must have positive elevation
      if (!h.elevation || h.elevation <= 0) return false;
      return true;
    })
    .map(h => {
      let distance = h.distance;

      if (userLat !== null && userLng !== null && h.lat && h.lng) {
        // Always overwrite the AI's distance with the real haversine value
        distance = Math.round(haversineKm(userLat, userLng, h.lat, h.lng) * 10) / 10;
      }

      return {
        ...h,
        distance,
        totalElevation: Math.round(h.elevation * h.repeats),
      };
    })
    .filter(h => {
      // After distance correction, drop anything genuinely out of range
      if (userLat !== null && userLng !== null) {
        return h.distance <= radiusKm * MAX_MULTIPLIER;
      }
      return true;
    })
    .sort((a, b) => a.distance - b.distance);
}

// ── In-memory area lookup cache (keyed by "location|radius") ─────────────────
const areaCache = new Map<string, { hills: Hill[]; ts: number }>();
const AREA_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function parseAIJson(content: string): unknown {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 1. Try a straight parse first
  try {
    return JSON.parse(cleaned);
  } catch { /* fall through */ }

  // 2. Try extracting the outermost {...} block
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
  }

  // 3. Truncated array recovery: pull out individually-complete JSON objects
  //    from the "hills" array even if the closing brackets are missing.
  const arrayStart = cleaned.indexOf('"hills"');
  if (arrayStart !== -1) {
    const bracketStart = cleaned.indexOf("[", arrayStart);
    if (bracketStart !== -1) {
      const partial = cleaned.slice(bracketStart);
      const hills: unknown[] = [];
      // Walk through objects one by one using brace depth counting
      let depth = 0, start = -1;
      for (let i = 0; i < partial.length; i++) {
        const ch = partial[i];
        if (ch === "{") { if (depth === 0) start = i; depth++; }
        else if (ch === "}") {
          depth--;
          if (depth === 0 && start !== -1) {
            try { hills.push(JSON.parse(partial.slice(start, i + 1))); } catch { /* skip malformed */ }
            start = -1;
          }
        }
      }
      if (hills.length > 0) return { hills };
    }
  }

  throw new Error("Could not parse AI response as JSON");
}

function hillToRow(hill: Hill) {
  return {
    slug: slugify(hill.name),
    name: hill.name,
    elevation: Math.round(hill.elevation),
    distance: hill.distance,
    repeats: hill.repeats,
    totalElevation: Math.round(hill.totalElevation),
    surface: hill.surface,
    grade: hill.grade,
    emoji: hill.emoji,
    lat: hill.lat ?? null,
    lng: hill.lng ?? null,
    routeType: hill.routeType ?? null,
    routeDistance: hill.routeDistance ?? null,
    estimatedTime: hill.estimatedTime ?? null,
    imageUrl: null,
  };
}

async function cacheHill(hill: Hill): Promise<void> {
  try {
    const row = hillToRow(hill);
    await db
      .insert(cachedHills)
      .values(row)
      .onConflictDoUpdate({
        target: cachedHills.slug,
        set: { ...row, cachedAt: new Date() },
      });
  } catch {
    // cache write failures are non-fatal
  }
}

const DB_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function getFromCache(slug: string): Promise<Hill | null> {
  try {
    const rows = await db.select().from(cachedHills).where(eq(cachedHills.slug, slug)).limit(1);
    if (!rows.length) return null;
    const r = rows[0];
    // Reject stale entries so bad AI data doesn't persist forever
    if (r.cachedAt && Date.now() - new Date(r.cachedAt).getTime() > DB_CACHE_TTL_MS) return null;
    return {
      name: r.name,
      elevation: r.elevation,
      distance: r.distance,
      repeats: r.repeats,
      totalElevation: r.totalElevation,
      surface: r.surface,
      grade: r.grade as Hill["grade"],
      emoji: r.emoji,
      lat: r.lat ?? undefined,
      lng: r.lng ?? undefined,
      routeType: (r.routeType as Hill["routeType"]) ?? undefined,
      routeDistance: r.routeDistance ?? undefined,
      estimatedTime: r.estimatedTime ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * POST /api/hills-unified
 *
 * Two modes:
 *   - Name search:  { hillName: string, location?: string }
 *     → returns { hill: Hill }
 *   - Area lookup:  { location: string, radius?: number, minElevation?: number }
 *     → returns { hills: Hill[], cached?: boolean }
 *
 * Name searches are cached in the DB. Lookup results are cached per-hill
 * in the background so subsequent name searches benefit immediately.
 */
router.post("/hills-unified", async (req, res) => {
  const { hillName, location, radius, minElevation } = req.body as {
    hillName?: string;
    location?: string;
    radius?: number;
    minElevation?: number;
  };

  const isNameSearch = !!(hillName && hillName.trim().length >= 2);

  // ── Name search ──────────────────────────────────────────────────────────
  if (isNameSearch) {
    const name = hillName!.trim();
    const slug = slugify(name);
    const loc = location ? normalizeLocation(location.trim()) : "unknown location";

    // 1. Check cache
    const cached = await getFromCache(slug);
    if (cached) {
      res.json({ hill: cached, fromCache: true });
      return;
    }

    // 2. Ask AI
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        max_completion_tokens: 400,
        messages: [
          { role: "system", content: SEARCH_SYSTEM_PROMPT },
          { role: "user", content: `Look up this specific hill for training near "${loc}": "${name}"` },
        ],
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) { res.status(500).json({ error: "No response from AI" }); return; }

      const parsed = parseAIJson(content);
      const SearchResponseSchema = z.object({ hill: HillSchema });
      const validated = SearchResponseSchema.parse(parsed);

      // 3. Cache in background (don't await)
      void cacheHill(validated.hill);

      res.json({ hill: validated.hill, fromCache: false });
    } catch (err) {
      req.log.error({ err }, "hills-unified name search failed");
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: `Hill search failed: ${msg}` });
    }
    return;
  }

  // ── Area lookup ──────────────────────────────────────────────────────────
  if (!location || location.trim().length < 2) {
    res.status(400).json({ error: "Provide hillName for name search, or location for area lookup" });
    return;
  }

  const loc = normalizeLocation(location.trim());
  const r = Number(radius) || 25;
  const minElev = Number(minElevation) || 0;

  // Check in-memory area cache first
  const cacheKey = `${loc.toLowerCase()}|${r}|${minElev}`;
  const cached = areaCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < AREA_CACHE_TTL_MS) {
    res.json({ hills: cached.hills, fromCache: true });
    return;
  }

  try {
    let userMsg = `Find training hills within ${r}km of: "${loc}"`;
    if (minElev > 0) {
      userMsg += `. Prioritise hills with at least ${minElev}m elevation gain per climb. If fewer than 3 hills meeting this minimum exist within ${r}km, include the nearest qualifying hills even if slightly outside the radius. Return at least 5 results total.`;
    }

    // Run AI call and user geocoding in parallel — geocoding lets us verify/correct AI distances
    const [response, userCoords] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-4o",
        max_completion_tokens: 1400,
        messages: [
          { role: "system", content: LOOKUP_SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
      }),
      geocodeLocation(loc),
    ]);

    const content = response.choices?.[0]?.message?.content;
    if (!content) { res.status(500).json({ error: "No response from AI" }); return; }

    const parsed = parseAIJson(content);
    const LookupResponseSchema = z.object({ hills: z.array(HillSchema) });
    const validated = LookupResponseSchema.parse(parsed);

    // Validate, correct distances using real geocoded coords, and filter out-of-range hills
    const corrected = validateAndCorrectHills(
      validated.hills,
      userCoords?.lat ?? null,
      userCoords?.lng ?? null,
      r,
    );

    // Store in area cache + cache each valid hill individually in background
    areaCache.set(cacheKey, { hills: corrected, ts: Date.now() });
    void Promise.all(corrected.map(h => cacheHill(h)));

    res.json({ hills: corrected });
  } catch (err) {
    req.log.error({ err }, "hills-unified area lookup failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Hills lookup failed: ${msg}` });
  }
});

export default router;
