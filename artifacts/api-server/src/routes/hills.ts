import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";

const router: IRouter = Router();

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

const HillsResponseSchema = z.object({
  hills: z.array(HillSchema),
});

const SYSTEM_PROMPT = `You are an expert on local hiking and trail running areas. Given a location and radius, return a mix of nearby hills (good for repeats) AND circular/out-and-back hiking routes (like AllTrails). Return ONLY valid JSON — no markdown, no explanation:

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
- Return 8-10 results total: roughly half hills, half circular or out-and-back hiking routes
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
- For UK: include fells, moors, and popular circular walks. For Alps/Pyrénées: include cols and ridge routes. For Rockies: use peaks and loop trails.
- emoji: 🌿 for Easy, ⛰️ for Easy–Mod or Moderate, 🏔️ for Hard, 🗻 for Alpine`;

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

const HILL_DETAIL_SYSTEM_PROMPT = `You are an expert mountain and hiking guide. Given a hill name and region, provide detailed practical information for a hillwalker training for a mountain summit. Return ONLY valid JSON — no markdown, no explanation:

{
  "description": string,
  "startPoint": {
    "name": string,
    "lat": number,
    "lng": number,
    "directions": string,
    "parkingNotes": string
  },
  "routes": [
    {
      "name": string,
      "distance": number,
      "elevationGain": number,
      "difficulty": string,
      "description": string,
      "estimatedTime": string,
      "isRecommended": boolean
    }
  ]
}

Rules:
- description: 2-3 sentences about the hill's character, terrain and why it is good for training
- startPoint.name: name of the car park, village, layby or trailhead
- startPoint.lat/lng: accurate GPS coordinates of the start point (decimal degrees, 4 decimal places)
- startPoint.directions: 2-3 sentences on how to drive or get there by public transport
- startPoint.parkingNotes: parking info — free/paid, spaces, nearest postcode or OS grid ref
- routes: provide 2-4 distinct route options (different approaches, loops, or distances)
- routes[].name: short descriptive name e.g. "Standard Ascent", "Ridge Loop", "North Approach"
- routes[].distance: round-trip distance in km
- routes[].elevationGain: total elevation gain in metres
- routes[].difficulty: "Easy" | "Moderate" | "Hard" | "Alpine"
- routes[].description: 1-2 sentences describing the route character and highlights
- routes[].estimatedTime: e.g. "1.5–2 hours", "3–4 hours"
- routes[].isRecommended: exactly one route must be true — the best one for hill training repeats
- Use real place names, postcodes, and accurate coordinates`;

const HillDetailRouteSchema = z.object({
  name: z.string(),
  distance: z.number(),
  elevationGain: z.number(),
  difficulty: z.string(),
  description: z.string(),
  estimatedTime: z.string(),
  isRecommended: z.boolean(),
});

const HillDetailSchema = z.object({
  description: z.string(),
  startPoint: z.object({
    name: z.string(),
    lat: z.number(),
    lng: z.number(),
    directions: z.string(),
    parkingNotes: z.string(),
  }),
  routes: z.array(HillDetailRouteSchema),
});

router.post("/hills-search", async (req, res) => {
  const { hillName, location } = req.body as { hillName?: string; location?: string };

  if (!hillName || typeof hillName !== "string" || hillName.trim().length < 2) {
    res.status(400).json({ error: "Hill name required" });
    return;
  }

  const loc = location?.trim() || "unknown location";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 400,
      messages: [
        { role: "system", content: SEARCH_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Look up this specific hill for training near "${loc}": "${hillName.trim()}"`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      res.status(500).json({ error: "No response from AI" });
      return;
    }

    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        res.status(500).json({ error: "Could not parse hill data" });
        return;
      }
      parsed = JSON.parse(match[0]);
    }

    const SearchResponseSchema = z.object({ hill: HillSchema });
    const validated = SearchResponseSchema.parse(parsed);
    res.json(validated);
  } catch (err) {
    req.log.error({ err }, "Hill search failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Hill search failed: ${msg}` });
  }
});

router.post("/hills-lookup", async (req, res) => {
  const { location, radius, minElevation } = req.body as { location?: string; radius?: number; minElevation?: number };

  if (!location || typeof location !== "string" || location.trim().length < 2) {
    res.status(400).json({ error: "Location required" });
    return;
  }

  const r = Number(radius) || 25;
  const minElev = Number(minElevation) || 0;

  try {
    let userMsg = `Find training hills within ${r}km of: "${location.trim()}"`;
    if (minElev > 0) {
      userMsg += `. Prioritise hills with at least ${minElev}m elevation gain per climb. If fewer than 3 hills meeting this minimum exist within ${r}km, include the nearest qualifying hills even if they are slightly outside the radius — clearly note their actual distance. Return at least 5 results total.`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: userMsg,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      req.log.error({ response: JSON.stringify(response).slice(0, 400) }, "Empty hills response");
      res.status(500).json({ error: "No response from AI" });
      return;
    }

    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        res.status(500).json({ error: "Could not parse hills data" });
        return;
      }
      parsed = JSON.parse(match[0]);
    }

    const validated = HillsResponseSchema.parse(parsed);
    res.json(validated);
  } catch (err) {
    req.log.error({ err }, "Hills lookup failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Hills lookup failed: ${msg}` });
  }
});

router.post("/hill-detail", async (req, res) => {
  const { hillName, location } = req.body as { hillName?: string; location?: string };

  if (!hillName || typeof hillName !== "string" || hillName.trim().length < 2) {
    res.status(400).json({ error: "Hill name required" });
    return;
  }

  const loc = location?.trim() || "unknown location";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1000,
      messages: [
        { role: "system", content: HILL_DETAIL_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Provide detailed information for hillwalkers about: "${hillName.trim()}" near ${loc}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      res.status(500).json({ error: "No response from AI" });
      return;
    }

    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        res.status(500).json({ error: "Could not parse hill detail" });
        return;
      }
      parsed = JSON.parse(match[0]);
    }

    const validated = HillDetailSchema.parse(parsed);
    res.json(validated);
  } catch (err) {
    req.log.error({ err }, "Hill detail failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Hill detail failed: ${msg}` });
  }
});

const TRAIL_START_SYSTEM_PROMPT = `You are an expert hiking guide. Given a trail name and region, provide practical access and parking information for walkers. Return ONLY valid JSON — no markdown, no explanation:

{
  "startPoint": {
    "name": string,
    "lat": number,
    "lng": number,
    "directions": string,
    "parkingNotes": string
  }
}

Rules:
- startPoint.name: name of the car park, village, layby or trailhead
- startPoint.lat/lng: accurate GPS coordinates of the start point (decimal degrees, 4 decimal places)
- startPoint.directions: 2-3 sentences on how to drive or get there by public transport
- startPoint.parkingNotes: parking info — free/paid, spaces, nearest postcode or what3words / OS grid ref
- Use real place names, postcodes, and accurate coordinates`;

const TrailStartSchema = z.object({
  startPoint: z.object({
    name: z.string(),
    lat: z.number(),
    lng: z.number(),
    directions: z.string(),
    parkingNotes: z.string(),
  }),
});

router.post("/trail-start", async (req, res) => {
  const { trailName, location } = req.body as { trailName?: string; location?: string };

  if (!trailName || typeof trailName !== "string" || trailName.trim().length < 2) {
    res.status(400).json({ error: "Trail name required" });
    return;
  }

  const loc = location?.trim() || "unknown location";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 400,
      messages: [
        { role: "system", content: TRAIL_START_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Provide start point and parking info for: "${trailName.trim()}" near ${loc}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      res.status(500).json({ error: "No response from AI" });
      return;
    }

    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        res.status(500).json({ error: "Could not parse trail start data" });
        return;
      }
      parsed = JSON.parse(match[0]);
    }

    const validated = TrailStartSchema.parse(parsed);
    res.json(validated);
  } catch (err) {
    req.log.error({ err }, "Trail start lookup failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Trail start lookup failed: ${msg}` });
  }
});

const TrailSchema = z.object({
  name: z.string(),
  location: z.string(),
  distance: z.number(),
  elevationGain: z.number(),
  estimatedTime: z.string(),
  difficulty: z.enum(["Easy", "Moderate", "Hard"]),
  terrain: z.enum(["woodland", "hill", "mountain", "coastal", "road", "mixed"]),
  routeType: z.enum(["loop", "out-and-back", "point-to-point"]),
  bestFor: z
    .array(z.string())
    .transform((arr) =>
      arr.filter((v): v is "training" | "family walk" | "summit prep" | "scenic walk" =>
        ["training", "family walk", "summit prep", "scenic walk"].includes(v)
      )
    ),
  description: z.string(),
  trainingBenefits: z
    .array(z.string())
    .transform((arr) =>
      arr.filter((v): v is "cardio" | "elevation" | "endurance" | "pack weight" =>
        ["cardio", "elevation", "endurance", "pack weight"].includes(v)
      )
    ),
  emoji: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const TrailsResponseSchema = z.object({
  trails: z.array(TrailSchema),
});

const TRAILS_SYSTEM_PROMPT = `You are an expert hiking guide with precise geographic knowledge. Your job is to return ONLY trails that genuinely exist within the specified radius of the given location. Geographic accuracy is the single most important rule — trails that are outside the radius are useless and harmful. Return ONLY valid JSON — no markdown, no explanation.

{
  "trails": [
    {
      "name": string,
      "location": string,
      "distance": number,
      "elevationGain": number,
      "estimatedTime": string,
      "difficulty": "Easy" | "Moderate" | "Hard",
      "terrain": "woodland" | "hill" | "mountain" | "coastal" | "road" | "mixed",
      "routeType": "loop" | "out-and-back" | "point-to-point",
      "bestFor": array of "training" | "family walk" | "summit prep" | "scenic walk",
      "description": string,
      "trainingBenefits": array of "cardio" | "elevation" | "endurance" | "pack weight",
      "emoji": string,
      "lat": number,
      "lng": number
    }
  ]
}

CRITICAL GEOGRAPHIC RULES (violations make the entire response worthless):
1. If the location is a UK postcode (e.g. "BB4 4BH", "M1 1AE", "EX1 1AA"), resolve it to its exact town and county FIRST — then find trails within the radius of that resolved location. BB4 = Rossendale, Lancashire. M1 = Manchester city centre. EX1 = Exeter, Devon. Never confuse postcode districts.
2. Every single trail MUST start within the specified km radius of the given location. If the radius is 30km, no trail should be more than 30km from the centre point.
3. Do NOT return trails from a different county, region or country unless the radius genuinely reaches there geographically.
4. If you are uncertain whether a trail is within radius, do not include it.
5. location field: use the specific town/village and county the trail is actually in (e.g. "Rossendale, Lancashire" not "Peak District, Derbyshire" if the user is in BB4).

Other rules:
- Return 8-10 trails with a good mix of difficulties, terrains and route types
- name: real trail or walk name
- distance: total route distance in km (round trip for out-and-back)
- elevationGain: total ascent in metres for the full route
- estimatedTime: e.g. "1h 30m", "3h 00m", "5h 30m"
- difficulty: Easy (≤200m gain or gentle), Moderate (200-500m or moderate terrain), Hard (500m+ or challenging terrain)
- terrain: best single descriptor for the dominant terrain
- routeType: "loop" (circular), "out-and-back" (same path both ways), "point-to-point" (different start/end)
- bestFor: 1-3 tags describing WHO the trail suits — ONLY use: "training" (fitness/cardio focus), "family walk" (easy/accessible), "summit prep" (mountain preparation), "scenic walk" (beautiful but not fitness-focused). DO NOT put "endurance", "cardio" or any other word here — those belong in trainingBenefits only.
- description: 2-3 sentences describing the route character, highlights and why it stands out. Be specific to the actual local geography.
- trainingBenefits: tags for the PHYSICAL training value — ONLY use: "cardio" (always include), "elevation" (significant climb), "endurance" (long route), "pack weight" (demanding mountain route). These are separate from bestFor.
- emoji: single emoji representing the trail character
- Include a range: some short easy walks, some long hard routes, some medium day hikes
- lat/lng: accurate GPS coordinates (decimal degrees, 4 decimal places) of the main trailhead or car park. ALWAYS include these — they are required for map display.`;

router.post("/trails-lookup", async (req, res) => {
  const { location, radius, minElevation, maxDuration, maxDistance } = req.body as {
    location?: string;
    radius?: number;
    minElevation?: number | null;
    maxDuration?: number | null;
    maxDistance?: number | null;
  };

  if (!location || typeof location !== "string" || location.trim().length < 2) {
    res.status(400).json({ error: "Location required" });
    return;
  }

  const r = Number(radius) || 30;

  const constraints: string[] = [];
  if (minElevation) constraints.push(`Minimum elevation gain: ${minElevation}m (exclude trails with less ascent).`);
  if (maxDuration) constraints.push(`Maximum duration: ${maxDuration} hours (exclude longer routes).`);
  if (maxDistance) constraints.push(`Maximum trail distance: ${maxDistance}km (exclude longer routes).`);
  const constraintText = constraints.length > 0
    ? ` Additional criteria the user requires: ${constraints.join(" ")}`
    : "";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1400,
      messages: [
        { role: "system", content: TRAILS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Find real walking and hiking trails within ${r}km of: "${location.trim()}". If this is a UK postcode, resolve it to the correct town and county first. IMPORTANT: every trail you return MUST be physically located within ${r}km of that location — do NOT include trails from other national parks, regions, or counties. For example, if searching Peak District, do NOT include Lake District, Snowdonia, or Yorkshire Dales trails. Set the "location" field of each trail to the actual region/town it is in (e.g. "Peak District, Derbyshire"), not the search term.${constraintText}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      req.log.error({ response: JSON.stringify(response).slice(0, 400) }, "Empty trails response");
      res.status(500).json({ error: "No response from AI" });
      return;
    }

    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        res.status(500).json({ error: "Could not parse trails data" });
        return;
      }
      parsed = JSON.parse(match[0]);
    }

    const validated = TrailsResponseSchema.parse(parsed);

    // Post-filter: remove any trail whose location doesn't share all significant
    // keywords with the search location (guards against GPT hallucinating trails
    // from completely different regions, e.g. returning Lake District trails when
    // searching for Peak District).
    const searchWords = location.trim().toLowerCase()
      .split(/[\s,]+/)
      .filter(w => w.length >= 4);

    const relevantTrails = searchWords.length === 0
      ? validated.trails
      : validated.trails.filter(t => {
          const loc = t.location.toLowerCase();
          return searchWords.every(w => loc.includes(w));
        });

    // If the filter removed everything (GPT returned entirely wrong region),
    // return all results rather than an empty list — better to show something.
    res.json({ trails: relevantTrails.length > 0 ? relevantTrails : validated.trails });
  } catch (err) {
    req.log.error({ err }, "Trails lookup failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Trails lookup failed: ${msg}` });
  }
});

export default router;
