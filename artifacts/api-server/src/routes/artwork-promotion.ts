import { Router } from "express";
import { requireAdminKey } from "../middlewares/requireAdminKey.js";
import { PromotionConflict, runArtworkPromotion } from "../services/artwork/artworkPromotion.js";

export const artworkPromotionRouter = Router();
artworkPromotionRouter.use(requireAdminKey);
artworkPromotionRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

artworkPromotionRouter.get("/", async (req, res) => {
  try {
    res.json(await runArtworkPromotion());
  } catch (error) {
    req.log.error({ err: error }, "Artwork promotion preview failed");
    res.status(error instanceof PromotionConflict ? 409 : 503).json({
      error: error instanceof PromotionConflict ? error.message : "Artwork preview unavailable. No changes were made.",
    });
  }
});

artworkPromotionRouter.post("/", async (req, res) => {
  if (req.body?.confirmation !== "IMPORT APPROVED ARTWORK" ||
      req.body?.backupConfirmed !== true ||
      typeof req.body?.planId !== "string" || !/^[a-f0-9]{64}$/.test(req.body.planId)) {
    res.status(400).json({ error: "Preview first, confirm a recovery point and explicitly approve the import." });
    return;
  }
  try {
    const result = await runArtworkPromotion({ planId: req.body.planId });
    req.log.info({ packageId: result.packageId, insertedRecords: result.insertedRecords }, "Approved artwork metadata imported");
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "Artwork promotion failed");
    res.status(error instanceof PromotionConflict ? 409 : 503).json({
      error: error instanceof PromotionConflict ? error.message : "Artwork import failed and was rolled back. Preview again before retrying.",
    });
  }
});
