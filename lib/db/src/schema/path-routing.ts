import { pgTable, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

// Reusable routing results, not saved plans, activities or evidence. No owner,
// account, draft name or raw provider response is stored here.
export const pathRoutingCacheTable = pgTable("path_routing_cache", {
  key: text("key").primaryKey(),
  result: jsonb("result").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("path_routing_cache_expiry_idx").on(table.expiresAt)]);

export const pathRoutingUsageTable = pgTable("path_routing_usage", {
  bucket: text("bucket").primaryKey(),
  requests: integer("requests").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
