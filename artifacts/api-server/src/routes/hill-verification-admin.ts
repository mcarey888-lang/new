import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  trackedHillSessions,
  canonicalHills,
  hillVerificationStats,
} from "@workspace/db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/requireAdminAuth.js";
import { writeAuditLog } from "../lib/auditLog.js";

const router: IRouter = Router();

// All routes in this file require admin authentication
router.use(requireAdminAuth());

// ── GET /api/admin/hill-verification/sessions ────────────────────────────────
// Returns recent tracked hill sessions for admin review.
// userId is intentionally omitted from the response to avoid leaking PII.

router.get("/sessions", async (req, res) => {
  const limit  = Math.min(Number(req.query.limit  ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const type   = req.query.type as string | undefined; // "tracked_gps" | "estimated_manual"

  try {
    const conditions = [];
    if (type) conditions.push(eq(trackedHillSessions.completionType, type));

    const rows = await db
      .select({
        // userId intentionally excluded — not needed by the admin UI
        id:                     trackedHillSessions.id,
        plannedHillName:        trackedHillSessions.plannedHillName,
        plannedRouteName:       trackedHillSessions.plannedRouteName,
        completionType:         trackedHillSessions.completionType,
        targetReps:             trackedHillSessions.targetReps,
        estimatedGainPerRepM:   trackedHillSessions.estimatedGainPerRepM,
        estimatedTotalGainM:    trackedHillSessions.estimatedTotalGainM,
        recordedDistanceKm:     trackedHillSessions.recordedDistanceKm,
        recordedElevationGainM: trackedHillSessions.recordedElevationGainM,
        recordedDurationSeconds:trackedHillSessions.recordedDurationSeconds,
        dataQualityScore:       trackedHillSessions.dataQualityScore,
        matchConfidence:        trackedHillSessions.matchConfidence,
        usedForVerification:    trackedHillSessions.usedForVerification,
        adminApproved:          trackedHillSessions.adminApproved,
        hillId:                 trackedHillSessions.hillId,
        createdAt:              trackedHillSessions.createdAt,
        completedAt:            trackedHillSessions.completedAt,
      })
      .from(trackedHillSessions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(trackedHillSessions.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({ sessions: rows, limit, offset });
  } catch (err) {
    req.log.error({ err }, "admin/hill-verification/sessions failed");
    return res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// ── GET /api/admin/hill-verification/stats ───────────────────────────────────

router.get("/stats", async (req, res) => {
  try {
    const [counts] = await db.select({
      totalSessions:   sql<number>`count(*)::int`,
      trackedGps:      sql<number>`count(*) filter (where ${trackedHillSessions.completionType} = 'tracked_gps')::int`,
      estimatedManual: sql<number>`count(*) filter (where ${trackedHillSessions.completionType} = 'estimated_manual')::int`,
      highQuality:     sql<number>`count(*) filter (where ${trackedHillSessions.dataQualityScore} >= 70)::int`,
      usedForVerif:    sql<number>`count(*) filter (where ${trackedHillSessions.usedForVerification} = true)::int`,
      adminApproved:   sql<number>`count(*) filter (where ${trackedHillSessions.adminApproved} = true)::int`,
    }).from(trackedHillSessions);

    const [hillCounts] = await db.select({
      totalHills:      sql<number>`count(*)::int`,
      highConfidence:  sql<number>`count(*) filter (where ${canonicalHills.confidenceScore} = 'HIGH')::int`,
      medConfidence:   sql<number>`count(*) filter (where ${canonicalHills.confidenceScore} = 'MEDIUM')::int`,
      lowConfidence:   sql<number>`count(*) filter (where ${canonicalHills.confidenceScore} = 'LOW')::int`,
    }).from(canonicalHills);

    return res.json({ sessions: counts, hills: hillCounts });
  } catch (err) {
    req.log.error({ err }, "admin/hill-verification/stats failed");
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ── GET /api/admin/hill-verification/hills ───────────────────────────────────

router.get("/hills", async (req, res) => {
  const limit  = Math.min(Number(req.query.limit  ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  try {
    const rows = await db
      .select()
      .from(canonicalHills)
      .orderBy(desc(canonicalHills.verifiedSampleCount))
      .limit(limit)
      .offset(offset);

    return res.json({ hills: rows, limit, offset });
  } catch (err) {
    req.log.error({ err }, "admin/hill-verification/hills failed");
    return res.status(500).json({ error: "Failed to fetch hills" });
  }
});

// ── POST /api/admin/hill-verification/approve/:id ────────────────────────────

router.post("/approve/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [row] = await db
      .update(trackedHillSessions)
      .set({ adminApproved: true, usedForVerification: true })
      .where(eq(trackedHillSessions.id, id))
      .returning({ hillId: trackedHillSessions.hillId, routeId: trackedHillSessions.routeId });

    if (!row) return res.status(404).json({ error: "Session not found" });

    void writeAuditLog(res.locals.adminIdentity, "approve_hill_session", id);

    return res.json({ ok: true, id });
  } catch (err) {
    req.log.error({ err }, "admin/hill-verification/approve failed");
    return res.status(500).json({ error: "Failed to approve session" });
  }
});

// ── POST /api/admin/hill-verification/reject/:id ─────────────────────────────

router.post("/reject/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [row] = await db
      .update(trackedHillSessions)
      .set({ adminApproved: false, usedForVerification: false })
      .where(eq(trackedHillSessions.id, id))
      .returning({ id: trackedHillSessions.id });

    if (!row) return res.status(404).json({ error: "Session not found" });

    void writeAuditLog(res.locals.adminIdentity, "reject_hill_session", id);

    return res.json({ ok: true, id });
  } catch (err) {
    req.log.error({ err }, "admin/hill-verification/reject failed");
    return res.status(500).json({ error: "Failed to reject session" });
  }
});

export default router;
