import { pgTable, text, boolean, serial, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Per-user admin role table.
 * Admin access is granted by inserting a row with is_admin = true.
 * Keyed by Clerk user ID so access can be revoked per person.
 */
export const users = pgTable("users", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  isAdmin:     boolean("is_admin").notNull().default(false),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Immutable audit log for privileged admin actions.
 * Records who performed each action, what they did, and when.
 * adminIdentity is either a Clerk user ID or "admin-api-key" for API-key sessions.
 */
export const adminAuditLog = pgTable("admin_audit_log", {
  id:            serial("id").primaryKey(),
  adminIdentity: text("admin_identity").notNull(),
  action:        text("action").notNull(),        // e.g. "approve_hill_session"
  resourceId:    text("resource_id"),             // e.g. session id, challengeId, assetId
  metadata:      jsonb("metadata"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AdminAuditLogInsert = typeof adminAuditLog.$inferInsert;
