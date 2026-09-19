import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { canonicalActivities } from "@workspace/db/schema";
import { ingestCanonicalActivity } from "../services/canonicalActivity";

const router: IRouter = Router();

const linkSchema = z.object({
  linkType: z.enum([
    "training_plan",
    "training_session",
    "expedition",
    "expedition_stage",
    "canonical_hill",
    "canonical_route",
    "community_route",
    "challenge",
  ]),
  targetId: z.string().min(1).max(256),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const evidenceSchema = z.object({
  evidenceType: z.enum(["gps_track", "elevation_profile", "manual_estimate", "source_snapshot"]),
  payload: z.any(),
  capturedAt: z.coerce.date().optional(),
});

const activitySchema = z.object({
  sourceType: z.string().min(1).max(64),
  sourceId: z.string().min(1).max(256),
  sourceVersion: z.string().max(64).optional(),
  primaryContext: z.enum(["training", "expedition", "free_hike", "mountain_simulation"]),
  activityKind: z.string().min(1).max(64),
  occurredAt: z.coerce.date(),
  startedAt: z.coerce.date().optional(),
  endedAt: z.coerce.date().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  distanceKm: z.number().nonnegative().optional(),
  recordedAscentM: z.number().int().nonnegative().optional(),
  validatedAscentM: z.number().int().nonnegative().optional(),
  descentM: z.number().int().nonnegative().optional(),
  lifecycle: z.enum(["recording", "completed_local", "pending_sync", "synced", "sync_failed", "corrected", "deleted"]).optional(),
  evidenceState: z.enum(["unverified_manual", "recorded_unverified", "quality_accepted", "verified_activity", "verified_summit_ascent", "competition_eligible"]).optional(),
  visibility: z.enum(["private", "unlisted", "public_summary"]).optional(),
  sourceSnapshot: z.record(z.string(), z.unknown()).optional(),
  evidence: z.array(evidenceSchema).max(8).optional(),
  links: z.array(linkSchema).max(24).optional(),
}).superRefine((value, ctx) => {
  if (value.startedAt && value.endedAt && value.endedAt < value.startedAt) {
    ctx.addIssue({ code: "custom", path: ["endedAt"], message: "endedAt must not be before startedAt" });
  }
});

router.post("/activities", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  try {
    const result = await ingestCanonicalActivity({
      ownerUserId: userId,
      ...parsed.data,
      evidence: parsed.data.evidence?.map((evidence) => ({
        evidenceType: evidence.evidenceType,
        payload: evidence.payload,
        capturedAt: evidence.capturedAt,
      })),
    });
    if (result.status === "conflict") {
      return res.status(409).json({
        error: "Source identity payload conflict",
        activityId: result.activity.id,
        conflict: true,
      });
    }
    return res.status(result.status === "created" ? 201 : 200).json({
      id: result.activity.id,
      deduplicated: result.status === "deduplicated",
      visibility: result.activity.visibility,
      evidenceState: result.activity.evidenceState,
    });
  } catch (err) {
    req.log.error({ err }, "canonical activity ingestion failed");
    return res.status(500).json({ error: "Failed to save activity" });
  }
});

router.get("/activities/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const [activity] = await db.select({
    id: canonicalActivities.id,
    sourceType: canonicalActivities.sourceType,
    sourceId: canonicalActivities.sourceId,
    sourceVersion: canonicalActivities.sourceVersion,
    primaryContext: canonicalActivities.primaryContext,
    activityKind: canonicalActivities.activityKind,
    occurredAt: canonicalActivities.occurredAt,
    startedAt: canonicalActivities.startedAt,
    endedAt: canonicalActivities.endedAt,
    durationSeconds: canonicalActivities.durationSeconds,
    distanceKm: canonicalActivities.distanceKm,
    recordedAscentM: canonicalActivities.recordedAscentM,
    validatedAscentM: canonicalActivities.validatedAscentM,
    descentM: canonicalActivities.descentM,
    lifecycle: canonicalActivities.lifecycle,
    evidenceState: canonicalActivities.evidenceState,
    visibility: canonicalActivities.visibility,
    createdAt: canonicalActivities.createdAt,
    updatedAt: canonicalActivities.updatedAt,
  }).from(canonicalActivities).where(and(
    eq(canonicalActivities.id, req.params.id),
    eq(canonicalActivities.ownerUserId, userId),
  )).limit(1);

  if (!activity) return res.status(404).json({ error: "Activity not found" });
  return res.json(activity);
});

export default router;