import type { NextFunction, Request, Response } from "express";

/**
 * Shared server-side guard for privileged internal API operations.
 *
 * This intentionally preserves the Virtual Expedition Engine's existing
 * request header so every internal admin API uses one authorization mechanism.
 * ADMIN_API_KEY is the shared deployment secret; the older Virtual Engine
 * variable remains supported for backwards compatibility.
 */
export function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const providedRaw = req.headers["x-vx-admin-key"];
  const providedEncoded = req.headers["x-vx-admin-key-b64"];
  let provided = providedRaw;
  if (!provided && typeof providedEncoded === "string") {
    try {
      provided = Buffer.from(providedEncoded, "base64").toString("utf8");
    } catch {
      provided = undefined;
    }
  }
  const expected = process.env.ADMIN_API_KEY ?? process.env.VIRTUAL_ENGINE_ADMIN_KEY;

  if (!expected) {
    res.status(503).json({ error: "Admin API key not configured on server" });
    return;
  }

  if (!provided || provided !== expected) {
    res.status(401).json({ error: "Unauthorized — valid admin key required" });
    return;
  }

  next();
}