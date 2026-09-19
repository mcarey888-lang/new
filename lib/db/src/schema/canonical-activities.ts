import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const canonicalActivities = pgTable("canonical_activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  sourceVersion: text("source_version"),
  sourcePayloadHash: text("source_payload_hash").notNull(),
  sourceSnapshot: jsonb("source_snapshot").notNull().default({}),
  primaryContext: text("primary_context").notNull(),
  activityKind: text("activity_kind").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  distanceKm: real("distance_km"),
  recordedAscentM: integer("recorded_ascent_m"),
  validatedAscentM: integer("validated_ascent_m"),
  descentM: integer("descent_m"),
  lifecycle: text("lifecycle").notNull().default("synced"),
  evidenceState: text("evidence_state").notNull().default("recorded_unverified"),
  visibility: text("visibility").notNull().default("private"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("canonical_activities_owner_source_uidx").on(t.ownerUserId, t.sourceType, t.sourceId),
  uniqueIndex("canonical_activities_owner_id_uidx").on(t.ownerUserId, t.id),
  index("canonical_activities_owner_occurred_idx").on(t.ownerUserId, t.occurredAt),
  index("canonical_activities_context_idx").on(t.primaryContext),
  check("chk_canonical_activity_context", sql`${t.primaryContext} IN ('training', 'expedition', 'free_hike', 'mountain_simulation')`),
  check("chk_canonical_activity_lifecycle", sql`${t.lifecycle} IN ('recording', 'completed_local', 'pending_sync', 'synced', 'sync_failed', 'corrected', 'deleted')`),
  check("chk_canonical_activity_evidence", sql`${t.evidenceState} IN ('unverified_manual', 'recorded_unverified', 'quality_accepted', 'verified_activity', 'verified_summit_ascent', 'competition_eligible')`),
  check("chk_canonical_activity_visibility", sql`${t.visibility} IN ('private', 'unlisted', 'public_summary')`),
  check("chk_canonical_activity_duration", sql`${t.durationSeconds} IS NULL OR ${t.durationSeconds} >= 0`),
  check("chk_canonical_activity_distance", sql`${t.distanceKm} IS NULL OR ${t.distanceKm} >= 0`),
  check("chk_canonical_activity_recorded_ascent", sql`${t.recordedAscentM} IS NULL OR ${t.recordedAscentM} >= 0`),
  check("chk_canonical_activity_validated_ascent", sql`${t.validatedAscentM} IS NULL OR ${t.validatedAscentM} >= 0`),
  check("chk_canonical_activity_descent", sql`${t.descentM} IS NULL OR ${t.descentM} >= 0`),
  check("chk_canonical_activity_time_order", sql`${t.startedAt} IS NULL OR ${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`),
]);

export const canonicalActivityEvidence = pgTable("canonical_activity_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  activityId: uuid("activity_id").notNull().references(() => canonicalActivities.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull(),
  evidenceType: text("evidence_type").notNull(),
  payload: jsonb("payload").notNull(),
  visibility: text("visibility").notNull().default("private"),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("canonical_activity_evidence_activity_idx").on(t.activityId),
  index("canonical_activity_evidence_owner_idx").on(t.ownerUserId),
  check("chk_canonical_evidence_visibility", sql`${t.visibility} = 'private'`),
  check("chk_canonical_evidence_type", sql`${t.evidenceType} IN ('gps_track', 'elevation_profile', 'manual_estimate', 'source_snapshot')`),
]);

export const canonicalActivityLinks = pgTable("canonical_activity_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  activityId: uuid("activity_id").notNull().references(() => canonicalActivities.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull(),
  linkType: text("link_type").notNull(),
  targetId: text("target_id").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("canonical_activity_links_unique").on(t.activityId, t.linkType, t.targetId),
  index("canonical_activity_links_target_idx").on(t.linkType, t.targetId),
  check("chk_canonical_activity_link_type", sql`${t.linkType} IN ('training_plan', 'training_session', 'expedition', 'expedition_stage', 'canonical_hill', 'canonical_route', 'community_route', 'challenge')`),
]);

export const canonicalActivityQualifications = pgTable("canonical_activity_qualifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  activityId: uuid("activity_id").notNull().references(() => canonicalActivities.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull(),
  purpose: text("purpose").notNull(),
  status: text("status").notNull().default("pending"),
  evidenceClass: text("evidence_class").notNull(),
  reasonCodes: jsonb("reason_codes").notNull().default([]),
  creditedMetric: integer("credited_metric"),
  ruleVersion: text("rule_version").notNull(),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("canonical_activity_qualifications_unique").on(t.activityId, t.purpose, t.ruleVersion),
  index("canonical_activity_qualifications_purpose_idx").on(t.purpose, t.status),
  check("chk_canonical_qualification_purpose", sql`${t.purpose} IN ('personal_history', 'elevation_bank_personal', 'readiness', 'real_summit_evidence', 'summit_crown', 'leaderboard', 'achievement')`),
  check("chk_canonical_qualification_status", sql`${t.status} IN ('eligible', 'ineligible', 'pending', 'revoked')`),
  check("chk_canonical_qualification_evidence", sql`${t.evidenceClass} IN ('unverified_manual', 'recorded_unverified', 'quality_accepted', 'verified_activity', 'verified_summit_ascent', 'competition_eligible')`),
  check("chk_canonical_qualification_metric", sql`${t.creditedMetric} IS NULL OR ${t.creditedMetric} >= 0`),
]);

export const canonicalActivityConflicts = pgTable("canonical_activity_conflicts", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  activityId: uuid("activity_id").notNull().references(() => canonicalActivities.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  existingPayloadHash: text("existing_payload_hash").notNull(),
  incomingPayloadHash: text("incoming_payload_hash").notNull(),
  conflictType: text("conflict_type").notNull().default("payload_conflict"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("canonical_activity_conflicts_source_idx").on(t.ownerUserId, t.sourceType, t.sourceId),
  check("chk_canonical_activity_conflict_type", sql`${t.conflictType} IN ('payload_conflict', 'owner_collision')`),
]);

export const insertCanonicalActivitySchema = createInsertSchema(canonicalActivities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CanonicalActivity = typeof canonicalActivities.$inferSelect;
export type InsertCanonicalActivity = z.infer<typeof insertCanonicalActivitySchema>;