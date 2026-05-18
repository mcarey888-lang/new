import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const seededTrails = pgTable("seeded_trails", {
  id: text("id").primaryKey(),
  osmId: text("osm_id"),
  name: text("name").notNull(),
  location: text("location").notNull(),
  distance: real("distance").notNull(),
  elevationGain: integer("elevation_gain").notNull().default(0),
  estimatedTime: text("estimated_time").notNull(),
  difficulty: text("difficulty").notNull(),
  terrain: text("terrain").notNull(),
  routeType: text("route_type").notNull(),
  bestFor: text("best_for").array().notNull().default([]),
  description: text("description").notNull(),
  trainingBenefits: text("training_benefits").array().notNull().default([]),
  emoji: text("emoji").notNull().default("🥾"),
  lat: real("lat"),
  lng: real("lng"),
  osmArea: text("osm_area"),
  seededAt: timestamp("seeded_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSeededTrailSchema = createInsertSchema(seededTrails).omit({
  seededAt: true,
});

export type SeededTrail = typeof seededTrails.$inferSelect;
export type InsertSeededTrail = z.infer<typeof insertSeededTrailSchema>;
