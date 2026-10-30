-- READ-ONLY REVIEW ARTIFACT. Do not execute as a custom production migration.
-- Actual explainSchemaDiff result, 30 October 2026. Managed Publish applies
-- only after a separate reviewed rollout approval. No customer DML.
CREATE TABLE "privacy_deletion_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" text NOT NULL,
  "state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "privacy_deletion_jobs_owner_user_id_key" UNIQUE("owner_user_id")
);
ALTER TABLE "route_contributions" ADD COLUMN "owner_user_id" text;
