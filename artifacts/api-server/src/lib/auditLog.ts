/**
 * Lightweight helper for inserting admin audit log rows.
 * Fire-and-forget: errors are logged but never thrown to the caller.
 */

import { db } from "@workspace/db";
import { adminAuditLog } from "@workspace/db/schema";
import { logger } from "./logger.js";

export async function writeAuditLog(
  adminIdentity: string,
  action: string,
  resourceId?: string | number | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(adminAuditLog).values({
      adminIdentity,
      action,
      resourceId: resourceId != null ? String(resourceId) : null,
      metadata: metadata ?? null,
    });
  } catch (err) {
    logger.error({ err, adminIdentity, action, resourceId }, "[auditLog] Failed to write audit row");
  }
}
