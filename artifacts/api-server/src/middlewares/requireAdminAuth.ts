/**
 * Server-side admin authentication middleware.
 *
 * Accepts ONE of two credential forms on every request:
 *   1. Authorization: Bearer <signed-session-token>
 *      Token is issued by POST /api/admin/login; verified via HMAC-SHA256 against
 *      ADMIN_API_KEY; expires after 24 hours. The raw key is never transmitted.
 *   2. Authorization: Bearer <Clerk JWT>  (future)
 *      Requires userId present in the users table with is_admin = true.
 *
 * Returns:
 *   401  — no / invalid / expired token
 *   403  — valid Clerk token but user is not an admin
 *   next — admin verified; res.locals.adminIdentity is set for audit logging
 *
 * ADMIN_AUTH_DEV_BYPASS=true skips all checks in local development.
 * Never set this in staging or production.
 */

import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdminSessionToken } from "../lib/adminSessionToken.js";

export function requireAdminAuth(): RequestHandler {
  // Opt-in dev bypass — must be explicitly set; never inferred from key format
  if (process.env.ADMIN_AUTH_DEV_BYPASS === "true") {
    console.warn(
      "[requireAdminAuth] ⚠️  ADMIN_AUTH_DEV_BYPASS=true — all admin endpoints are OPEN. " +
      "Never enable this in staging or production."
    );
    return (_req, res, next) => {
      res.locals.adminIdentity = "dev-bypass";
      next();
    };
  }

  return async (req, res, next) => {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      res.status(401).json({ error: "Unauthorized — admin credentials required" });
      return;
    }

    // ── Path 1: Signed admin session token ────────────────────────────────────
    const adminApiKey = process.env.ADMIN_API_KEY;
    if (adminApiKey && verifyAdminSessionToken(token, adminApiKey)) {
      res.locals.adminIdentity = "admin-api-key";
      next();
      return;
    }

    // ── Path 2: Clerk JWT + is_admin flag ─────────────────────────────────────
    // clerkMiddleware() in app.ts has already parsed and verified the JWT;
    // getAuth() reads the result without another network call.
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized — valid admin credentials required" });
      return;
    }

    try {
      const [user] = await db
        .select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.clerkUserId, userId))
        .limit(1);

      if (!user?.isAdmin) {
        res.status(403).json({ error: "Forbidden — admin role required" });
        return;
      }

      res.locals.adminIdentity = userId;
      next();
    } catch (err) {
      req.log?.error({ err }, "[requireAdminAuth] DB lookup failed");
      res.status(500).json({ error: "Auth check failed" });
    }
  };
}
