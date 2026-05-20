import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";

export const cachedHills = pgTable("cached_hills", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  elevation: integer("elevation").notNull(),
  distance: real("distance").notNull(),
  repeats: integer("repeats").notNull().default(1),
  totalElevation: integer("total_elevation").notNull(),
  surface: text("surface").notNull().default(""),
  grade: text("grade").notNull().default("Moderate"),
  emoji: text("emoji").notNull().default("⛰️"),
  lat: real("lat"),
  lng: real("lng"),
  routeType: text("route_type"),
  routeDistance: real("route_distance"),
  estimatedTime: text("estimated_time"),
  imageUrl: text("image_url"),
  cachedAt: timestamp("cached_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CachedHill = typeof cachedHills.$inferSelect;
export type InsertCachedHill = typeof cachedHills.$inferInsert;
