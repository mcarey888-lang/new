/**
 * Artwork API
 * ───────────
 * Internal routes for the AI Artwork Pipeline.
 *
 * All routes are mounted at /api/artwork (see routes/index.ts).
 *
 * Endpoints:
 *   GET    /api/artwork/status                  — status for all active challenges
 *   GET    /api/artwork/image/:id/:crop         — stream a generated image from GCS
 *   POST   /api/artwork/generate/:challengeId   — generate artwork for one challenge
 *   POST   /api/artwork/bulk                    — bulk-generate (SSE progress stream)
 *   POST   /api/artwork/approve/:challengeId    — approve artwork for live use
 *   POST   /api/artwork/reject/:challengeId     — reject artwork
 *   DELETE /api/artwork/:challengeId            — clear all artwork + GCS objects
 */

import { Router, type NextFunction, type Request, type Response } from "express";
import {
  generateChallengeArtwork,
  approveChallengeArtwork,
  rejectChallengeArtwork,
  clearChallengeArtwork,
  bulkGenerateArtwork,
  getArtworkStatus,
} from "../services/artwork/artworkService.js";
import {
  streamArtworkImage,
  streamReviewCandidate,
  type CropType,
} from "../services/artwork/artworkStorage.js";
import { buildExpeditionPrompt } from "../services/artwork/promptBuilder.js";
import { db, signatureChallenges, challengeStages } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  approveMountainHero,
  findMountainHeroCandidates,
  listMountainHeroReviews,
  rejectMountainHeroCandidate,
} from "../services/artwork/mountainHeroReview.js";
import { requireAdminKey } from "../middlewares/requireAdminKey.js";
import {
  approveBatch01Version,
  generateBatch01Candidate,
  getBatch01Manifest,
  rejectBatch01Version,
} from "../services/artwork/reviewBatchService.js";
import { BATCH_01_ID, isObjectiveFailureReason } from "../services/artwork/batch01.js";
import { BATCH_02_ID } from "../services/artwork/batch02.js";
import {
  approveBatch02Version,
  generateBatch02Candidate,
  getBatch02Manifest,
  rejectBatch02Version,
} from "../services/artwork/reviewBatch02Service.js";
import {
  APPROVED_ARTWORK_PLACEMENTS,
  resolveApprovedBatch01Artwork,
} from "../services/artwork/approvedArtworkResolver.js";

export const artworkRouter = Router();

const VALID_CROPS: CropType[] = ["hero", "card", "thumbnail", "master"];

// Normalise Express route params (string in real requests, string | string[] in Express 5 types).
function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0]! : value;
}

function requireDevelopment(_req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== "development") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  next();
}

/**
 * Stable, read-only Batch 01 contract for app artwork.
 * This endpoint intentionally returns only an approved current crop URL.
 */
artworkRouter.get("/resolve/:assetId/:placement", requireDevelopment, async (req, res) => {
  const assetId = param(req.params.assetId);
  const placement = param(req.params.placement);
  if (!APPROVED_ARTWORK_PLACEMENTS.includes(placement as typeof APPROVED_ARTWORK_PLACEMENTS[number])) {
    return res.status(404).json({ error: "Artwork not found" });
  }
  const manifest = await getBatch01Manifest();
  const resolved = resolveApprovedBatch01Artwork(manifest, assetId, placement);
  if (!resolved) return res.status(404).json({ error: "Artwork not found" });
  return res.json(resolved);
});

artworkRouter.get("/approved/:assetId/:placement", requireDevelopment, async (req, res) => {
  const assetId = param(req.params.assetId);
  const placement = param(req.params.placement);
  const manifest = await getBatch01Manifest();
  const resolved = resolveApprovedBatch01Artwork(manifest, assetId, placement);
  if (!resolved) return res.status(404).json({ error: "Artwork not found" });
  const current = manifest.versions
    .filter((candidate) => candidate.assetId === assetId)
    .reduce<(typeof manifest.versions)[number] | null>(
      (latest, candidate) => !latest || candidate.version > latest.version ? candidate : latest,
      null,
    );
  if (!current) return res.status(404).json({ error: "Artwork not found" });
  await streamReviewCandidate(
    BATCH_01_ID,
    assetId,
    current.version,
    placement as CropType,
    res,
    "private, no-store, max-age=0",
  );
  return;
});

artworkRouter.get("/batches/:batchId", requireDevelopment, async (req, res) => {
  const batchId = param(req.params.batchId);
  if (batchId === BATCH_01_ID) return res.json(await getBatch01Manifest());
  if (batchId === BATCH_02_ID) return res.json(await getBatch02Manifest());
  return res.status(404).json({ error: "Review batch not found" });
});

artworkRouter.get("/batches/:batchId/:assetId/v:version/:crop", requireDevelopment, async (req, res) => {
  const batchId = param(req.params.batchId);
  const assetId = param(req.params.assetId);
  const crop = param(req.params.crop) as CropType;
  const version = Number(param(req.params.version));
  if (![BATCH_01_ID, BATCH_02_ID].includes(batchId) || !VALID_CROPS.includes(crop) || !Number.isInteger(version) || version < 1) {
    return res.status(400).json({ error: "Invalid review candidate request" });
  }
  await streamReviewCandidate(batchId, assetId, version, crop, res);
  return;
});

artworkRouter.post("/batches/:batchId/generate", requireDevelopment, requireAdminKey, async (req, res) => {
  const batchId = param(req.params.batchId);
  try {
    if (batchId === BATCH_02_ID) {
      if (typeof req.body?.assetId !== "string" || req.body?.confirmed !== true) {
        return res.status(400).json({ error: "Batch 02 initial generation requires one asset and explicit confirmation" });
      }
      if (req.body?.objectiveFailureReason !== undefined) {
        return res.status(400).json({ error: "Batch 02 regeneration is not authorized" });
      }
      return res.json(await generateBatch02Candidate(req.body.assetId));
    }
    if (batchId === BATCH_01_ID && typeof req.body?.assetId === "string") {
      const reason = req.body?.objectiveFailureReason;
      if (!isObjectiveFailureReason(reason)) {
        return res.status(400).json({ error: "Invalid objectiveFailureReason" });
      }
      if (req.body?.confirmed !== true) {
        return res.status(400).json({ error: "Regeneration requires explicit confirmation" });
      }
      return res.json(await generateBatch01Candidate(req.body.assetId, reason));
    }
    if (![BATCH_01_ID, BATCH_02_ID].includes(batchId)) {
      return res.status(404).json({ error: "Review batch not found" });
    }
    return res.status(400).json({ error: "Whole-batch generation is disabled; choose one asset" });
  } catch (err) {
    console.error(`[artwork/${batchId}/generate]`, err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Batch generation failed" });
  }
});

artworkRouter.post(
  "/batches/:batchId/:assetId/v:version/approve",
  requireDevelopment,
  requireAdminKey,
  async (req, res) => {
    const batchId = param(req.params.batchId);
    if (![BATCH_01_ID, BATCH_02_ID].includes(batchId)) {
      return res.status(404).json({ error: "Review batch not found" });
    }
    const version = Number(param(req.params.version));
    if (!Number.isInteger(version) || version < 1) {
      return res.status(400).json({ error: "Invalid version" });
    }
    try {
      const assetId = param(req.params.assetId);
      return res.json(batchId === BATCH_01_ID
        ? await approveBatch01Version(assetId, version)
        : await approveBatch02Version(assetId, version));
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Approval failed" });
    }
  },
);

artworkRouter.post(
  "/batches/:batchId/:assetId/v:version/reject",
  requireDevelopment,
  requireAdminKey,
  async (req, res) => {
    const batchId = param(req.params.batchId);
    if (![BATCH_01_ID, BATCH_02_ID].includes(batchId)) {
      return res.status(404).json({ error: "Review batch not found" });
    }
    const version = Number(param(req.params.version));
    if (!Number.isInteger(version) || version < 1 || typeof req.body?.reason !== "string") {
      return res.status(400).json({ error: "Version and rejection reason are required" });
    }
    try {
      const assetId = param(req.params.assetId);
      return res.json(batchId === BATCH_01_ID
        ? await rejectBatch01Version(assetId, version, req.body.reason)
        : await rejectBatch02Version(assetId, version, req.body.reason));
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Rejection failed" });
    }
  },
);

artworkRouter.get("/mountains", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(48, Math.max(6, Number(req.query.pageSize) || 24));
    const status = ["review-required", "approved"].includes(String(req.query.status))
      ? String(req.query.status) as "review-required" | "approved"
      : "all";
    const sort = ["prominence", "elevation", "name"].includes(String(req.query.sort))
      ? String(req.query.sort) as "prominence" | "elevation" | "name"
      : "prominence";
    return res.json(await listMountainHeroReviews({
      page,
      pageSize,
      search: String(req.query.search ?? ""),
      status,
      sort,
    }));
  } catch (err) {
    console.error("[artwork/mountains]", err);
    return res.status(500).json({ error: "Failed to load mountain hero queue" });
  }
});

artworkRouter.post("/mountains/:id/candidates", requireAdminKey, async (req, res) => {
  try {
    return res.json(await findMountainHeroCandidates(param(req.params.id)));
  } catch (err) {
    console.error("[artwork/mountains/candidates]", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Candidate search failed" });
  }
});

artworkRouter.post("/mountains/:id/approve", requireAdminKey, async (req, res) => {
  try {
    if (!req.body?.candidate?.imageUrl) {
      return res.status(400).json({ error: "Candidate image is required" });
    }
    return res.json(await approveMountainHero(param(req.params.id), req.body.candidate));
  } catch (err) {
    console.error("[artwork/mountains/approve]", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Approval failed" });
  }
});

artworkRouter.post("/mountains/:id/reject", requireAdminKey, async (req, res) => {
  try {
    if (typeof req.body?.imageUrl !== "string") {
      return res.status(400).json({ error: "Image URL is required" });
    }
    return res.json(await rejectMountainHeroCandidate(param(req.params.id), req.body.imageUrl));
  } catch (err) {
    console.error("[artwork/mountains/reject]", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Rejection failed" });
  }
});

// ── GET /api/artwork/status ────────────────────────────────────────────────────
artworkRouter.get("/status", async (_req, res) => {
  try {
    const statuses = await getArtworkStatus();
    return res.json({ challenges: statuses, total: statuses.length });
  } catch (err) {
    console.error("[artwork/status]", err);
    return res.status(500).json({ error: "Failed to fetch artwork status" });
  }
});

// ── GET /api/artwork/image/:challengeId/:crop ─────────────────────────────────
// Streams a generated image from GCS. Cached by CDN / browser for 1 year.
artworkRouter.get("/image/:challengeId/:crop", async (req, res) => {
  const { challengeId, crop } = req.params;
  if (!VALID_CROPS.includes(crop as CropType)) {
    res.status(400).json({ error: `Invalid crop type. Must be one of: ${VALID_CROPS.join(", ")}` });
    return;
  }
  try {
    await streamArtworkImage(challengeId, crop as CropType, res);
  } catch (err) {
    console.error(`[artwork/image] ${challengeId}/${crop}`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to serve image" });
    }
  }
});

// ── GET /api/artwork/prompt/:challengeId ──────────────────────────────────────
// Returns the auto-built prompt without generating an image.
artworkRouter.get("/prompt/:challengeId", async (req, res) => {
  const challengeId = param(req.params.challengeId);
  try {
    const rows = await db
      .select()
      .from(signatureChallenges)
      .where(eq(signatureChallenges.challengeId, challengeId))
      .limit(1);

    if (rows.length === 0) return res.status(404).json({ error: "Challenge not found" });

    const challenge = rows[0];
    const stages = await db
      .select()
      .from(challengeStages)
      .where(eq(challengeStages.challengeId, challengeId))
      .orderBy(challengeStages.stageOrder);

    const { prompt, hash } = buildExpeditionPrompt(challenge, stages);
    return res.json({ prompt, hash, challengeId });
  } catch (err) {
    console.error("[artwork/prompt]", err);
    return res.status(500).json({ error: "Failed to build prompt" });
  }
});

// ── POST /api/artwork/generate/:challengeId ────────────────────────────────────
// Body: { force?: boolean }
artworkRouter.post("/generate/:challengeId", requireAdminKey, async (req, res) => {
  const challengeId = param(req.params.challengeId);
  const force = req.body?.force === true;

  try {
    const result = await generateChallengeArtwork(challengeId, force);
    const status = result.status === "failed" ? 500 : 200;
    return res.status(status).json(result);
  } catch (err) {
    console.error(`[artwork/generate] ${challengeId}`, err);
    return res.status(500).json({
      challengeId,
      status: "failed",
      reason: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ── POST /api/artwork/bulk ─────────────────────────────────────────────────────
// Streams Server-Sent Events (SSE) with progress updates.
// Each event is a JSON object: { index, total, result: GenerateResult }
// Final event: { done: true, report: BulkResult }
// Body: { force?: boolean }
artworkRouter.post("/bulk", requireAdminKey, async (req, res) => {
  const force = req.body?.force === true;
  const requestedIds: unknown = req.body?.challengeIds;
  const challengeIds: string[] = Array.isArray(requestedIds)
    ? [...new Set(requestedIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0))]
    : [];
  const expectedCount = Number(req.body?.expectedCount);
  if (
    req.body?.confirmed !== true
    || challengeIds.length === 0
    || challengeIds.length > 25
    || expectedCount !== challengeIds.length
  ) {
    return res.status(400).json({
      error: "Bulk generation requires confirmation and a curated selection of 1 to 25 challenges",
    });
  }

  // SSE setup
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const report = await bulkGenerateArtwork(
      challengeIds,
      (result, index, total) => {
        send({ index, total, result });
      },
      force,
    );

    send({ done: true, report });
  } catch (err) {
    console.error("[artwork/bulk]", err);
    send({ error: err instanceof Error ? err.message : "Bulk generation failed" });
  } finally {
    res.end();
  }
  return;
});

// ── POST /api/artwork/approve/:challengeId ─────────────────────────────────────
artworkRouter.post("/approve/:challengeId", requireAdminKey, async (req, res) => {
  const challengeId = param(req.params.challengeId);
  try {
    await approveChallengeArtwork(challengeId);
    return res.json({ challengeId, approved: true });
  } catch (err) {
    console.error(`[artwork/approve] ${challengeId}`, err);
    return res.status(500).json({ error: "Failed to approve artwork" });
  }
});

// ── POST /api/artwork/reject/:challengeId ──────────────────────────────────────
artworkRouter.post("/reject/:challengeId", requireAdminKey, async (req, res) => {
  const challengeId = param(req.params.challengeId);
  try {
    await rejectChallengeArtwork(challengeId);
    return res.json({ challengeId, approved: false, status: "rejected" });
  } catch (err) {
    console.error(`[artwork/reject] ${challengeId}`, err);
    return res.status(500).json({ error: "Failed to reject artwork" });
  }
});

// ── DELETE /api/artwork/:challengeId ───────────────────────────────────────────
// Removes all stored images (GCS + DB fields).
artworkRouter.delete("/:challengeId", requireAdminKey, async (req, res) => {
  const challengeId = param(req.params.challengeId);
  try {
    await clearChallengeArtwork(challengeId);
    return res.json({ challengeId, cleared: true });
  } catch (err) {
    console.error(`[artwork/delete] ${challengeId}`, err);
    return res.status(500).json({ error: "Failed to clear artwork" });
  }
});
