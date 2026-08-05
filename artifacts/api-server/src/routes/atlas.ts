/**
 * Atlas Media Studio API
 * ──────────────────────
 * Internal routes for the Atlas Media Studio AI image pipeline.
 * Mounted at /api/atlas.
 *
 * Endpoints:
 *   GET    /api/atlas/brands                     — list all active brands
 *   GET    /api/atlas/asset-types                — list all asset types
 *   GET    /api/atlas/status                     — all assets (optionally filtered by brand)
 *   GET    /api/atlas/image/:assetId/:crop       — stream image from storage
 *   POST   /api/atlas/assets                     — create a new asset record
 *   POST   /api/atlas/generate/:assetId          — generate image for one asset
 *   POST   /api/atlas/bulk                       — bulk generate (SSE stream)
 *   POST   /api/atlas/approve/:assetId           — approve
 *   POST   /api/atlas/reject/:assetId            — reject
 *   POST   /api/atlas/archive/:assetId           — archive (soft delete)
 *   POST   /api/atlas/publish/:assetId           — publish
 *   POST   /api/atlas/upload/:assetId             — import local image (base64 JSON)
 *   POST   /api/atlas/github/publish             — publish approved assets to GitHub
 *   GET    /api/atlas/github/queue               — approved assets pending GitHub publish
 *   GET    /api/atlas/github/status              — GitHub connection + rate-limit status
 *   PATCH  /api/atlas/brands/:brandId/style-lock — update brand style lock
 *   DELETE /api/atlas/:assetId                   — clear asset + storage
 */

import { Router } from "express";
import {
  generateAtlasAsset,
  approveAtlasAsset,
  rejectAtlasAsset,
  archiveAtlasAsset,
  publishAtlasAsset,
  clearAtlasAsset,
  bulkGenerateAtlasAssets,
  getAtlasStatus,
  getAllBrands,
  getAllAssetTypes,
  updateStyleLock,
  createAtlasAsset,
  importAtlasAsset,
} from "../services/atlas/atlasService.js";
import { streamAtlasImage } from "../services/atlas/atlasStorage.js";
import {
  publishAtlasAssets,
  getGitHubStatus,
  getPublishQueue,
} from "../services/atlas/atlasGitHubService.js";
import type { AtlasCropName } from "../services/atlas/atlasCropService.js";

export const atlasRouter = Router();

const VALID_CROPS: AtlasCropName[] = [
  "master", "desktopHero", "mobileHero", "section",
  "card", "square", "portrait", "landscape", "social",
];

// ── GET /api/atlas/brands ─────────────────────────────────────────────────────
atlasRouter.get("/brands", async (_req, res) => {
  try {
    const brands = await getAllBrands();
    return res.json({ brands });
  } catch (err) {
    console.error("[atlas/brands]", err);
    return res.status(500).json({ error: "Failed to fetch brands" });
  }
});

// ── GET /api/atlas/asset-types ────────────────────────────────────────────────
atlasRouter.get("/asset-types", async (_req, res) => {
  try {
    const assetTypes = await getAllAssetTypes();
    return res.json({ assetTypes });
  } catch (err) {
    console.error("[atlas/asset-types]", err);
    return res.status(500).json({ error: "Failed to fetch asset types" });
  }
});

// ── GET /api/atlas/status ─────────────────────────────────────────────────────
atlasRouter.get("/status", async (req, res) => {
  try {
    const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
    const assets = await getAtlasStatus(brandId);
    return res.json({ assets, total: assets.length });
  } catch (err) {
    console.error("[atlas/status]", err);
    return res.status(500).json({ error: "Failed to fetch asset status" });
  }
});

// ── GET /api/atlas/image/:assetId/:crop ───────────────────────────────────────
atlasRouter.get("/image/:assetId/:crop", async (req, res) => {
  const assetId = Array.isArray(req.params.assetId) ? req.params.assetId[0] : req.params.assetId;
  const crop    = Array.isArray(req.params.crop)    ? req.params.crop[0]    : req.params.crop;
  if (!VALID_CROPS.includes(crop as AtlasCropName)) {
    res.status(400).json({ error: `Invalid crop. Must be one of: ${VALID_CROPS.join(", ")}` });
    return;
  }
  try {
    await streamAtlasImage(assetId, crop as AtlasCropName, res);
  } catch (err) {
    console.error(`[atlas/image] ${assetId}/${crop}`, err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to serve image" });
  }
});

// ── POST /api/atlas/assets ────────────────────────────────────────────────────
atlasRouter.post("/assets", async (req, res) => {
  const { brandId, assetTypeId, sceneVars } = req.body ?? {};
  if (!brandId || !assetTypeId) {
    return res.status(400).json({ error: "brandId and assetTypeId are required" });
  }
  try {
    const assetId = await createAtlasAsset(Number(brandId), Number(assetTypeId), sceneVars ?? {});
    return res.json({ assetId });
  } catch (err) {
    console.error("[atlas/assets]", err);
    return res.status(500).json({ error: "Failed to create asset" });
  }
});

// Normalise Express route params (always string in real requests, but typed as string | string[])
function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0]! : p;
}

// ── POST /api/atlas/generate/:assetId ────────────────────────────────────────
atlasRouter.post("/generate/:assetId", async (req, res) => {
  const assetId = param(req.params.assetId);
  const force = req.body?.force === true;
  try {
    const result = await generateAtlasAsset(assetId, force);
    const status = result.status === "failed" ? 500 : 200;
    return res.status(status).json(result);
  } catch (err) {
    console.error(`[atlas/generate] ${assetId}`, err);
    return res.status(500).json({ assetId, status: "failed", reason: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ── POST /api/atlas/upload/:assetId ──────────────────────────────────────────
atlasRouter.post("/upload/:assetId", async (req, res) => {
  const assetId = param(req.params.assetId);
  const { data, mimeType } = req.body ?? {};
  if (!data || typeof data !== "string") {
    return res.status(400).json({ error: "Missing base64 image data" });
  }
  try {
    const buffer = Buffer.from(data, "base64");
    const result = await importAtlasAsset(assetId, buffer);
    return res.status(result.ok ? 200 : 500).json(result);
  } catch (err) {
    console.error(`[atlas/upload] ${assetId}`, err);
    return res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "Upload failed" });
  }
});

// ── POST /api/atlas/bulk ──────────────────────────────────────────────────────
atlasRouter.post("/bulk", async (req, res) => {
  const force = req.body?.force === true;
  const brandId = req.body?.brandId ? Number(req.body.brandId) : null;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const report = await bulkGenerateAtlasAssets(
      brandId,
      (result, index, total) => send({ index, total, result }),
      force,
    );
    send({ done: true, report });
  } catch (err) {
    console.error("[atlas/bulk]", err);
    send({ error: err instanceof Error ? err.message : "Bulk generation failed" });
  } finally {
    res.end();
  }
});

// ── POST /api/atlas/approve/:assetId ─────────────────────────────────────────
atlasRouter.post("/approve/:assetId", async (req, res) => {
  const assetId = param(req.params.assetId);
  try {
    await approveAtlasAsset(assetId);
    return res.json({ assetId, approved: true });
  } catch (err) {
    console.error(`[atlas/approve] ${assetId}`, err);
    return res.status(500).json({ error: "Failed to approve asset" });
  }
});

// ── POST /api/atlas/reject/:assetId ──────────────────────────────────────────
atlasRouter.post("/reject/:assetId", async (req, res) => {
  const assetId = param(req.params.assetId);
  try {
    await rejectAtlasAsset(assetId);
    return res.json({ assetId, approved: false, status: "rejected" });
  } catch (err) {
    console.error(`[atlas/reject] ${assetId}`, err);
    return res.status(500).json({ error: "Failed to reject asset" });
  }
});

// ── POST /api/atlas/archive/:assetId ─────────────────────────────────────────
atlasRouter.post("/archive/:assetId", async (req, res) => {
  const assetId = param(req.params.assetId);
  try {
    await archiveAtlasAsset(assetId);
    return res.json({ assetId, archived: true });
  } catch (err) {
    console.error(`[atlas/archive] ${assetId}`, err);
    return res.status(500).json({ error: "Failed to archive asset" });
  }
});

// ── POST /api/atlas/publish/:assetId ─────────────────────────────────────────
atlasRouter.post("/publish/:assetId", async (req, res) => {
  const assetId = param(req.params.assetId);
  try {
    const result = await publishAtlasAsset(assetId);
    if (!result.ok) {
      return res.status(400).json({ error: result.reason ?? "Cannot publish asset" });
    }
    return res.json({ assetId, published: true });
  } catch (err) {
    console.error(`[atlas/publish] ${assetId}`, err);
    return res.status(500).json({ error: "Failed to publish asset" });
  }
});

// ── GET /api/atlas/github/status ─────────────────────────────────────────────
atlasRouter.get("/github/status", async (_req, res) => {
  try {
    const status = await getGitHubStatus();
    return res.json(status);
  } catch (err) {
    return res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ── GET /api/atlas/github/queue ───────────────────────────────────────────────
atlasRouter.get("/github/queue", async (req, res) => {
  const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
  try {
    const queue = await getPublishQueue(brandId);
    return res.json({ queue });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ── POST /api/atlas/github/publish ────────────────────────────────────────────
// Body: { assetIds?: string[], brandId?: number }
// If assetIds is empty/omitted and brandId is set, publishes all approved for that brand.
atlasRouter.post("/github/publish", async (req, res) => {
  const assetIds: string[] = req.body?.assetIds ?? [];
  const brandId: number | undefined = req.body?.brandId ? Number(req.body.brandId) : undefined;

  // SSE so the client can show progress
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    send({ status: "starting", message: "Preparing assets for GitHub publish…" });
    const result = await publishAtlasAssets(assetIds, brandId);
    send({ status: "done", result });
  } catch (err) {
    send({ status: "error", reason: err instanceof Error ? err.message : "Publish failed" });
  } finally {
    res.end();
  }
});

// ── PATCH /api/atlas/brands/:brandId/style-lock ───────────────────────────────
atlasRouter.patch("/brands/:brandId/style-lock", async (req, res) => {
  const brandId = Number(req.params.brandId);
  const styleLock = req.body?.styleLock;
  if (!styleLock || typeof styleLock !== "object") {
    return res.status(400).json({ error: "styleLock object is required" });
  }
  try {
    await updateStyleLock(brandId, styleLock);
    return res.json({ brandId, updated: true });
  } catch (err) {
    console.error(`[atlas/style-lock] ${brandId}`, err);
    return res.status(500).json({ error: "Failed to update style lock" });
  }
});

// ── DELETE /api/atlas/:assetId ────────────────────────────────────────────────
atlasRouter.delete("/:assetId", async (req, res) => {
  const assetId = param(req.params.assetId);
  try {
    await clearAtlasAsset(assetId);
    return res.json({ assetId, cleared: true });
  } catch (err) {
    console.error(`[atlas/delete] ${assetId}`, err);
    return res.status(500).json({ error: "Failed to clear asset" });
  }
});
