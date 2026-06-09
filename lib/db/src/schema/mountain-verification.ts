import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";

export const mountainVerificationTests = pgTable("mountain_verification_tests", {
  id: serial("id").primaryKey(),
  mountainName: text("mountain_name").notNull(),
  routeName: text("route_name").notNull(),
  distanceKm: real("distance_km"),
  elevationGainM: real("elevation_gain_m"),
  summitElevationM: real("summit_elevation_m"),
  trailheadElevationM: real("trailhead_elevation_m"),
  averageGradient: real("average_gradient"),
  maxGradient: real("max_gradient"),
  confidenceScore: text("confidence_score").notNull().default("LOW"),
  source: text("source"),
  rawRouteGeometry: text("raw_route_geometry"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MountainVerificationTest = typeof mountainVerificationTests.$inferSelect;
export type InsertMountainVerificationTest = typeof mountainVerificationTests.$inferInsert;
