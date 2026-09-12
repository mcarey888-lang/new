import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const hillDescriptions = pgTable("hill_descriptions", {
  cacheKey: text("cache_key").primaryKey(),
  summitIdentityKey: text("summit_identity_key"),
  routeIdentityKey: text("route_identity_key"),
  summitName: text("summit_name").notNull(),
  location: text("location"),
  description: text("description").notNull(),
  promptVersion: text("prompt_version").notNull(),
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type HillDescription = typeof hillDescriptions.$inferSelect;
export type InsertHillDescription = typeof hillDescriptions.$inferInsert;