/**
 * Admin session routes
 *
 * POST /api/admin/login   — verify password server-side, return session token
 * GET  /api/admin/me      — verify an existing token; used by frontend guards
 *
 * The session token is the ADMIN_API_KEY itself, returned after server-side
 * verification. Frontends store it in sessionStorage and forward it as
 * Authorization: Bearer <token> on every subsequent admin request.
 */

import { Router } from "express";
import { requireAdminAuth } from "../middlewares/requireAdminAuth.js";

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

  // Return the key as the session token — protected by TLS in transit,
  // stored in sessionStorage (not localStorage) on the client.
  return res.json({ token: adminApiKey });
});

// ── GET /api/admin/me ─────────────────────────────────────────────────────────
// Frontend guards call this on mount to check whether their stored token is
// still valid. Returns 200 + identity on success, 401/403 on failure.
adminRouter.get("/me", requireAdminAuth(), (req, res) => {
  return res.json({ ok: true, identity: res.locals.adminIdentity });
});
