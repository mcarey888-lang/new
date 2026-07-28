import {
  pgTable,
  serial,
  text,
  integer,
  smallint,
  real,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Virtual Expeditions (one per target mountain) ────────────────────────────
export const virtualExpeditions = pgTable("virtual_expeditions", {
  id:                    serial("id").primaryKey(),
  mountainSlug:          text("mountain_slug").notNull().unique(),
  spreadsheetMountainId: text("spreadsheet_mountain_id").notNull().unique(),
  name:                  text("name").notNull(),
  countryRegion:         text("country_region"),
  continent:             text("continent"),
  summitAltitudeM:       integer("summit_altitude_m"),
  category:              text("category"),
  primaryGoal:           text("primary_goal"),
  altitudeRisk:          smallint("altitude_risk"),
  maxTechnicality:       smallint("max_technicality"),
  heroImageUrl:          text("hero_image_url"),
  shortDescription:      text("short_description"),
  status:                text("status").notNull().default("active"),
  featured:              boolean("featured").notNull().default(false),
  estimatedTrainingWeeks: smallint("estimated_training_weeks"),
  sourceUrl:             text("source_url"),
  createdAt:             timestamp("created_at",  { withTimezone: true }).defaultNow().notNull(),
  updatedAt:             timestamp("updated_at",  { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  check("chk_virtual_expeditions_status",          sql`${t.status} IN ('active','draft','hidden')`),
  check("chk_virtual_expeditions_altitude_risk",   sql`${t.altitudeRisk} IS NULL OR (${t.altitudeRisk} BETWEEN 1 AND 5)`),
  check("chk_virtual_expeditions_technicality",    sql`${t.maxTechnicality} IS NULL OR (${t.maxTechnicality} BETWEEN 1 AND 5)`),
]);

// ── Expedition Routes (global named routes, one or more per mountain) ─────────
export const expeditionRoutes = pgTable("expedition_routes", {
  id:                  serial("id").primaryKey(),
  virtualExpeditionId: integer("virtual_expedition_id").notNull().references(() => virtualExpeditions.id),
  spreadsheetRouteId:  text("spreadsheet_route_id").notNull().unique(),
  routeName:           text("route_name").notNull(),
  startPoint:          text("start_point"),
  finishPoint:         text("finish_point"),
  distanceKm:          real("distance_km"),
  ascentM:             real("ascent_m"),
  descentM:            real("descent_m"),
  typicalDays:         real("typical_days"),
  longestContinuousClimbM: real("longest_continuous_climb_m"),
  avgGradientPct:      real("avg_gradient_pct"),
  maxGradientPct:      real("max_gradient_pct"),
  trailPct:            real("trail_pct"),
  rockPct:             real("rock_pct"),
  screePct:            real("scree_pct"),
  snowIcePct:          real("snow_ice_pct"),
  glacierPct:          real("glacier_pct"),
  scramblingPct:       real("scrambling_pct"),
  viaFerrataPct:       real("via_ferrata_pct"),
  exposure15:          smallint("exposure_1_5"),
  navigation15:        smallint("navigation_1_5"),
  endurance15:         smallint("endurance_1_5"),
  loadCarry15:         smallint("load_carry_1_5"),
  technicality15:      smallint("technicality_1_5"),
  altitude15:          smallint("altitude_1_5"),
  bestSeason:          text("best_season"),
  popularity:          text("popularity"),
  sourceUrl:           text("source_url"),
  dataConfidence:      text("data_confidence").notNull().default("Estimated"),
  active:              boolean("active").notNull().default(true),
  createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:           timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  check("chk_expedition_routes_confidence",  sql`${t.dataConfidence} IN ('Estimated','Verified','GPX_Verified')`),
  check("chk_expedition_routes_exposure",    sql`${t.exposure15}    IS NULL OR (${t.exposure15}    BETWEEN 1 AND 5)`),
  check("chk_expedition_routes_navigation",  sql`${t.navigation15}  IS NULL OR (${t.navigation15}  BETWEEN 1 AND 5)`),
  check("chk_expedition_routes_endurance",   sql`${t.endurance15}   IS NULL OR (${t.endurance15}   BETWEEN 1 AND 5)`),
  check("chk_expedition_routes_load_carry",  sql`${t.loadCarry15}   IS NULL OR (${t.loadCarry15}   BETWEEN 1 AND 5)`),
  check("chk_expedition_routes_technicality",sql`${t.technicality15} IS NULL OR (${t.technicality15} BETWEEN 1 AND 5)`),
  check("chk_expedition_routes_altitude",    sql`${t.altitude15}    IS NULL OR (${t.altitude15}    BETWEEN 1 AND 5)`),
]);

// ── UK Training Routes (routes UK hikers can do) ─────────────────────────────
export const trainingRoutes = pgTable("training_routes", {
  id:                  serial("id").primaryKey(),
  spreadsheetRouteId:  text("spreadsheet_route_id").notNull().unique(),
  region:              text("region").notNull(),
  mountainHill:        text("mountain_hill").notNull(),
  routeName:           text("route_name").notNull(),
  distanceKm:          real("distance_km"),
  ascentM:             real("ascent_m"),
  descentM:            real("descent_m"),
  typicalHours:        real("typical_hours"),
  longestContinuousClimbM: real("longest_continuous_climb_m"),
  avgGradientPct:      real("avg_gradient_pct"),
  maxGradientPct:      real("max_gradient_pct"),
  trailPct:            real("trail_pct"),
  rockPct:             real("rock_pct"),
  screePct:            real("scree_pct"),
  snowIcePct:          real("snow_ice_pct"),
  scramblingPct:       real("scrambling_pct"),
  viaFerrataPct:       real("via_ferrata_pct"),
  exposure15:          smallint("exposure_1_5"),
  navigation15:        smallint("navigation_1_5"),
  endurance15:         smallint("endurance_1_5"),
  loadCarry15:         smallint("load_carry_1_5"),
  technicality15:      smallint("technicality_1_5"),
  bestSeason:          text("best_season"),
  routeType:           text("route_type"),
  popularity:          text("popularity"),
  sourceUrl:           text("source_url"),
  dataConfidence:      text("data_confidence").notNull().default("Estimated"),
  latitude:            real("latitude"),
  longitude:           real("longitude"),
  gpxUrl:              text("gpx_url"),
  verified:            boolean("verified").notNull().default(false),
  active:              boolean("active").notNull().default(true),
  createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:           timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  check("chk_training_routes_confidence",   sql`${t.dataConfidence} IN ('Estimated','Verified','GPX_Verified')`),
  check("chk_training_routes_exposure",     sql`${t.exposure15}    IS NULL OR (${t.exposure15}    BETWEEN 1 AND 5)`),
  check("chk_training_routes_navigation",   sql`${t.navigation15}  IS NULL OR (${t.navigation15}  BETWEEN 1 AND 5)`),
  check("chk_training_routes_endurance",    sql`${t.endurance15}   IS NULL OR (${t.endurance15}   BETWEEN 1 AND 5)`),
  check("chk_training_routes_load_carry",   sql`${t.loadCarry15}   IS NULL OR (${t.loadCarry15}   BETWEEN 1 AND 5)`),
  check("chk_training_routes_technicality", sql`${t.technicality15} IS NULL OR (${t.technicality15} BETWEEN 1 AND 5)`),
]);

// ── Route DNA (12-dimension scores per route, versioned) ─────────────────────
export const routeDna = pgTable("route_dna", {
  id:                       serial("id").primaryKey(),
  expeditionRouteId:        integer("expedition_route_id").references(() => expeditionRoutes.id),
  trainingRouteId:          integer("training_route_id").references(() => trainingRoutes.id),
  sustainedClimbingScore:   smallint("sustained_climbing_score"),
  steepnessScore:           smallint("steepness_score"),
  longDurationEnduranceScore: smallint("long_duration_endurance_score"),
  rockyTerrainScore:        smallint("rocky_terrain_score"),
  looseTerrainScore:        smallint("loose_terrain_score"),
  scramblingScore:          smallint("scrambling_score"),
  exposureScore:            smallint("exposure_score"),
  navigationScore:          smallint("navigation_score"),
  technicalMovementScore:   smallint("technical_movement_score"),
  loadCarryingScore:        smallint("load_carrying_score"),
  altitudeDemandScore:      smallint("altitude_demand_score"),
  recoveryDemandScore:      smallint("recovery_demand_score"),
  overallDifficultyScore:   smallint("overall_difficulty_score"),
  calculationVersion:       smallint("calculation_version").notNull().default(1),
  calculatedAt:             timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  // Exactly one of expedition_route_id / training_route_id must be non-null
  check("chk_route_dna_exclusive",
    sql`(${t.expeditionRouteId} IS NULL) != (${t.trainingRouteId} IS NULL)`
  ),
  // Partial unique indexes: one DNA record per (route, version)
  uniqueIndex("idx_route_dna_expedition_version_uniq")
    .on(t.expeditionRouteId, t.calculationVersion)
    .where(sql`expedition_route_id IS NOT NULL`),
  uniqueIndex("idx_route_dna_training_version_uniq")
    .on(t.trainingRouteId, t.calculationVersion)
    .where(sql`training_route_id IS NOT NULL`),
  // Score range checks (all 0–100)
  check("chk_route_dna_sustained",  sql`${t.sustainedClimbingScore}      IS NULL OR (${t.sustainedClimbingScore}      BETWEEN 0 AND 100)`),
  check("chk_route_dna_steepness",  sql`${t.steepnessScore}              IS NULL OR (${t.steepnessScore}              BETWEEN 0 AND 100)`),
  check("chk_route_dna_endurance",  sql`${t.longDurationEnduranceScore}  IS NULL OR (${t.longDurationEnduranceScore}  BETWEEN 0 AND 100)`),
  check("chk_route_dna_rocky",      sql`${t.rockyTerrainScore}           IS NULL OR (${t.rockyTerrainScore}           BETWEEN 0 AND 100)`),
  check("chk_route_dna_loose",      sql`${t.looseTerrainScore}           IS NULL OR (${t.looseTerrainScore}           BETWEEN 0 AND 100)`),
  check("chk_route_dna_scrambling", sql`${t.scramblingScore}             IS NULL OR (${t.scramblingScore}             BETWEEN 0 AND 100)`),
  check("chk_route_dna_exposure",   sql`${t.exposureScore}               IS NULL OR (${t.exposureScore}               BETWEEN 0 AND 100)`),
  check("chk_route_dna_navigation", sql`${t.navigationScore}             IS NULL OR (${t.navigationScore}             BETWEEN 0 AND 100)`),
  check("chk_route_dna_technical",  sql`${t.technicalMovementScore}      IS NULL OR (${t.technicalMovementScore}      BETWEEN 0 AND 100)`),
  check("chk_route_dna_load",       sql`${t.loadCarryingScore}           IS NULL OR (${t.loadCarryingScore}           BETWEEN 0 AND 100)`),
  check("chk_route_dna_altitude",   sql`${t.altitudeDemandScore}         IS NULL OR (${t.altitudeDemandScore}         BETWEEN 0 AND 100)`),
  check("chk_route_dna_recovery",   sql`${t.recoveryDemandScore}         IS NULL OR (${t.recoveryDemandScore}         BETWEEN 0 AND 100)`),
  check("chk_route_dna_overall",    sql`${t.overallDifficultyScore}      IS NULL OR (${t.overallDifficultyScore}      BETWEEN 0 AND 100)`),
]);

// ── Match Weights (from spreadsheet Match_Weights sheet, stored in DB) ────────
export const matchWeights = pgTable("match_weights", {
  id:          serial("id").primaryKey(),
  metric:      text("metric").notNull(),
  weight:      real("weight").notNull(),
  description: text("description"),
  version:     smallint("version").notNull().default(1),
  active:      boolean("active").notNull().default(true),
}, (t) => [
  uniqueIndex("idx_match_weights_metric_version_uniq").on(t.metric, t.version),
  check("chk_match_weights_weight", sql`${t.weight} >= 0 AND ${t.weight} <= 1`),
]);

// ── Route Matches (expedition route × training route, scored) ─────────────────
export const routeMatches = pgTable("route_matches", {
  id:                    serial("id").primaryKey(),
  expeditionRouteId:     integer("expedition_route_id").notNull().references(() => expeditionRoutes.id),
  trainingRouteId:       integer("training_route_id").notNull().references(() => trainingRoutes.id),
  score:                 real("score").notNull(),
  matchReasons:          jsonb("match_reasons").notNull().default([]),
  warnings:              jsonb("warnings").notNull().default([]),
  spreadsheetMatchScore: real("spreadsheet_match_score"),
  spreadsheetMatchReason: text("spreadsheet_match_reason"),
  algorithmVersion:      smallint("algorithm_version").notNull().default(1),
  calculatedAt:          timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("idx_route_matches_expedition_training_version_uniq")
    .on(t.expeditionRouteId, t.trainingRouteId, t.algorithmVersion),
  check("chk_route_matches_score", sql`${t.score} >= 0 AND ${t.score} <= 100`),
]);

// ── Import Review Queue (uncertain matches waiting for human review) ───────────
export const importReviewItems = pgTable("import_review_items", {
  id:              serial("id").primaryKey(),
  importType:      text("import_type").notNull(),
  sourceId:        text("source_id").notNull(),
  sourceName:      text("source_name"),
  proposedMatchId: text("proposed_match_id"),
  issue:           text("issue").notNull(),
  rawSourceData:   jsonb("raw_source_data").notNull(),
  status:          text("status").notNull().default("pending"),
  resolvedBy:      text("resolved_by"),
  resolvedAt:      timestamp("resolved_at", { withTimezone: true }),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  check("chk_import_review_type",   sql`${t.importType} IN ('mountain','route','match')`),
  check("chk_import_review_status", sql`${t.status} IN ('pending','resolved','dismissed')`),
]);

// ── Type exports ──────────────────────────────────────────────────────────────
export type VirtualExpedition       = typeof virtualExpeditions.$inferSelect;
export type InsertVirtualExpedition = typeof virtualExpeditions.$inferInsert;
export type ExpeditionRoute         = typeof expeditionRoutes.$inferSelect;
export type InsertExpeditionRoute   = typeof expeditionRoutes.$inferInsert;
export type TrainingRoute           = typeof trainingRoutes.$inferSelect;
export type InsertTrainingRoute     = typeof trainingRoutes.$inferInsert;
export type RouteDna                = typeof routeDna.$inferSelect;
export type InsertRouteDna          = typeof routeDna.$inferInsert;
export type MatchWeight             = typeof matchWeights.$inferSelect;
export type InsertMatchWeight       = typeof matchWeights.$inferInsert;
export type RouteMatch              = typeof routeMatches.$inferSelect;
export type InsertRouteMatch        = typeof routeMatches.$inferInsert;
export type ImportReviewItem        = typeof importReviewItems.$inferSelect;
export type InsertImportReviewItem  = typeof importReviewItems.$inferInsert;
