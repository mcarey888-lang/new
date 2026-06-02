import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const cachedMountains = pgTable("cached_mountains", {
  slug: text("slug").primaryKey(),
  data: text("data").notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CachedMountain = typeof cachedMountains.$inferSelect;
export type InsertCachedMountain = typeof cachedMountains.$inferInsert;
