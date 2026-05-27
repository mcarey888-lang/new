import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";

const router: IRouter = Router();

const RequestSchema = z.object({
  mountainName: z.string().min(2).max(200).trim(),
});

const AlpineRequirementSchema = z.object({
  id: z.string(),
  category: z.enum(["endurance", "altitude", "technical", "strength", "recovery"]),
  label: z.string(),
  detail: z.string(),
  benchmark: z.enum(["sessions_count", "max_elevation_m", "big_day_count", "weeks_training"]).optional(),
  benchmarkValue: z.number().optional(),
});

const AlpineAssessmentSchema = z.object({
  altitudeBand: z.enum(["high", "very-high", "extreme"]),
  technicalLevel: z.enum(["walking", "scrambling", "basic-crampons", "technical", "advanced-technical"]),
  minimumWeeks: z.number().int().positive(),
  requirements: z.array(AlpineRequirementSchema).min(4).max(6),
  keyRisks: z.array(z.string()).min(1).max(4),
  acclimatizationNote: z.string(),
});

const SYSTEM_PROMPT = `You are an expert Alpine mountain guide and high-altitude physiologist. Given a specific mountain, produce a personalised training requirements assessment.

Return ONLY valid JSON — no markdown fences, no explanation — matching this exact shape:
{
  "altitudeBand": "high" | "very-high" | "extreme",
  "technicalLevel": "walking" | "scrambling" | "basic-crampons" | "technical" | "advanced-technical",
  "minimumWeeks": number,
  "requirements": [
    {
      "id": string,
      "category": "endurance" | "altitude" | "technical" | "strength" | "recovery",
      "label": string,
      "detail": string,
      "benchmark": "sessions_count" | "max_elevation_m" | "big_day_count" | "weeks_training",
      "benchmarkValue": number
    }
  ],
  "keyRisks": [string],
  "acclimatizationNote": string
}

Rules:
- altitudeBand: high=3500–5000m, very-high=5000–7000m, extreme=7000m+
- minimumWeeks: realistic minimum from scratch, including acclimatization rotations where relevant
- requirements: exactly 5 items, one per category (endurance, altitude, technical, strength, recovery), each with a measurable benchmark:
  - sessions_count: total training sessions threshold
  - max_elevation_m: single-session elevation gain in metres to achieve at least once
  - big_day_count: number of qualifying multi-hour long sessions
  - weeks_training: consecutive weeks of consistent training needed
- label: 4–6 words, specific to this mountain (not generic)
- detail: exactly one sentence of actionable, mountain-specific guidance
- keyRisks: 2–3 most significant risks for THIS specific mountain (e.g. crevasse, serac fall, AMS, rockfall — not generic)
- acclimatizationNote: 1–2 sentences specific to this mountain's altitude profile and any standard acclimatization approach
- Be highly specific to the mountain — Mont Blanc requirements differ significantly from Denali or Everest`;

router.post("/alpine-assessment", async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "mountainName required (2–200 characters)" });
    return;
  }
  const { mountainName } = parsed.data;
  const { highestAltitude, difficulty } = req.body as {
    highestAltitude?: number;
    difficulty?: string;
  };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1100,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Mountain: "${mountainName.trim()}" — Summit altitude: ${highestAltitude ?? "unknown"}m, Difficulty classification: ${difficulty ?? "Alpine"}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      req.log.error({ response: JSON.stringify(response).slice(0, 400) }, "Empty content from OpenAI");
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
        req.log.error({ content: content.slice(0, 300) }, "Could not extract JSON from alpine response");
        res.status(500).json({ error: "Could not parse assessment" });
        return;
      }
      parsed = JSON.parse(match[0]);
    }

    const validated = AlpineAssessmentSchema.parse(parsed);

    // Safety floor: prevent AI hallucinating unrealistically short timelines
    const minWeeksFloor: Record<string, number> = {
      "extreme":   36, // 7 000 m+ (Everest, K2, Denali, etc.)
      "very-high": 20, // 5 000–7 000 m
      "high":       8, // 3 500–5 000 m
    };
    const floor = minWeeksFloor[validated.altitudeBand] ?? 4;
    if (validated.minimumWeeks < floor) {
      validated.minimumWeeks = floor;
    }

    res.json(validated);
  } catch (err) {
    req.log.error({ err }, "Alpine assessment failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Assessment failed: ${msg}` });
  }
});

export default router;
