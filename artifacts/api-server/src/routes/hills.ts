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

export default router;
