import { pgTable, text, real, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trackedRoutes = pgTable("tracked_routes", {
  id:                text("id").primaryKey(),
  createdBy:         text("created_by"),               // Clerk userId of route creator
  name:              text("name").notNull(),
  location:          text("location").notNull().default("GPS Tracked Route"),
  distanceKm:        real("distance_km").notNull(),
  elevationGain:     integer("elevation_gain").notNull().default(0),
  elevationLoss:     integer("elevation_loss").notNull().default(0),
  durationSecs:      integer("duration_secs").notNull(),
  difficulty:        text("difficulty").notNull().default("Moderate"),
  startLat:          real("start_lat"),
  startLng:          real("start_lng"),
  trackPoints:       jsonb("track_points").notNull().default([]),
  notes:             text("notes").notNull().default(""),
  contributionCount: integer("contribution_count").notNull().default(0),
  submittedAt:       timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("tracked_routes_created_by_idx").on(t.createdBy),
]);

export const insertTrackedRouteSchema = createInsertSchema(trackedRoutes).omit({
  submittedAt: true,
  contributionCount: true,
});

export type TrackedRoute      = typeof trackedRoutes.$inferSelect;
export type InsertTrackedRoute = z.infer<typeof insertTrackedRouteSchema>;
