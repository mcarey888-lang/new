import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";

const router: IRouter = Router();

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
- elevationGain = total ascent metres
- highestAltitude = summit altitude metres above sea level
- Provide 2-4 routes
- Difficulty: Easy=walking, Moderate=sustained climb, Hard=steep/scrambling, Alpine=technical/glacier
- Use real accurate data for well-known peaks (Alps, UK peaks, etc.)`;

router.post("/mountain-lookup", async (req, res) => {
  const { name } = req.body as { name?: string };

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "Mountain name required (min 2 characters)" });
    return;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
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

    // Strip markdown code fences if present
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try to extract JSON object from text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        req.log.error({ content: content.slice(0, 300) }, "Could not extract JSON from response");
        res.status(500).json({ error: "Could not parse route data" });
        return;
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    const validated = MountainResponseSchema.parse(parsed);
    res.json(validated);
  } catch (err) {
    req.log.error({ err }, "Mountain lookup failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Lookup failed: ${msg}` });
  }
});

export default router;
