import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, cachedMountains } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function mountainSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const RequestSchema = z.object({
  name: z.string().min(2).max(200).trim(),
});

const RouteSchema = z.object({
  name: z.string(),
  distance: z.number(),
  elevationGain: z.number(),
  highestAltitude: z.number(),
  difficulty: z.enum(["Easy", "Moderate", "Hard", "Alpine"]),
  description: z.string(),
  startingPoint: z.string().optional(),
});

const MountainResponseSchema = z.object({
  mountainName: z.string(),
  country: z.string().optional(),
  region: z.string().optional(),
  routes: z.array(RouteSchema),
});

const SYSTEM_PROMPT = `You are a mountain hiking and alpine routes expert. When given a mountain or hike name, return accurate route information as a JSON object.

Return ONLY valid JSON — no markdown fences, no explanation, just the raw JSON object:
{
  "mountainName": string,
  "country": string,
  "region": string,
  "routes": [
    {
      "name": string,
      "distance": number,
      "elevationGain": number,
      "highestAltitude": number,
      "difficulty": "Easy" | "Moderate" | "Hard" | "Alpine",
      "description": string,
      "startingPoint": string
    }
  ]
}

Rules:
- distance = round trip km (realistic number)
- elevationGain = summit altitude MINUS the specific trailhead/car-park elevation for THAT route. Every route starts at a different elevation — do NOT use the same elevationGain for multiple routes. Example for Snowdon (summit 1085m): Pyg Track starts at Pen-y-Pass ~359m → gain 726m; Llanberis Path starts at Llanberis ~115m → gain 970m; Watkin Path starts at Nantgwynant ~102m → gain 983m. Calculate each route individually.
- highestAltitude = summit altitude metres above sea level (same for all routes on the same mountain)
- Provide 2-4 routes
- Difficulty: Easy=walking, Moderate=sustained climb, Hard=steep/scrambling, Alpine=technical/glacier
- Use real, verified data for well-known peaks (UK peaks, Alps, etc.). Double-check trailhead elevations — they vary significantly between routes on the same mountain.`;

router.post("/mountain-lookup", async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Mountain name required (2–200 characters)" });
    return;
  }
  const { name } = parsed.data;
  const slug = mountainSlug(name);

  // Check DB cache first — mountain geography doesn't change
  try {
    const rows = await db.select().from(cachedMountains).where(eq(cachedMountains.slug, slug)).limit(1);
    if (rows.length > 0) {
      const row = rows[0];
      const age = Date.now() - new Date(row.cachedAt).getTime();
      if (age < CACHE_TTL_MS) {
        req.log.info({ slug }, "Mountain cache hit");
        res.json(JSON.parse(row.data));
        return;
      }
    }
  } catch (err) {
    req.log.warn({ err }, "Mountain cache read failed, falling back to AI");
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Provide route information for: "${name.trim()}"` },
      ],
    });

    req.log.info({
      choices: response.choices?.length,
      finishReason: response.choices?.[0]?.finish_reason,
      hasContent: !!response.choices?.[0]?.message?.content,
    }, "OpenAI response received");

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      req.log.error({ response: JSON.stringify(response).slice(0, 500) }, "Empty content from OpenAI");
      res.status(500).json({ error: "Empty response from AI" });
      return;
    }

    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        req.log.error({ content: content.slice(0, 300) }, "Could not extract JSON from response");
        res.status(500).json({ error: "Could not parse route data" });
        return;
      }
      parsedJson = JSON.parse(jsonMatch[0]);
    }

    const validated = MountainResponseSchema.parse(parsedJson);

    // Store in DB cache
    try {
      await db.insert(cachedMountains)
        .values({ slug, data: JSON.stringify(validated) })
        .onConflictDoUpdate({
          target: cachedMountains.slug,
          set: { data: JSON.stringify(validated), cachedAt: new Date() },
        });
    } catch (err) {
      req.log.warn({ err }, "Mountain cache write failed");
    }

    res.json(validated);
  } catch (err) {
    req.log.error({ err }, "Mountain lookup failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Lookup failed: ${msg}` });
  }
});

export default router;
