/**
 * Clerk authentication enforcement middleware.
 *
 * Wraps @clerk/express requireAuth() and enforces Clerk auth on every call.
 *
 * Dev/test bypass: set ADMIN_AUTH_DEV_BYPASS=true in your local .env.
 * Never set this in staging or production — it opens all protected routes.
 *
 * Usage:
 *   router.use(requireAuth());          // protect an entire sub-router
 *   router.delete("/foo", requireAuth(), handler); // protect a single route
 *
 * After requireAuth() passes, the verified userId is available via:
 *   import { getAuth } from "@clerk/express";
 *   const { userId } = getAuth(req);
 */

import { requireAuth as clerkRequireAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export function requireAuth(): RequestHandler {
  if (process.env.ADMIN_AUTH_DEV_BYPASS === "true") {
    console.warn(
      "[requireAuth] ⚠️  ADMIN_AUTH_DEV_BYPASS=true — Clerk auth is DISABLED. " +
      "Never enable this in staging or production."
    );
    return (_req, _res, next) => next();
  }
  return clerkRequireAuth() as unknown as RequestHandler;
}
