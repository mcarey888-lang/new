import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";

const router: IRouter = Router();

const AdjustedWeekSchema = z.object({
  weekNumber: z.number(),
  targetElevation: z.number(),
  purpose: z.string(),
  note: z.string().optional(),
});

const AdjustResponseSchema = z.object({
  overallNote: z.string(),
  adjustedWeeks: z.array(AdjustedWeekSchema),
});

const SYSTEM_PROMPT = `You are an expert mountain training coach. Given a user's summit goal, their session completion data, and their remaining training weeks, adjust the plan to reflect their actual progress.

Return ONLY valid JSON — no markdown, no explanation:
{
  "overallNote": string,
  "adjustedWeeks": [
    {
      "weekNumber": number,
      "targetElevation": number,
      "purpose": string,
      "note": string
    }
  ]
}

Rules:
- overallNote: 1 sentence summary of adjustment rationale (e.g. "You're ahead of schedule — weeks 4-6 now carry more load to capitalise on your momentum")
- Only include future/current weeks in adjustedWeeks
- If completion rate > 80%: increase targetElevation by 5-15% in upcoming weeks, use motivating purpose text
- If completion rate 50-80%: keep similar targets, note consistency focus
- If completion rate < 50%: slightly reduce targets or keep same, add recovery language
- purpose: keep it practical and specific (1 sentence)
- note: 1 short phrase explaining this week's adjustment (e.g. "+8% — strong completion rate")
- targetElevation must be a whole number in metres`;

router.post("/adjust-plan", async (req, res) => {
  const {
    summitGoal,
    completedCount,
    totalScheduled,
    currentWeekNumber,
    remainingWeeks,
  } = req.body as {
    summitGoal?: { mountainName: string; elevationGain: number; difficulty: string; fitnessLevel: string; summitDate: string };
    completedCount?: number;
    totalScheduled?: number;
    currentWeekNumber?: number;
    remainingWeeks?: { weekNumber: number; phase: string; targetElevation: number; purpose: string }[];
  };

  if (!summitGoal || !remainingWeeks || !Array.isArray(remainingWeeks)) {
    res.status(400).json({ error: "summitGoal and remainingWeeks required" });
    return;
  }

  const completed = Number(completedCount) || 0;
  const total = Number(totalScheduled) || 1;
  const rate = Math.round((completed / total) * 100);

  const userMsg = `
Summit: ${summitGoal.mountainName}
Goal elevation: ${summitGoal.elevationGain}m | Difficulty: ${summitGoal.difficulty} | Fitness: ${summitGoal.fitnessLevel}
Summit date: ${summitGoal.summitDate}
Current week: ${currentWeekNumber || 1}
Completion rate: ${completed}/${total} sessions (${rate}%)

Remaining weeks:
${remainingWeeks.map(w => `Week ${w.weekNumber} (${w.phase}): ${w.targetElevation}m — ${w.purpose}`).join("\n")}

Adjust the remaining weeks based on the ${rate}% completion rate.`.trim();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
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
        res.status(500).json({ error: "Could not parse adjustment" });
        return;
      }
      parsed = JSON.parse(match[0]);
    }

    const validated = AdjustResponseSchema.parse(parsed);
    res.json(validated);
  } catch (err) {
    req.log.error({ err }, "Plan adjustment failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Adjustment failed: ${msg}` });
  }
});

export default router;
