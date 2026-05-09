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
});

const HillsResponseSchema = z.object({
  hills: z.array(HillSchema),
});

const SYSTEM_PROMPT = `You are an expert on local hiking and trail running areas. Given a location and radius, return realistic nearby hills and trails suitable for mountain training. Return ONLY valid JSON — no markdown, no explanation:

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
      "emoji": "🌿" | "⛰️" | "🏔️" | "🗻"
    }
  ]
}

Rules:
- elevation = elevation gain per climb in metres (not total ascent)
- distance = distance from the given location in km (must be within the radius)
- repeats = recommended number of repeats for a good training session (1-5)
- totalElevation = elevation × repeats
- surface = brief description e.g. "Grassy moorland", "Rocky path", "Mixed trail", "Technical scramble"
- grade: Easy ≤ 200m, Easy–Mod 150-300m, Moderate 250-450m, Hard 400-700m, Alpine 600m+
- Return 5-7 hills spread across different distances and difficulties
- Use real place names and realistic hills/trails for the given location
- For UK: use moors, fells, peaks. Alps: use cols and ridges. Pyrénées: use cols. Rocky Mountains: use peaks/passes.
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
    "emoji": "🌿" | "⛰️" | "🏔️" | "🗻"
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
- If you cannot identify the hill, make a reasonable estimate based on the name
- Use the real elevation data for well-known hills/peaks`;

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
  const { location, radius } = req.body as { location?: string; radius?: number };

  if (!location || typeof location !== "string" || location.trim().length < 2) {
    res.status(400).json({ error: "Location required" });
    return;
  }

  const r = Number(radius) || 25;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Find training hills within ${r}km of: "${location.trim()}"`,
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

export default router;
