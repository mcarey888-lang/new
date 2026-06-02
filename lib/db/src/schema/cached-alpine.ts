import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const cachedAlpine = pgTable("cached_alpine", {
  slug: text("slug").primaryKey(),
  data: text("data").notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CachedAlpine = typeof cachedAlpine.$inferSelect;
export type InsertCachedAlpine = typeof cachedAlpine.$inferInsert;
