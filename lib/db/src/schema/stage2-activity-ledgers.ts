import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { canonicalActivities } from "./canonical-activities";

export const personalElevationCreditEvents = pgTable("personal_elevation_credit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  activityId: uuid("activity_id").notNull(),
  revision: integer("revision").notNull().default(1),
  status: text("status").notNull().default("credited"),
  creditedAscentM: integer("credited_ascent_m").notNull(),
  evidenceClass: text("evidence_class").notNull(),
  ruleVersion: text("rule_version").notNull(),
  correctionOfRevision: integer("correction_of_revision"),
  reasonCodes: jsonb("reason_codes").notNull().default([]),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("personal_elevation_credit_events_identity_uidx")
    .on(t.ownerUserId, t.activityId, t.ruleVersion, t.revision),
  uniqueIndex("personal_elevation_credit_events_lineage_uidx")
    .on(t.id, t.ownerUserId, t.activityId, t.ruleVersion, t.revision),
  index("personal_elevation_credit_events_activity_idx").on(t.ownerUserId, t.activityId),
  index("personal_elevation_credit_events_rule_idx").on(t.ownerUserId, t.ruleVersion, t.status),
  foreignKey({
    name: "personal_elevation_credit_events_activity_owner_fk",
    columns: [t.ownerUserId, t.activityId],
    foreignColumns: [canonicalActivities.ownerUserId, canonicalActivities.id],
  }).onDelete("restrict"),
  check("chk_personal_elevation_credit_status", sql`${t.status} IN ('credited', 'revoked', 'corrected')`),
  check("chk_personal_elevation_credit_evidence", sql`${t.evidenceClass} IN ('recorded_unverified', 'quality_accepted', 'verified_activity')`),
  check("chk_personal_elevation_credit_metric", sql`${t.creditedAscentM} >= 0`),
  check("chk_personal_elevation_credit_revision", sql`${t.revision} >= 1`),
  check("chk_personal_elevation_credit_correction", sql`(${t.revision} = 1 AND ${t.correctionOfRevision} IS NULL) OR (${t.revision} > 1 AND ${t.correctionOfRevision} = ${t.revision} - 1)`),
]);

export const expeditionRuns = pgTable("expedition_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  expeditionId: text("expedition_id").notNull(),
  runKey: text("run_key").notNull(),
  ruleVersion: text("rule_version").notNull(),
  scoreVersion: text("score_version").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("expedition_runs_owner_run_uidx").on(t.ownerUserId, t.runKey),
  uniqueIndex("expedition_runs_owner_id_uidx").on(t.ownerUserId, t.id),
  index("expedition_runs_owner_expedition_idx").on(t.ownerUserId, t.expeditionId),
  check("chk_expedition_run_status", sql`${t.status} IN ('active', 'completed', 'revoked')`),
]);

export const expeditionStageContributions = pgTable("expedition_stage_contributions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  runId: uuid("run_id").notNull(),
  stageKey: text("stage_key").notNull(),
  activityId: uuid("activity_id").notNull(),
  revision: integer("revision").notNull().default(1),
  status: text("status").notNull().default("accepted"),
  acceptedMetric: integer("accepted_metric").notNull(),
  acceptedElevationM: integer("accepted_elevation_m"),
  ruleVersion: text("rule_version").notNull(),
  scoreVersion: text("score_version").notNull(),
  simulatedCompletion: boolean("simulated_completion").notNull().default(true),
  correctionOfRevision: integer("correction_of_revision"),
  reasonCodes: jsonb("reason_codes").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("expedition_stage_contributions_identity_uidx")
    .on(t.ownerUserId, t.runId, t.stageKey, t.activityId, t.ruleVersion, t.scoreVersion, t.revision),
  uniqueIndex("expedition_stage_contributions_lineage_uidx")
    .on(t.id, t.ownerUserId, t.runId, t.stageKey, t.activityId, t.ruleVersion, t.scoreVersion, t.revision),
  index("expedition_stage_contributions_run_stage_idx").on(t.ownerUserId, t.runId, t.stageKey),
  index("expedition_stage_contributions_activity_idx").on(t.ownerUserId, t.activityId),
  foreignKey({
    name: "expedition_stage_contributions_run_owner_fk",
    columns: [t.ownerUserId, t.runId],
    foreignColumns: [expeditionRuns.ownerUserId, expeditionRuns.id],
  }).onDelete("restrict"),
  foreignKey({
    name: "expedition_stage_contributions_activity_owner_fk",
    columns: [t.ownerUserId, t.activityId],
    foreignColumns: [canonicalActivities.ownerUserId, canonicalActivities.id],
  }).onDelete("restrict"),
  check("chk_expedition_contribution_status", sql`${t.status} IN ('accepted', 'revoked', 'corrected')`),
  check("chk_expedition_contribution_metric", sql`${t.acceptedMetric} >= 0`),
  check("chk_expedition_contribution_elevation", sql`${t.acceptedElevationM} IS NULL OR ${t.acceptedElevationM} >= 0`),
  check("chk_expedition_contribution_simulated", sql`${t.simulatedCompletion} = TRUE`),
  check("chk_expedition_contribution_revision", sql`${t.revision} >= 1`),
  check("chk_expedition_contribution_correction", sql`(${t.revision} = 1 AND ${t.correctionOfRevision} IS NULL) OR (${t.revision} > 1 AND ${t.correctionOfRevision} = ${t.revision} - 1)`),
]);

// Append-only lineage rows provide referential integrity for corrections/revocations
// without making the event table recursively self-referential in Drizzle's type graph.
export const personalElevationCreditCorrections = pgTable("personal_elevation_credit_corrections", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  activityId: uuid("activity_id").notNull(),
  ruleVersion: text("rule_version").notNull(),
  revision: integer("revision").notNull(),
  priorRevision: integer("prior_revision").notNull(),
  eventId: uuid("event_id").notNull(),
  priorEventId: uuid("prior_event_id").notNull(),
}, (t) => [
  uniqueIndex("personal_elevation_credit_corrections_uidx").on(t.eventId, t.priorEventId),
  foreignKey({
    name: "personal_elevation_credit_corrections_current_owner_fk",
    columns: [t.eventId, t.ownerUserId, t.activityId, t.ruleVersion, t.revision],
    foreignColumns: [
      personalElevationCreditEvents.id,
      personalElevationCreditEvents.ownerUserId,
      personalElevationCreditEvents.activityId,
      personalElevationCreditEvents.ruleVersion,
      personalElevationCreditEvents.revision,
    ],
  }).onDelete("restrict"),
  foreignKey({
    name: "personal_elevation_credit_corrections_prior_owner_fk",
    columns: [t.priorEventId, t.ownerUserId, t.activityId, t.ruleVersion, t.priorRevision],
    foreignColumns: [
      personalElevationCreditEvents.id,
      personalElevationCreditEvents.ownerUserId,
      personalElevationCreditEvents.activityId,
      personalElevationCreditEvents.ruleVersion,
      personalElevationCreditEvents.revision,
    ],
  }).onDelete("restrict"),
  check("chk_personal_elevation_credit_correction_order", sql`${t.revision} = ${t.priorRevision} + 1`),
]);

export const expeditionContributionCorrections = pgTable("expedition_contribution_corrections", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  runId: uuid("run_id").notNull(),
  stageKey: text("stage_key").notNull(),
  activityId: uuid("activity_id").notNull(),
  ruleVersion: text("rule_version").notNull(),
  scoreVersion: text("score_version").notNull(),
  revision: integer("revision").notNull(),
  priorRevision: integer("prior_revision").notNull(),
  contributionId: uuid("contribution_id").notNull(),
  priorContributionId: uuid("prior_contribution_id").notNull(),
}, (t) => [
  uniqueIndex("expedition_contribution_corrections_uidx").on(t.contributionId, t.priorContributionId),
  foreignKey({
    name: "expedition_contribution_corrections_current_owner_fk",
    columns: [t.contributionId, t.ownerUserId, t.runId, t.stageKey, t.activityId, t.ruleVersion, t.scoreVersion, t.revision],
    foreignColumns: [
      expeditionStageContributions.id,
      expeditionStageContributions.ownerUserId,
      expeditionStageContributions.runId,
      expeditionStageContributions.stageKey,
      expeditionStageContributions.activityId,
      expeditionStageContributions.ruleVersion,
      expeditionStageContributions.scoreVersion,
      expeditionStageContributions.revision,
    ],
  }).onDelete("restrict"),
  foreignKey({
    name: "expedition_contribution_corrections_prior_owner_fk",
    columns: [t.priorContributionId, t.ownerUserId, t.runId, t.stageKey, t.activityId, t.ruleVersion, t.scoreVersion, t.priorRevision],
    foreignColumns: [
      expeditionStageContributions.id,
      expeditionStageContributions.ownerUserId,
      expeditionStageContributions.runId,
      expeditionStageContributions.stageKey,
      expeditionStageContributions.activityId,
      expeditionStageContributions.ruleVersion,
      expeditionStageContributions.scoreVersion,
      expeditionStageContributions.revision,
    ],
  }).onDelete("restrict"),
  check("chk_expedition_contribution_correction_order", sql`${t.revision} = ${t.priorRevision} + 1`),
]);

export type PersonalElevationCreditEvent = typeof personalElevationCreditEvents.$inferSelect;
export type ExpeditionRun = typeof expeditionRuns.$inferSelect;
export type ExpeditionStageContribution = typeof expeditionStageContributions.$inferSelect;