-- Additive only. No existing customer rows are read, updated or deleted.
CREATE TABLE IF NOT EXISTS privacy_deletion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL UNIQUE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Future route contributions can be erased by their actual author, even when
-- contributed to somebody else's canonical route. Never guess historical owners.
ALTER TABLE route_contributions ADD COLUMN IF NOT EXISTS owner_user_id text;
