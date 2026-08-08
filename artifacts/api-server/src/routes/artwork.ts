/**
 * Artwork API
 * ───────────
 * Internal routes for the AI Artwork Pipeline.
 *
 * All routes are mounted at /api/artwork (see routes/index.ts).
 *
 * Public (no auth):
 *   GET  /api/artwork/status                  — status for all active challenges
 *   GET  /api/artwork/image/:id/:crop         — stream a generated image from GCS
 *   GET  /api/artwork/prompt/:challengeId     — preview the auto-built prompt
 *
 * Admin (requireAdminAuth — server-verified on every request):
 *   POST   /api/artwork/generate/:challengeId — generate artwork for one challenge
 *   POST   /api/artwork/bulk                  — bulk-generate (SSE progress stream)
 *   POST   /api/artwork/approve/:challengeId  — approve artwork for live use
 *   POST   /api/artwork/reject/:challengeId   — reject artwork
 *   DELETE /api/artwork/:challengeId          — clear all artwork + GCS objects
 */

import { Router } from "express";
import {
  generateChallengeArtwork,
  approveChallengeArtwork,
  rejectChallengeArtwork,
  clearChallengeArtwork,
  bulkGenerateArtwork,
  getArtworkStatus,
} from "../services/artwork/artworkService.js";
import { streamArtworkImage, type CropType } from "../services/artwork/artworkStorage.js";
import { buildExpeditionPrompt } from "../services/artwork/promptBuilder.js";
import { db, signatureChallenges, challengeStages } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/requireAdminAuth.js";
import { writeAuditLog } from "../lib/auditLog.js";

// Normalise Express route params (always string in real requests, typed as string | string[])
function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0]! : p;
}

export const artworkRouter = Router();

const VALID_CROPS: CropType[] = ["hero", "card", "thumbnail", "master"];

// ── Public read-only endpoints ─────────────────────────────────────────────────

// GET /api/artwork/status
artworkRouter.get("/status", async (_req, res) => {
  try {
    const statuses = await getArtworkStatus();
    return res.json({ challenges: statuses, total: statuses.length });
  } catch (err) {
    console.error("[artwork/status]", err);
    return res.status(500).json({ error: "Failed to fetch artwork status" });
  }
});

// GET /api/artwork/image/:challengeId/:crop
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
    if (!res.headersSent) res.status(500).json({ error: "Failed to serve image" });
  }
});

// GET /api/artwork/prompt/:challengeId
artworkRouter.get("/prompt/:challengeId", async (req, res) => {
  const { challengeId } = req.params;
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

// ── Admin-only endpoints (server-verified on every request) ───────────────────

// POST /api/artwork/generate/:challengeId
artworkRouter.post("/generate/:challengeId", requireAdminAuth(), async (req, res) => {
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

// POST /api/artwork/bulk
artworkRouter.post("/bulk", requireAdminAuth(), async (req, res) => {
  const force = req.body?.force === true;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const report = await bulkGenerateArtwork(
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
});

// POST /api/artwork/approve/:challengeId
artworkRouter.post("/approve/:challengeId", requireAdminAuth(), async (req, res) => {
  const challengeId = param(req.params.challengeId);
  try {
    await approveChallengeArtwork(challengeId);
    void writeAuditLog(res.locals.adminIdentity, "approve_artwork", challengeId);
    return res.json({ challengeId, approved: true });
  } catch (err) {
    console.error(`[artwork/approve] ${challengeId}`, err);
    return res.status(500).json({ error: "Failed to approve artwork" });
  }
});

// POST /api/artwork/reject/:challengeId
artworkRouter.post("/reject/:challengeId", requireAdminAuth(), async (req, res) => {
  const challengeId = param(req.params.challengeId);
  try {
    await rejectChallengeArtwork(challengeId);
    void writeAuditLog(res.locals.adminIdentity, "reject_artwork", challengeId);
    return res.json({ challengeId, approved: false, status: "rejected" });
  } catch (err) {
    console.error(`[artwork/reject] ${challengeId}`, err);
    return res.status(500).json({ error: "Failed to reject artwork" });
  }
});

// DELETE /api/artwork/:challengeId
artworkRouter.delete("/:challengeId", requireAdminAuth(), async (req, res) => {
  const challengeId = param(req.params.challengeId);
  try {
    await clearChallengeArtwork(challengeId);
    void writeAuditLog(res.locals.adminIdentity, "delete_artwork", challengeId);
    return res.json({ challengeId, cleared: true });
  } catch (err) {
    console.error(`[artwork/delete] ${challengeId}`, err);
    return res.status(500).json({ error: "Failed to clear artwork" });
  }
});
