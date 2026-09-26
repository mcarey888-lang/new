-- Additive community sharing schema. Applied to the development database only.
CREATE TABLE IF NOT EXISTS "community_posts" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_user_id" text NOT NULL,
  "kind" text NOT NULL,
  "text" text DEFAULT '' NOT NULL,
  "badge_id" text,
  "badge_title" text,
  "visibility" text DEFAULT 'private' NOT NULL,
  "photo_path" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "community_posts_kind_check" CHECK ("kind" IN ('story', 'badge', 'photo')),
  CONSTRAINT "community_posts_visibility_check" CHECK ("visibility" IN ('private', 'members'))
);
CREATE INDEX IF NOT EXISTS "community_posts_owner_created_idx" ON "community_posts" ("owner_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "community_posts_visibility_created_idx" ON "community_posts" ("visibility", "created_at");

CREATE TABLE IF NOT EXISTS "community_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "reporter_user_id" text NOT NULL,
  "post_id" text NOT NULL,
  "target_owner_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "community_reports_reporter_idx" ON "community_reports" ("reporter_user_id");
CREATE INDEX IF NOT EXISTS "community_reports_target_owner_idx" ON "community_reports" ("target_owner_user_id");
CREATE INDEX IF NOT EXISTS "community_reports_post_idx" ON "community_reports" ("post_id");
CREATE UNIQUE INDEX IF NOT EXISTS "community_reports_reporter_post_uidx"
  ON "community_reports" ("reporter_user_id", "post_id");