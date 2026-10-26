import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { canUseExpedition } from "@workspace/membership";
import { verifiedMembership } from "../services/membershipAccess";

export function requireMembership(feature: "training" | "expedition", catalogueId?: string): RequestHandler {
  return async (req, res, next) => {
    const userId = getAuth(req).userId;
    if (!userId) { res.status(401).json({ error: "Sign in is required" }); return; }
    try {
      const access = await verifiedMembership(userId);
      if (!(feature === "training" ? access.training : canUseExpedition(access, catalogueId))) {
        res.status(403).json({ error: "Membership required", code: "MEMBERSHIP_REQUIRED", tier: feature === "training" ? "pro" : "expeditions" });
        return;
      }
      next();
    } catch {
      res.status(503).json({ error: "Membership could not be verified. Please retry.", code: "MEMBERSHIP_UNAVAILABLE" });
    }
  };
}
