-- SummitReady 2.0 Phase 1: additive canonical activity foundation.
-- Development only until a production migration is explicitly approved.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "canonical_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "source_version" text,
  "source_payload_hash" text NOT NULL,
  "source_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "primary_context" text NOT NULL,
  "activity_kind" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "started_at" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "duration_seconds" integer,
  "distance_km" real,
  "recorded_ascent_m" integer,
  "validated_ascent_m" integer,
  "descent_m" integer,
  "lifecycle" text DEFAULT 'synced' NOT NULL,
  "evidence_state" text DEFAULT 'recorded_unverified' NOT NULL,
  "visibility" text DEFAULT 'private' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_canonical_activity_context" CHECK ("primary_context" IN ('training', 'expedition', 'free_hike', 'mountain_simulation')),
  CONSTRAINT "chk_canonical_activity_lifecycle" CHECK ("lifecycle" IN ('recording', 'completed_local', 'pending_sync', 'synced', 'sync_failed', 'corrected', 'deleted')),
  CONSTRAINT "chk_canonical_activity_evidence" CHECK ("evidence_state" IN ('unverified_manual', 'recorded_unverified', 'quality_accepted', 'verified_activity', 'verified_summit_ascent', 'competition_eligible')),
  CONSTRAINT "chk_canonical_activity_visibility" CHECK ("visibility" IN ('private', 'unlisted', 'public_summary')),
  CONSTRAINT "chk_canonical_activity_duration" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0),
  CONSTRAINT "chk_canonical_activity_distance" CHECK ("distance_km" IS NULL OR "distance_km" >= 0),
  CONSTRAINT "chk_canonical_activity_recorded_ascent" CHECK ("recorded_ascent_m" IS NULL OR "recorded_ascent_m" >= 0),
  CONSTRAINT "chk_canonical_activity_validated_ascent" CHECK ("validated_ascent_m" IS NULL OR "validated_ascent_m" >= 0),
  CONSTRAINT "chk_canonical_activity_descent" CHECK ("descent_m" IS NULL OR "descent_m" >= 0),
  CONSTRAINT "chk_canonical_activity_time_order" CHECK ("started_at" IS NULL OR "ended_at" IS NULL OR "ended_at" >= "started_at")
);

CREATE UNIQUE INDEX IF NOT EXISTS "canonical_activities_owner_source_uidx"
  ON "canonical_activities" ("owner_user_id", "source_type", "source_id");
CREATE INDEX IF NOT EXISTS "canonical_activities_owner_occurred_idx"
  ON "canonical_activities" ("owner_user_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "canonical_activities_context_idx"
  ON "canonical_activities" ("primary_context");

CREATE TABLE IF NOT EXISTS "canonical_activity_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "activity_id" uuid NOT NULL REFERENCES "canonical_activities"("id") ON DELETE CASCADE,
  "owner_user_id" text NOT NULL,
  "evidence_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "visibility" text DEFAULT 'private' NOT NULL,
  "captured_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_canonical_evidence_visibility" CHECK ("visibility" = 'private'),
  CONSTRAINT "chk_canonical_evidence_type" CHECK ("evidence_type" IN ('gps_track', 'elevation_profile', 'manual_estimate', 'source_snapshot'))
);

CREATE INDEX IF NOT EXISTS "canonical_activity_evidence_activity_idx"
  ON "canonical_activity_evidence" ("activity_id");
CREATE INDEX IF NOT EXISTS "canonical_activity_evidence_owner_idx"
  ON "canonical_activity_evidence" ("owner_user_id");

CREATE TABLE IF NOT EXISTS "canonical_activity_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "activity_id" uuid NOT NULL REFERENCES "canonical_activities"("id") ON DELETE CASCADE,
  "owner_user_id" text NOT NULL,
  "link_type" text NOT NULL,
  "target_id" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_canonical_activity_link_type" CHECK ("link_type" IN ('training_plan', 'training_session', 'expedition', 'expedition_stage', 'canonical_hill', 'canonical_route', 'community_route', 'challenge'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "canonical_activity_links_unique"
  ON "canonical_activity_links" ("activity_id", "link_type", "target_id");
CREATE INDEX IF NOT EXISTS "canonical_activity_links_target_idx"
  ON "canonical_activity_links" ("link_type", "target_id");

CREATE TABLE IF NOT EXISTS "canonical_activity_qualifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "activity_id" uuid NOT NULL REFERENCES "canonical_activities"("id") ON DELETE CASCADE,
  "owner_user_id" text NOT NULL,
  "purpose" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "evidence_class" text NOT NULL,
  "reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "credited_metric" integer,
  "rule_version" text NOT NULL,
  "evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_canonical_qualification_purpose" CHECK ("purpose" IN ('personal_history', 'elevation_bank_personal', 'readiness', 'real_summit_evidence', 'summit_crown', 'leaderboard', 'achievement')),
  CONSTRAINT "chk_canonical_qualification_status" CHECK ("status" IN ('eligible', 'ineligible', 'pending', 'revoked')),
  CONSTRAINT "chk_canonical_qualification_evidence" CHECK ("evidence_class" IN ('unverified_manual', 'recorded_unverified', 'quality_accepted', 'verified_activity', 'verified_summit_ascent', 'competition_eligible')),
  CONSTRAINT "chk_canonical_qualification_metric" CHECK ("credited_metric" IS NULL OR "credited_metric" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "canonical_activity_qualifications_unique"
  ON "canonical_activity_qualifications" ("activity_id", "purpose", "rule_version");
CREATE INDEX IF NOT EXISTS "canonical_activity_qualifications_purpose_idx"
  ON "canonical_activity_qualifications" ("purpose", "status");

CREATE TABLE IF NOT EXISTS "canonical_activity_conflicts" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "activity_id" uuid NOT NULL REFERENCES "canonical_activities"("id") ON DELETE CASCADE,
  "owner_user_id" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "existing_payload_hash" text NOT NULL,
  "incoming_payload_hash" text NOT NULL,
  "conflict_type" text DEFAULT 'payload_conflict' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_canonical_activity_conflict_type" CHECK ("conflict_type" IN ('payload_conflict', 'owner_collision'))
);

CREATE INDEX IF NOT EXISTS "canonical_activity_conflicts_source_idx"
  ON "canonical_activity_conflicts" ("owner_user_id", "source_type", "source_id");

ALTER TABLE "tracked_hill_sessions"
  ADD COLUMN IF NOT EXISTS "canonical_activity_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tracked_hill_sessions_canonical_activity_id_canonical_activities_id_fk'
  ) THEN
    ALTER TABLE "tracked_hill_sessions"
      ADD CONSTRAINT "tracked_hill_sessions_canonical_activity_id_canonical_activities_id_fk"
      FOREIGN KEY ("canonical_activity_id")
      REFERENCES "canonical_activities"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tracked_hill_sessions_canonical_activity_idx"
  ON "tracked_hill_sessions" ("canonical_activity_id");