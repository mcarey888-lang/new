import { Router } from "express";
import { getAuth } from "@clerk/express";
import { MEMBERSHIP, canUseExpedition } from "@workspace/membership";
import { verifiedMembership } from "../services/membershipAccess";

export const membershipRouter = Router();

membershipRouter.get("/membership/access", async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Sign in is required" }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const access = await verifiedMembership(userId, req.query.refresh === "true");
    res.json({ ...access, starterExpeditionId: MEMBERSHIP.starterExpeditionId });
  } catch {
    res.status(503).json({ error: "Membership could not be verified" });
  }
});

membershipRouter.post("/membership/authorize", async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Sign in is required" }); return; }
  const { feature, expeditionId } = req.body ?? {};
  if (!["training", "expedition"].includes(feature) ||
    (feature === "expedition" && (typeof expeditionId !== "string" || !expeditionId.trim()))) {
    res.status(400).json({ error: "A valid feature and catalogue expedition identity are required" }); return;
  }
  try {
    const access = await verifiedMembership(userId, true);
    const allowed = feature === "training" ? access.training : canUseExpedition(access, expeditionId);
    res.status(allowed ? 200 : 403).json({ allowed, tier: access.tier });
  } catch {
    res.status(503).json({ error: "Membership could not be verified" });
  }
});
