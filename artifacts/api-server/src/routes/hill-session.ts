import { Router, type IRouter } from "express";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  canonicalHills,
  canonicalHillRoutes,
  trackedHillSessions,
  hillVerificationStats,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

// ── Quality scoring ──────────────────────────────────────────────────────────

function computeQualityScore(data: {
  recordedDistanceKm?: number | null;
  recordedElevationGainM?: number | null;
  recordedDurationSeconds?: number | null;
  rawGpsTrack?: unknown[] | null;
  estimatedGainPerRepM?: number | null;
  targetReps?: number | null;
}): { dataQualityScore: number; matchConfidence: number } {
  let score = 100;

  const duration = data.recordedDurationSeconds ?? 0;
  const distKm   = data.recordedDistanceKm ?? 0;
  const elevGain = data.recordedElevationGainM ?? 0;
  const track    = Array.isArray(data.rawGpsTrack) ? data.rawGpsTrack : [];

  if (duration < 600)   score -= 30; // < 10 min is suspicious
  if (duration > 86400) score -= 40; // > 24 hours is invalid
  if (distKm < 0.2)     score -= 20;
  if (elevGain <= 0)    score -= 30;
  if (track.length < 10) score -= 20;

  if (distKm > 0 && duration > 0) {
    const speedKmh = (distKm / duration) * 3600;
    if (speedKmh > 8)  score -= 20; // too fast for hiking
    if (speedKmh < 0.3) score -= 10; // extremely slow
  }

  const dataQualityScore = Math.max(0, Math.min(100, score));

  // Match confidence: does the recorded elevation match the estimated?
  let matchConfidence = 50;
  if (data.estimatedGainPerRepM && data.targetReps && elevGain > 0) {
    const expected = data.estimatedGainPerRepM * data.targetReps;
    const ratio    = elevGain / expected;
    if (ratio > 0.5  && ratio < 2.0) matchConfidence = 70;
    if (ratio > 0.7  && ratio < 1.5) matchConfidence = 85;
    if (ratio > 0.85 && ratio < 1.2) matchConfidence = 95;
  } else if (elevGain > 0) {
    matchConfidence = 60;
  }

  return { dataQualityScore, matchConfidence };
}

// ── Recalculate aggregated stats for a hill ──────────────────────────────────

async function recalcHillStats(hillId: number, routeId?: number | null) {
  const sessions = await db
    .select({
      distKm: trackedHillSessions.recordedDistanceKm,
      elevGain: trackedHillSessions.recordedElevationGainM,
    })
    .from(trackedHillSessions)
    .where(
      and(
        eq(trackedHillSessions.hillId, hillId),
        eq(trackedHillSessions.completionType, "tracked_gps"),
        eq(trackedHillSessions.usedForVerification, true),
      )
    );

  if (sessions.length === 0) return;

  const gains = sessions.map(s => s.elevGain ?? 0).filter(g => g > 0).sort((a, b) => a - b);
  const dists = sessions.map(s => s.distKm ?? 0).filter(d => d > 0).sort((a, b) => a - b);

  const median = <T>(arr: T[]) => arr.length === 0 ? null : arr[Math.floor(arr.length / 2)];
  const avg    = (arr: number[]) => arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;

  const medianGain = median(gains) as number | null;
  const medianDist = median(dists) as number | null;
  const avgGain    = avg(gains);
  const avgDist    = avg(dists);

  const existing = await db
    .select({ id: hillVerificationStats.id })
    .from(hillVerificationStats)
    .where(eq(hillVerificationStats.hillId, hillId))
    .limit(1);

  const statsRow = {
    hillId,
    routeId: routeId ?? null,
    sampleCount: sessions.length,
    medianDistanceKm: medianDist,
    medianElevationGainM: medianGain != null ? Math.round(medianGain) : null,
    averageDistanceKm: avgDist,
    averageElevationGainM: avgGain != null ? Math.round(avgGain) : null,
    minElevationGainM: gains.length > 0 ? gains[0] : null,
    maxElevationGainM: gains.length > 0 ? gains[gains.length - 1] : null,
    lastRecalculatedAt: new Date(),
  };

  if (existing.length > 0) {
    await db.update(hillVerificationStats).set(statsRow).where(eq(hillVerificationStats.id, existing[0].id));
  } else {
    await db.insert(hillVerificationStats).values(statsRow);
  }

  // Update confidence score on canonical hill
  let confidence = "LOW";
  if (sessions.length >= 20) confidence = "HIGH";
  else if (sessions.length >= 5) confidence = "MEDIUM";

  if (medianGain != null) {
    await db.update(canonicalHills)
      .set({ verifiedGainM: Math.round(medianGain), verifiedSampleCount: sessions.length, confidenceScore: confidence, updatedAt: new Date() })
      .where(eq(canonicalHills.id, hillId));
  }
}

// ── POST /api/hill-session/complete ─────────────────────────────────────────
// Called when user taps "Mark complete" (no GPS — estimated data only)

const CompleteSchema = z.object({
  plannedHillName:      z.string(),
  hillId:               z.number().int().optional(),
  targetReps:           z.number().int().min(1),
  estimatedGainPerRepM: z.number().int().min(1),
  estimatedTotalGainM:  z.number().int().min(1),
  trainingSessionId:    z.string().optional(),
  trainingPlanId:       z.string().optional(),
});

router.post("/complete", async (req, res) => {
  const parsed = CompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  // Derive userId from the verified Clerk token (falls back to null in dev).
  const { userId } = getAuth(req);
  const d = parsed.data;

  try {
    const [row] = await db.insert(trackedHillSessions).values({
      userId:               userId ?? null,
      hillId:               d.hillId ?? null,
      routeId:              null,
      trainingPlanId:       d.trainingPlanId ?? null,
      trainingSessionId:    d.trainingSessionId ?? null,
      plannedHillName:      d.plannedHillName,
      targetReps:           d.targetReps,
      estimatedGainPerRepM: d.estimatedGainPerRepM,
      estimatedTotalGainM:  d.estimatedTotalGainM,
      completionType:       "estimated_manual",
      usedForVerification:  false,
      completedAt:          new Date(),
    }).returning({ id: trackedHillSessions.id });

    return res.status(201).json({ id: row.id, completionType: "estimated_manual" });
  } catch (err) {
    req.log.error({ err }, "hill-session/complete failed");
    return res.status(500).json({ error: "Failed to save session" });
  }
});

// ── POST /api/hill-session/save-tracked ─────────────────────────────────────
// Called when user finishes GPS tracking with hill metadata

const SaveTrackedSchema = z.object({
  plannedHillName:        z.string(),
  plannedRouteName:       z.string().optional(),
  hillId:                 z.number().int().optional(),
  routeId:                z.number().int().optional(),
  trainingSessionId:      z.string().optional(),
  trainingPlanId:         z.string().optional(),
  targetReps:             z.number().int().min(1).optional(),
  estimatedGainPerRepM:   z.number().int().optional(),
  estimatedTotalGainM:    z.number().int().optional(),
  recordedDistanceKm:     z.number().optional(),
  recordedElevationGainM: z.number().int().optional(),
  recordedDurationSeconds:z.number().int().optional(),
  highestElevationM:      z.number().optional(),
  lowestElevationM:       z.number().optional(),
  rawGpsTrack:            z.array(z.unknown()).optional(),
  elevationProfile:       z.array(z.unknown()).optional(),
});

router.post("/save-tracked", async (req, res) => {
  const parsed = SaveTrackedSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  // Derive userId from the verified Clerk token (falls back to null in dev).
  const { userId } = getAuth(req);
  const d = parsed.data;

  const { dataQualityScore, matchConfidence } = computeQualityScore({
    recordedDistanceKm:     d.recordedDistanceKm,
    recordedElevationGainM: d.recordedElevationGainM,
    recordedDurationSeconds:d.recordedDurationSeconds,
    rawGpsTrack:            d.rawGpsTrack,
    estimatedGainPerRepM:   d.estimatedGainPerRepM,
    targetReps:             d.targetReps,
  });

  // High-quality GPS tracks are automatically eligible for verification
  const usedForVerification = dataQualityScore >= 70 && matchConfidence >= 70;

  try {
    const [row] = await db.insert(trackedHillSessions).values({
      userId:                 userId ?? null,
      hillId:                 d.hillId ?? null,
      routeId:                d.routeId ?? null,
      trainingPlanId:         d.trainingPlanId ?? null,
      trainingSessionId:      d.trainingSessionId ?? null,
      plannedHillName:        d.plannedHillName,
      plannedRouteName:       d.plannedRouteName ?? null,
      targetReps:             d.targetReps ?? null,
      estimatedGainPerRepM:   d.estimatedGainPerRepM ?? null,
      estimatedTotalGainM:    d.estimatedTotalGainM ?? null,
      completionType:         "tracked_gps",
      recordedDistanceKm:     d.recordedDistanceKm ?? null,
      recordedElevationGainM: d.recordedElevationGainM ?? null,
      recordedDurationSeconds:d.recordedDurationSeconds ?? null,
      highestElevationM:      d.highestElevationM ?? null,
      lowestElevationM:       d.lowestElevationM ?? null,
      rawGpsTrack:            d.rawGpsTrack ?? null,
      elevationProfile:       d.elevationProfile ?? null,
      dataQualityScore,
      matchConfidence,
      usedForVerification,
      completedAt:            new Date(),
    }).returning({ id: trackedHillSessions.id });

    // Recalculate stats for this hill if we have a canonical record
    if (d.hillId && usedForVerification) {
      recalcHillStats(d.hillId, d.routeId).catch((err: unknown) => {
        req.log.error({ err, hillId: d.hillId, routeId: d.routeId }, "recalcHillStats failed after session creation");
      });
    }

    return res.status(201).json({
      id: row.id,
      completionType: "tracked_gps",
      dataQualityScore,
      matchConfidence,
      usedForVerification,
    });
  } catch (err) {
    req.log.error({ err }, "hill-session/save-tracked failed");
    return res.status(500).json({ error: "Failed to save tracked session" });
  }
});

export default router;
