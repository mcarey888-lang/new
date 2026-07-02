import { pgTable, text, real, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { trackedRoutes } from "./tracked-routes";

export const routeContributions = pgTable("route_contributions", {
  id:               text("id").primaryKey(),
  canonicalRouteId: text("canonical_route_id").notNull().references(() => trackedRoutes.id, { onDelete: "cascade" }),
  trackPoints:      jsonb("track_points").notNull().default([]),
  distanceKm:       real("distance_km").notNull(),
  elevationGain:    integer("elevation_gain").notNull().default(0),
  elevationLoss:    integer("elevation_loss").notNull().default(0),
  durationSecs:     integer("duration_secs").notNull(),
  submittedAt:      timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("route_contributions_canonical_route_id_idx").on(t.canonicalRouteId),
]);

export type RouteContribution = typeof routeContributions.$inferSelect;
