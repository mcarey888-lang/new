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
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { requireAdminAuth } from "../middlewares/requireAdminAuth.js";
import { buildAdminSessionToken } from "../lib/adminSessionToken.js";

export const adminRouter = Router();

/**
 * Brute-force guard for the login endpoint.
 *
 * Counts only FAILED attempts (skipSuccessfulRequests: true).
 * After 5 failures from the same IP (or IPv6 /56 subnet) within 15 minutes
 * the endpoint returns 429 with standard RateLimit-* headers.
 *
 * Important: skipSuccessfulRequests prevents successful logins from being
 * counted against the limit, but does NOT reset or bypass the counter once the
 * limit is already reached.  A blocked IP must wait for the window to expire.
 *
 * ipKeyGenerator (from express-rate-limit) is used instead of raw req.ip so
 * that IPv6 clients within the same /56 subnet share a single counter and
 * cannot bypass the limit by cycling through addresses in their range.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60_000,       // 15-minute sliding window
  max: 5,                       // max failed attempts per window per IP/subnet
  skipSuccessfulRequests: true, // only count failures toward the limit
  standardHeaders: true,        // emit RateLimit-* headers (RFC 6585)
  legacyHeaders: false,
  message: { error: "Too many failed login attempts. Please wait 15 minutes and try again." },
  keyGenerator: (req) => {
    // ipKeyGenerator normalises IPv4-mapped IPv6 addresses and groups IPv6
    // clients by /56 subnet, preventing address-rotation bypass attacks.
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    return ipKeyGenerator(ip);
  },
});

// ── POST /api/admin/login ─────────────────────────────────────────────────────
adminRouter.post("/login", loginRateLimiter, (req, res) => {
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
