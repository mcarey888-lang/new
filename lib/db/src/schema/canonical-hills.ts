import { pgTable, text, real, integer, timestamp, jsonb, serial, boolean, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Canonical hill records ───────────────────────────────────────────────────
export const canonicalHills = pgTable("canonical_hills", {
  id:                   serial("id").primaryKey(),
  slug:                 text("slug").notNull().unique(),
  name:                 text("name").notNull(),
  alternativeNames:     jsonb("alternative_names").notNull().default([]),
  country:              text("country"),
  region:               text("region"),
  latitude:             real("latitude"),
  longitude:            real("longitude"),
  summitElevationM:     integer("summit_elevation_m"),
  estimatedGainM:       integer("estimated_gain_m"),
  verifiedGainM:        integer("verified_gain_m"),
  verifiedSampleCount:  integer("verified_sample_count").notNull().default(0),
  confidenceScore:      text("confidence_score").notNull().default("LOW"), // LOW | MEDIUM | HIGH
  source:               text("source").notNull().default("ai"),
  createdAt:            timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  check("chk_canonical_hills_confidence", sql`${t.confidenceScore} IN ('LOW', 'MEDIUM', 'HIGH')`),
  check("chk_canonical_hills_source",     sql`${t.source} IN ('ai', 'overpass')`),
]);

// ── Canonical routes for each hill ──────────────────────────────────────────
export const canonicalHillRoutes = pgTable("canonical_hill_routes", {
  id:                       serial("id").primaryKey(),
  hillId:                   integer("hill_id").notNull().references(() => canonicalHills.id),
  routeSlug:                text("route_slug").notNull(),
  routeName:                text("route_name").notNull(),
  startLatitude:            real("start_latitude"),
  startLongitude:           real("start_longitude"),
  estimatedDistanceKm:      real("estimated_distance_km"),
  estimatedElevationGainM:  integer("estimated_elevation_gain_m"),
  verifiedDistanceKm:       real("verified_distance_km"),
  verifiedElevationGainM:   integer("verified_elevation_gain_m"),
  verifiedSampleCount:      integer("verified_sample_count").notNull().default(0),
  confidenceScore:          text("confidence_score").notNull().default("LOW"),
  routeGeometry:            jsonb("route_geometry"),
  source:                   text("source").notNull().default("ai"),
  createdAt:                timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:                timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  check("chk_canonical_routes_confidence", sql`${t.confidenceScore} IN ('LOW', 'MEDIUM', 'HIGH')`),
  check("chk_canonical_routes_source",     sql`${t.source} IN ('ai', 'overpass')`),
]);

// ── Individual tracked hill sessions from users ──────────────────────────────
export const trackedHillSessions = pgTable("tracked_hill_sessions", {
  id:                     serial("id").primaryKey(),
  userId:                 text("user_id"),
  hillId:                 integer("hill_id"),
  routeId:                integer("route_id"),
  trainingPlanId:         text("training_plan_id"),
  trainingSessionId:      text("training_session_id"),
  plannedHillName:        text("planned_hill_name"),
  plannedRouteName:       text("planned_route_name"),
  targetReps:             integer("target_reps"),
  estimatedGainPerRepM:   integer("estimated_gain_per_rep_m"),
  estimatedTotalGainM:    integer("estimated_total_gain_m"),
  completionType:         text("completion_type").notNull(), // "estimated_manual" | "tracked_gps"
  recordedDistanceKm:     real("recorded_distance_km"),
  recordedElevationGainM: integer("recorded_elevation_gain_m"),
  recordedDurationSeconds:integer("recorded_duration_seconds"),
  highestElevationM:      real("highest_elevation_m"),
  lowestElevationM:       real("lowest_elevation_m"),
  rawGpsTrack:            jsonb("raw_gps_track"),
  elevationProfile:       jsonb("elevation_profile"),
  dataQualityScore:       integer("data_quality_score"),
  matchConfidence:        integer("match_confidence"),
  usedForVerification:    boolean("used_for_verification").notNull().default(false),
  adminApproved:          boolean("admin_approved"),
  createdAt:              timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt:            timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  index("tracked_hill_sessions_user_id_idx").on(t.userId),
  index("tracked_hill_sessions_hill_id_idx").on(t.hillId),
  check("chk_tracked_sessions_completion_type", sql`${t.completionType} IN ('estimated_manual', 'tracked_gps')`),
]);

// ── Aggregated verification stats per hill/route ─────────────────────────────
export const hillVerificationStats = pgTable("hill_verification_stats", {
  id:                     serial("id").primaryKey(),
  hillId:                 integer("hill_id").notNull(),
  routeId:                integer("route_id"),
  sampleCount:            integer("sample_count").notNull().default(0),
  medianDistanceKm:       real("median_distance_km"),
  medianElevationGainM:   integer("median_elevation_gain_m"),
  averageDistanceKm:      real("average_distance_km"),
  averageElevationGainM:  integer("average_elevation_gain_m"),
  minElevationGainM:      integer("min_elevation_gain_m"),
  maxElevationGainM:      integer("max_elevation_gain_m"),
  lastRecalculatedAt:     timestamp("last_recalculated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertTrackedHillSessionSchema = createInsertSchema(trackedHillSessions).omit({
  id: true, createdAt: true,
});

export type CanonicalHill           = typeof canonicalHills.$inferSelect;
export type CanonicalHillRoute      = typeof canonicalHillRoutes.$inferSelect;
export type TrackedHillSession      = typeof trackedHillSessions.$inferSelect;
export type HillVerificationStat    = typeof hillVerificationStats.$inferSelect;
export type InsertTrackedHillSession = z.infer<typeof insertTrackedHillSessionSchema>;
