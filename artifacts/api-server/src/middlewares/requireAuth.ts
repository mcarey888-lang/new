/**
 * Clerk authentication enforcement middleware.
 *
 * Wraps @clerk/express requireAuth() and only enforces in production
 * (when CLERK_SECRET_KEY starts with sk_live_). In dev/test the middleware
 * is a no-op so local development isn't blocked.
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
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey?.startsWith("sk_live_")) {
    return (_req, _res, next) => next();
  }
  return clerkRequireAuth() as unknown as RequestHandler;
}
