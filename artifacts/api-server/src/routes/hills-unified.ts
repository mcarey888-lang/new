import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, cachedHills } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const HillSchema = z.object({
  name: z.string(),
  elevation: z.number(),
  distance: z.number(),
  repeats: z.number(),
  totalElevation: z.number(),
  surface: z.string(),
  grade: z.enum(["Easy", "Easy–Mod", "Moderate", "Hard", "Alpine"]),
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

Rules:
- elevation = elevation gain per climb in metres (not total ascent)
- distance = estimated distance in km from the base location to the hill
- repeats = recommended number of repeats for a good training session (1-5)
- totalElevation = elevation × repeats
- surface = brief description e.g. "Grassy moorland", "Rocky path"
- grade: Easy ≤ 200m, Easy–Mod 150-300m, Moderate 250-450m, Hard 400-700m, Alpine 600m+
- emoji: 🌿 for Easy, ⛰️ for Easy–Mod or Moderate, 🏔️ for Hard, 🗻 for Alpine
- lat/lng = accurate GPS coordinates of the hill summit or main trailhead (decimal degrees, 4 decimal places)
- If you cannot identify the hill, make a reasonable estimate based on the name
- Use the real elevation data for well-known hills/peaks`;

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

Rules:
- Return 8-10 results total: at least 7 should be named hills or fells good for training repeats; include at most 1-2 circular/out-and-back routes only if no more distinct hills exist within the radius
- elevation = total elevation gain in metres for the outing (for hills: gain per climb; for routes: total ascent of the full circuit)
- distance = distance from the given location to the trailhead in km (must be within the radius)
- repeats = 1 for routes; recommended repeats (1-5) for hills
- totalElevation = elevation × repeats
- surface = brief description e.g. "Grassy moorland", "Rocky path", "Circular fell walk", "Forest trail"
- grade: Easy ≤ 200m, Easy–Mod 150-300m, Moderate 250-450m, Hard 400-700m, Alpine 600m+
- routeType: "hill" for standalone hills good for repeats; "circular" for loop routes; "out-and-back" for there-and-back routes
- routeDistance: total circuit/route distance in km for circular or out-and-back routes; null for hills
- estimatedTime: estimated walking time e.g. "1.5–2 hrs", "3–4 hrs"; null for pure hills
- Use real place names and realistic hills/trails for the given location
- lat/lng = accurate GPS coordinates of the hill summit or main trailhead (decimal degrees, 4 decimal places)
- For UK: include fells, moors, and popular circular walks
- emoji: 🌿 for Easy, ⛰️ for Easy–Mod or Moderate, 🏔️ for Hard, 🗻 for Alpine`;

function parseAIJson(content: string): unknown {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse AI response as JSON");
    return JSON.parse(match[0]);
  }
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

async function getFromCache(slug: string): Promise<Hill | null> {
  try {
    const rows = await db.select().from(cachedHills).where(eq(cachedHills.slug, slug)).limit(1);
    if (!rows.length) return null;
    const r = rows[0];
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
    const loc = location?.trim() || "unknown location";

    // 1. Check cache
    const cached = await getFromCache(slug);
    if (cached) {
      res.json({ hill: cached, fromCache: true });
      return;
    }

    // 2. Ask AI
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.4",
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

  const loc = location.trim();
  const r = Number(radius) || 25;
  const minElev = Number(minElevation) || 0;

  try {
    let userMsg = `Find training hills within ${r}km of: "${loc}"`;
    if (minElev > 0) {
      userMsg += `. Prioritise hills with at least ${minElev}m elevation gain per climb. If fewer than 3 hills meeting this minimum exist within ${r}km, include the nearest qualifying hills even if slightly outside the radius. Return at least 5 results total.`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: LOOKUP_SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) { res.status(500).json({ error: "No response from AI" }); return; }

    const parsed = parseAIJson(content);
    const LookupResponseSchema = z.object({ hills: z.array(HillSchema) });
    const validated = LookupResponseSchema.parse(parsed);

    // Cache each hill in the background so future name searches are instant
    void Promise.all(validated.hills.map(h => cacheHill(h)));

    res.json({ hills: validated.hills });
  } catch (err) {
    req.log.error({ err }, "hills-unified area lookup failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Hills lookup failed: ${msg}` });
  }
});

export default router;
