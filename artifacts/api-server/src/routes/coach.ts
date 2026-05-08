import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";

const router: IRouter = Router();

const CoachResponseSchema = z.object({
  summary: z.string(),
  tone: z.enum(["positive", "warning", "neutral"]),
  tips: z.array(z.string()).min(1).max(4),
});

const SYSTEM_PROMPT = `You are an expert mountain training coach. Given a user's summit goal and their training data, give a concise, honest, and motivating assessment.

Return ONLY valid JSON — no markdown, no explanation:
{
  "summary": string,
  "tone": "positive" | "warning" | "neutral",
  "tips": [string, string, string]
}

Rules:
- summary: 1–2 sentences assessing their overall progress honestly. Reference specific numbers (sessions done, elevation, days remaining). Be direct — not generic.
- tone: "positive" if on track or ahead, "warning" if behind or at risk, "neutral" if just starting
- tips: exactly 3 short, specific, actionable pieces of advice. Each tip should be 1 sentence. Reference concrete actions (e.g. "Add one hill session this weekend to close your elevation deficit" not "Train more").
- Vary the tips across: volume/consistency, elevation/intensity, and recovery/planning.
- If no sessions logged yet: give starter tips for their specific mountain and difficulty level.`;

router.post("/coach-assessment", async (req, res) => {
  const {
    summitGoal,
    readinessScore,
    totalSessionsDone,
    totalElevationLogged,
    maxSingleElevation,
    weekCompletion,
    daysRemaining,
    weeksInPlan,
    currentWeekNumber,
    currentPhase,
    recentSessionTypes,
  } = req.body as {
    summitGoal?: {
      mountainName: string;
      difficulty: string;
      fitnessLevel: string;
      elevationGain: number;
      distance: number;
      summitDate: string;
      trainingDaysPerWeek: number;
    };
    readinessScore?: number;
    totalSessionsDone?: number;
    totalElevationLogged?: number;
    maxSingleElevation?: number;
    weekCompletion?: number;
    daysRemaining?: number;
    weeksInPlan?: number;
    currentWeekNumber?: number;
    currentPhase?: string;
    recentSessionTypes?: string[];
  };

  if (!summitGoal) {
    res.status(400).json({ error: "summitGoal required" });
    return;
  }

  const elevationDeficit = Math.max(0, summitGoal.elevationGain * 0.6 - (maxSingleElevation ?? 0));
  const sessionsDone = totalSessionsDone ?? 0;
  const score = readinessScore ?? 5;

  const userMsg = `
Mountain: ${summitGoal.mountainName} (${summitGoal.difficulty}, ${summitGoal.elevationGain}m elevation gain, ${summitGoal.distance}km)
Summit date: ${summitGoal.summitDate} — ${daysRemaining ?? "?"} days away
Fitness level: ${summitGoal.fitnessLevel} | Training ${summitGoal.trainingDaysPerWeek} days/week

Training progress:
- Readiness score: ${score}/100
- Sessions completed: ${sessionsDone}
- Total elevation logged: ${totalElevationLogged ?? 0}m across all sessions
- Best single session elevation: ${maxSingleElevation ?? 0}m (target training benchmark: ${Math.round(summitGoal.elevationGain * 0.6)}m)
- Elevation deficit to benchmark: ${Math.round(elevationDeficit)}m
- This week completion: ${weekCompletion ?? 0}%
- Current week: ${currentWeekNumber ?? 1} of ${weeksInPlan ?? "?"} (${currentPhase ?? "Base"} phase)
- Recent session types: ${(recentSessionTypes ?? []).join(", ") || "none yet"}

Give an honest coaching assessment.`.trim();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 500,
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
        res.status(500).json({ error: "Could not parse coach response" });
        return;
      }
      parsed = JSON.parse(match[0]);
    }

    const validated = CoachResponseSchema.parse(parsed);
    res.json(validated);
  } catch (err) {
    req.log.error({ err }, "Coach assessment failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Coach failed: ${msg}` });
  }
});

export default router;
