-- Additive only. Existing recordings and unknown sharing intent are preserved.
BEGIN;
CREATE TABLE IF NOT EXISTS public.recorded_hike_backups (
 owner_user_id text NOT NULL, hike_id text NOT NULL, snapshot jsonb NOT NULL,
 revision text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_user_id,hike_id)
);
CREATE TABLE IF NOT EXISTS public.activity_preferences (
 owner text PRIMARY KEY, audience text CHECK (audience IN ('public','followers','private')),
 cover_path text
);
CREATE TABLE IF NOT EXISTS public.activity_follows (
 follower text NOT NULL, followed text NOT NULL, PRIMARY KEY(follower,followed),
 CHECK(follower <> followed)
);
CREATE TABLE IF NOT EXISTS public.activity_publications (
 owner text NOT NULL, hike_id text NOT NULL,
 audience text NOT NULL CHECK(audience IN ('public','followers','private')),
 audience_revision text NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner,hike_id),
 FOREIGN KEY(owner,hike_id) REFERENCES public.recorded_hike_backups(owner_user_id,hike_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.activity_bookmarks (
 viewer text NOT NULL, owner text NOT NULL, hike_id text NOT NULL,
 PRIMARY KEY(viewer,owner,hike_id)
);
CREATE TABLE IF NOT EXISTS public.activity_route_reports (
 reporter text NOT NULL, owner text NOT NULL, hike_id text NOT NULL,
 reason text NOT NULL, PRIMARY KEY(reporter,owner,hike_id)
);
CREATE TABLE IF NOT EXISTS public.activity_trail_suggestions (
 owner text NOT NULL, hike_id text NOT NULL, evidence_revision text NOT NULL,
 status text NOT NULL DEFAULT 'pending', PRIMARY KEY(owner,hike_id)
);
ALTER TABLE public.tracked_routes ADD COLUMN IF NOT EXISTS audience text;
-- NULL means legacy intent is unknown. It is neither deleted nor auto-published.
ALTER TABLE public.activity_publications ADD COLUMN IF NOT EXISTS audience_revision text NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
COMMIT;
