-- Owner map/itinerary feedback only, independent of validation and publication.
-- Apply atomically to the confirmed DEVELOPMENT database, never on API startup.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $$
BEGIN
  IF current_database() <> 'heliumdb'
     OR to_regclass('public.route_geometry_review_revisions') IS NULL THEN
    RAISE EXCEPTION 'Confirmed development route review storage is required';
  END IF;
END $$;

CREATE TABLE public.route_geometry_map_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_revision_id uuid NOT NULL REFERENCES public.route_geometry_review_revisions(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN ('looks_correct', 'needs_changes', 'rejected')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX route_geometry_map_reviews_revision_time
  ON public.route_geometry_map_reviews(review_revision_id, created_at DESC, id DESC);
COMMENT ON TABLE public.route_geometry_map_reviews IS
  'Append-only owner feedback on exact saved map revision and itinerary. Never safety, rights, access, elevation, validation or publication approval.';

CREATE FUNCTION public.reject_route_map_review_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Map review history is append-only; record a new review instead';
END $$;
CREATE TRIGGER route_map_reviews_append_only
  BEFORE UPDATE OR DELETE ON public.route_geometry_map_reviews
  FOR EACH ROW EXECUTE FUNCTION public.reject_route_map_review_mutation();
