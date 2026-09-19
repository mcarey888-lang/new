-- Stage 2 C07/C08 additive development-only ledgers.
-- Reviewed artifact only: do not apply to production.

CREATE UNIQUE INDEX IF NOT EXISTS "canonical_activities_owner_id_uidx"
  ON "canonical_activities" ("owner_user_id", "id");

CREATE TABLE IF NOT EXISTS "personal_elevation_credit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" text NOT NULL,
  "activity_id" uuid NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'credited' NOT NULL,
  "credited_ascent_m" integer NOT NULL,
  "evidence_class" text NOT NULL,
  "rule_version" text NOT NULL,
  "correction_of_revision" integer,
  "reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "effective_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "personal_elevation_credit_events_activity_owner_fk"
    FOREIGN KEY ("owner_user_id", "activity_id")
    REFERENCES "canonical_activities"("owner_user_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "chk_personal_elevation_credit_status" CHECK ("status" IN ('credited', 'revoked', 'corrected')),
  CONSTRAINT "chk_personal_elevation_credit_evidence" CHECK ("evidence_class" IN ('recorded_unverified', 'quality_accepted', 'verified_activity')),
  CONSTRAINT "chk_personal_elevation_credit_metric" CHECK ("credited_ascent_m" >= 0),
  CONSTRAINT "chk_personal_elevation_credit_revision" CHECK ("revision" >= 1),
  CONSTRAINT "chk_personal_elevation_credit_correction" CHECK (("revision" = 1 AND "correction_of_revision" IS NULL) OR ("revision" > 1 AND "correction_of_revision" = "revision" - 1))
);
CREATE UNIQUE INDEX IF NOT EXISTS "personal_elevation_credit_events_identity_uidx"
  ON "personal_elevation_credit_events" ("owner_user_id", "activity_id", "rule_version", "revision");
CREATE UNIQUE INDEX IF NOT EXISTS "personal_elevation_credit_events_lineage_uidx"
  ON "personal_elevation_credit_events" ("id", "owner_user_id", "activity_id", "rule_version", "revision");
CREATE INDEX IF NOT EXISTS "personal_elevation_credit_events_activity_idx"
  ON "personal_elevation_credit_events" ("owner_user_id", "activity_id");
CREATE INDEX IF NOT EXISTS "personal_elevation_credit_events_rule_idx"
  ON "personal_elevation_credit_events" ("owner_user_id", "rule_version", "status");

CREATE TABLE IF NOT EXISTS "expedition_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" text NOT NULL,
  "expedition_id" text NOT NULL,
  "run_key" text NOT NULL,
  "rule_version" text NOT NULL,
  "score_version" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_expedition_run_status" CHECK ("status" IN ('active', 'completed', 'revoked'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "expedition_runs_owner_run_uidx"
  ON "expedition_runs" ("owner_user_id", "run_key");
CREATE UNIQUE INDEX IF NOT EXISTS "expedition_runs_owner_id_uidx"
  ON "expedition_runs" ("owner_user_id", "id");
CREATE INDEX IF NOT EXISTS "expedition_runs_owner_expedition_idx"
  ON "expedition_runs" ("owner_user_id", "expedition_id");

CREATE TABLE IF NOT EXISTS "expedition_stage_contributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" text NOT NULL,
  "run_id" uuid NOT NULL,
  "stage_key" text NOT NULL,
  "activity_id" uuid NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'accepted' NOT NULL,
  "accepted_metric" integer NOT NULL,
  "accepted_elevation_m" integer,
  "rule_version" text NOT NULL,
  "score_version" text NOT NULL,
  "simulated_completion" boolean DEFAULT true NOT NULL,
  "correction_of_revision" integer,
  "reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "expedition_stage_contributions_run_owner_fk"
    FOREIGN KEY ("owner_user_id", "run_id")
    REFERENCES "expedition_runs"("owner_user_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "expedition_stage_contributions_activity_owner_fk"
    FOREIGN KEY ("owner_user_id", "activity_id")
    REFERENCES "canonical_activities"("owner_user_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "chk_expedition_contribution_status" CHECK ("status" IN ('accepted', 'revoked', 'corrected')),
  CONSTRAINT "chk_expedition_contribution_metric" CHECK ("accepted_metric" >= 0),
  CONSTRAINT "chk_expedition_contribution_elevation" CHECK ("accepted_elevation_m" IS NULL OR "accepted_elevation_m" >= 0),
  CONSTRAINT "chk_expedition_contribution_simulated" CHECK ("simulated_completion" = TRUE),
  CONSTRAINT "chk_expedition_contribution_revision" CHECK ("revision" >= 1),
  CONSTRAINT "chk_expedition_contribution_correction" CHECK (("revision" = 1 AND "correction_of_revision" IS NULL) OR ("revision" > 1 AND "correction_of_revision" = "revision" - 1))
);
CREATE UNIQUE INDEX IF NOT EXISTS "expedition_stage_contributions_identity_uidx"
  ON "expedition_stage_contributions" ("owner_user_id", "run_id", "stage_key", "activity_id", "rule_version", "score_version", "revision");
CREATE UNIQUE INDEX IF NOT EXISTS "expedition_stage_contributions_lineage_uidx"
  ON "expedition_stage_contributions" ("id", "owner_user_id", "run_id", "stage_key", "activity_id", "rule_version", "score_version", "revision");
CREATE INDEX IF NOT EXISTS "expedition_stage_contributions_run_stage_idx"
  ON "expedition_stage_contributions" ("owner_user_id", "run_id", "stage_key");
CREATE INDEX IF NOT EXISTS "expedition_stage_contributions_activity_idx"
  ON "expedition_stage_contributions" ("owner_user_id", "activity_id");

CREATE TABLE IF NOT EXISTS "personal_elevation_credit_corrections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" text NOT NULL,
  "activity_id" uuid NOT NULL,
  "rule_version" text NOT NULL,
  "revision" integer NOT NULL,
  "prior_revision" integer NOT NULL,
  "event_id" uuid NOT NULL,
  "prior_event_id" uuid NOT NULL,
  CONSTRAINT "personal_elevation_credit_corrections_current_owner_fk"
    FOREIGN KEY ("event_id", "owner_user_id", "activity_id", "rule_version", "revision")
    REFERENCES "personal_elevation_credit_events"("id", "owner_user_id", "activity_id", "rule_version", "revision") ON DELETE RESTRICT,
  CONSTRAINT "personal_elevation_credit_corrections_prior_owner_fk"
    FOREIGN KEY ("prior_event_id", "owner_user_id", "activity_id", "rule_version", "prior_revision")
    REFERENCES "personal_elevation_credit_events"("id", "owner_user_id", "activity_id", "rule_version", "revision") ON DELETE RESTRICT,
  CONSTRAINT "chk_personal_elevation_credit_correction_order" CHECK ("revision" = "prior_revision" + 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS "personal_elevation_credit_corrections_uidx"
  ON "personal_elevation_credit_corrections" ("event_id", "prior_event_id");

CREATE TABLE IF NOT EXISTS "expedition_contribution_corrections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" text NOT NULL,
  "run_id" uuid NOT NULL,
  "stage_key" text NOT NULL,
  "activity_id" uuid NOT NULL,
  "rule_version" text NOT NULL,
  "score_version" text NOT NULL,
  "revision" integer NOT NULL,
  "prior_revision" integer NOT NULL,
  "contribution_id" uuid NOT NULL,
  "prior_contribution_id" uuid NOT NULL,
  CONSTRAINT "expedition_contribution_corrections_current_owner_fk"
    FOREIGN KEY ("contribution_id", "owner_user_id", "run_id", "stage_key", "activity_id", "rule_version", "score_version", "revision")
    REFERENCES "expedition_stage_contributions"("id", "owner_user_id", "run_id", "stage_key", "activity_id", "rule_version", "score_version", "revision") ON DELETE RESTRICT,
  CONSTRAINT "expedition_contribution_corrections_prior_owner_fk"
    FOREIGN KEY ("prior_contribution_id", "owner_user_id", "run_id", "stage_key", "activity_id", "rule_version", "score_version", "prior_revision")
    REFERENCES "expedition_stage_contributions"("id", "owner_user_id", "run_id", "stage_key", "activity_id", "rule_version", "score_version", "revision") ON DELETE RESTRICT,
  CONSTRAINT "chk_expedition_contribution_correction_order" CHECK ("revision" = "prior_revision" + 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS "expedition_contribution_corrections_uidx"
  ON "expedition_contribution_corrections" ("contribution_id", "prior_contribution_id");