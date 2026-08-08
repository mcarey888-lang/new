/**
 * Admin session routes
 *
 * POST /api/admin/login   — verify password server-side, return a signed expiring token
 * GET  /api/admin/me      — verify an existing token; used by frontend guards on mount
 *
 * Session tokens are HMAC-SHA256 signed and expire after 24 hours.
 * The raw ADMIN_API_KEY is never returned to the client — only the opaque token.
 */

import { Router } from "express";
import { requireAdminAuth } from "../middlewares/requireAdminAuth.js";
import { buildAdminSessionToken } from "../lib/adminSessionToken.js";

export const adminRouter = Router();

// ── POST /api/admin/login ─────────────────────────────────────────────────────
adminRouter.post("/login", (req, res) => {
  const { password } = req.body ?? {};

  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "password is required" });
  }

  const adminApiKey = process.env.ADMIN_API_KEY;
  if (!adminApiKey) {
    return res.status(503).json({ error: "ADMIN_API_KEY not configured on server" });
  }

  if (password !== adminApiKey) {
    return res.status(401).json({ error: "Incorrect access key" });
  }

  // Return a signed, expiring opaque token. The raw ADMIN_API_KEY is NOT returned.
  const token = buildAdminSessionToken(adminApiKey);
  return res.json({ token });
});

// ── GET /api/admin/me ─────────────────────────────────────────────────────────
// Frontend guards call this on mount to confirm their stored token is still valid.
adminRouter.get("/me", requireAdminAuth(), (req, res) => {
  return res.json({ ok: true, identity: res.locals.adminIdentity });
});
