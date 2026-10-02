-- Routes a person drew for themselves.
--
-- Deliberately its own table, not a flag on tracked_routes and nothing to do
-- with the canonical route pipeline.
--
-- A tracked route was recorded by walking it. A canonical route has been
-- rights-cleared and validated against evidence. A planned route is neither:
-- somebody drew it on a map, possibly over ground nobody has surveyed. Storing
-- it alongside either of the others means one missed WHERE clause away from a
-- drawn line being read as a walked one, and on a mountain that is the kind of
-- mistake that gets believed.
--
-- Nothing here references route_identities, route_definitions or
-- route_validation. A plan cannot become canonical geometry by accident; that
-- would need a deliberate, separate promotion step that does not exist yet.

CREATE TABLE IF NOT EXISTS "planned_routes" (
  "id" text PRIMARY KEY NOT NULL,
  -- Clerk userId. A plan belongs to one person; it is not published.
  "user_id" text NOT NULL,
  "name" text NOT NULL,

  -- The taps the person made, so the route can be reopened and edited rather
  -- than only redrawn. Without these an edit means starting again.
  "anchors" jsonb NOT NULL,
  -- The rendered line: every coordinate, snapped sections expanded.
  "geometry" jsonb NOT NULL,
  -- Per leg: whether it followed a mapped path, crossed a gap, or is a
  -- straight line. This is what stops the whole route reading as surveyed when
  -- only part of it is.
  "legs" jsonb NOT NULL DEFAULT '[]'::jsonb,

  "length_m" integer NOT NULL,
  -- Nullable on purpose. Unknown ascent is not zero ascent — a route whose
  -- elevation could not be read must not claim to be flat.
  "ascent_m" integer,
  "descent_m" integer,
  -- Sampled heights, when they were available. Null means not computed.
  "profile" jsonb,

  -- True only when every leg followed a mapped path. One straight section
  -- makes the whole route unsurveyed.
  "fully_snapped" boolean NOT NULL DEFAULT false,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Listing someone's routes, newest first, is the only query this table has.
CREATE INDEX IF NOT EXISTS "planned_routes_user_idx"
  ON "planned_routes" ("user_id", "updated_at" DESC);
