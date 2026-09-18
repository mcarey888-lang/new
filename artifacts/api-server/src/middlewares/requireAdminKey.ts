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
  const provided = req.headers["x-vx-admin-key"];
  const expected = process.env.VIRTUAL_ENGINE_ADMIN_KEY ?? process.env.ADMIN_API_KEY;

  if (!expected) {
    res.status(503).json({ error: "Admin API key not configured on server" });
    return;
  }

  if (!provided || provided !== expected) {
    res.status(401).json({ error: "Unauthorized — x-vx-admin-key header required" });
    return;
  }

  next();
}