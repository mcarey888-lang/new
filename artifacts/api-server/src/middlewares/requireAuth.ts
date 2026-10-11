/**
 * Clerk authentication enforcement.
 *
 * This used to enforce only when CLERK_SECRET_KEY began with `sk_live_`, and
 * return a middleware that called next() otherwise. That is fail-open: a
 * production deploy with the key missing, misspelled or mid-rotation would
 * have silently stopped checking anyone, with no error and nothing in the
 * logs to notice. Nothing was exposed in practice, because every handler
 * behind it reads getAuth(req).userId and refuses without one — but that put
 * the whole guarantee on each handler remembering, and a middleware called
 * requireAuth has to be worth its name on its own.
 *
 * Now: a key of any kind means enforce. No key in production means refuse,
 * because an unconfigured gate is a fault, not permission. No key outside
 * production stays a no-op so local work and the test suite are not blocked.
 *
 * Usage:
 *   router.use(requireAuth());          // protect an entire sub-router
 *   router.delete("/foo", requireAuth(), handler); // protect a single route
 *
 * After requireAuth() passes, the verified userId is available via:
 *   import { getAuth } from "@clerk/express";
 *   const { userId } = getAuth(req);
 */

import { getAuth, requireAuth as clerkRequireAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export type AuthMode = "enforce" | "refuse" | "allow_unauthenticated";

/**
 * Decide how to behave, given the environment. Separated so the decision can
 * be tested without standing up Express or Clerk.
 */
export function authMode(env: {
  CLERK_SECRET_KEY?: string | undefined;
  NODE_ENV?: string | undefined;
}): AuthMode {
  /* Any usable key, test or live. A test key still verifies test sessions,
     which is what a preview build sends. */
  if (env.CLERK_SECRET_KEY?.trim()) return "enforce";
  /* No key where it matters. Refusing is loud, and a loud failure gets fixed;
     a quiet one serves strangers' data until somebody notices. */
  if (env.NODE_ENV === "production") return "refuse";
  return "allow_unauthenticated";
}

export function requireAuth(options: { json?: boolean } = {}): RequestHandler {
  switch (authMode(process.env)) {
    case "enforce":
      if (options.json) {
        return (req, res, next) => {
          try {
            // clerkMiddleware has already verified the JWT. Never trust a
            // user ID supplied in the request body or unverified token.
            if (getAuth(req).userId) { next(); return; }
            req.log?.warn({ bearerPresent: /^Bearer\s+\S+/i.test(req.headers.authorization ?? "") },
              "route API authentication rejected");
            res.status(401).json({ error: "Your sign-in could not be verified. Please sign in again to save routes." });
          } catch {
            req.log?.error("Route API authentication could not be checked");
            res.status(503).json({ error: "authentication_unavailable" });
          }
        };
      }
      return clerkRequireAuth() as unknown as RequestHandler;
    case "refuse":
      return (req, res) => {
        req.log?.error("CLERK_SECRET_KEY is not set; refusing authenticated requests");
        res.status(503).json({ error: "authentication_unavailable" });
      };
    case "allow_unauthenticated":
      return (_req, _res, next) => next();
  }
}
