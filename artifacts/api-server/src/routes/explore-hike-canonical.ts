import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  canonicalizeExploreHikeWithClient,
} from "../services/exploreHikeCanonicalAdapter";

const router: IRouter = Router();

const ExploreHikeCanonicalizeSchema = z.object({
  exploreHikeId: z.string().min(1).max(256),
  occurredAt: z.coerce.date(),
  activityKind: z.string().min(1).max(128),
  durationSeconds: z.number().int().nonnegative().optional(),
  distanceKm: z.number().nonnegative().optional(),
  recordedAscentM: z.number().int().nonnegative().optional(),
  evidenceClassification: z.enum([
    "gps_recorded",
    "estimated_manual",
    "indoor_training",
    "unavailable_untrusted",
  ]),
  sourceSnapshot: z.record(z.string(), z.unknown()).default({}),
  existingCanonicalActivityId: z.string().uuid().optional(),
  explicitLinks: z.array(z.object({
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
  })).optional(),
});

router.post("/canonicalize", async (req, res) => {
  const parsed = ExploreHikeCanonicalizeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  try {
    const result = await db.transaction((tx) => canonicalizeExploreHikeWithClient(
      tx,
      userId,
      parsed.data,
    ));
    if (result.status === "disabled") {
      return res.status(202).json({ status: "disabled" });
    }
    if (result.status === "conflict") {
      return res.status(409).json({
        error: "Source identity payload conflict",
        conflict: true,
        canonicalActivityId: result.activity.id,
      });
    }
    const canonicalActivityId = "canonicalActivityId" in result
      ? result.canonicalActivityId
      : result.activity.id;
    return res.status(200).json({
      status: result.status,
      canonicalActivityId,
    });
  } catch (error) {
    req.log.error({ error }, "explore-hike/canonicalize failed");
    return res.status(500).json({ error: "Failed to canonicalize ExploreHike" });
  }
});

export default router;
