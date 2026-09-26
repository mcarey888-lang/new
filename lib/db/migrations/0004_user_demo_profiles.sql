CREATE TABLE IF NOT EXISTS "user_demo_profiles" (
  "clerk_user_id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);