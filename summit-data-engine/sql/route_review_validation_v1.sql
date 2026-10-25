-- Additive review storage only. Apply atomically to the confirmed DEVELOPMENT DB.
-- No canonical imports, reader activation, role changes or legacy schema repair.
-- Alembic supplies its own transaction; the dev SQL tool must wrap this file.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF to_regclass('public.route_geometries') IS NULL
     OR to_regclass('public.route_definitions') IS NULL THEN
    RAISE EXCEPTION 'Existing engine geometry/definition tables are required';
  END IF;
  IF to_regclass('public.route_geometry_review_revisions') IS NOT NULL
     OR to_regclass('public.route_geometry_review_validations') IS NOT NULL
     OR to_regclass('public.route_geometry_review_decisions') IS NOT NULL THEN
    RAISE EXCEPTION 'Review tables already exist: inspect their revision, do not overwrite';
  END IF;
END $$;

CREATE TABLE public.route_geometry_review_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_key text NOT NULL CHECK (length(btrim(candidate_key)) > 0),
  revision_version text NOT NULL CHECK (length(btrim(revision_version)) > 0),
  canonical_geometry_id uuid REFERENCES public.route_geometries(id) ON DELETE RESTRICT,
  canonical_geometry_version text,
  route_definition_id uuid REFERENCES public.route_definitions(id) ON DELETE RESTRICT,
  definition_version text,
  definition_context_sha256 text CHECK (definition_context_sha256 ~ '^[0-9a-f]{64}$'),
  geometry_snapshot public.geometry(LineString,4326) NOT NULL,
  geometry_sha256 text GENERATED ALWAYS AS (
    encode(sha256(public.ST_AsEWKB(geometry_snapshot,'XDR')),'hex')
  ) STORED,
  geometry_digest_algorithm text NOT NULL DEFAULT 'sha256-ewkb-xdr-srid4326-2d-v1'
    CHECK (geometry_digest_algorithm = 'sha256-ewkb-xdr-srid4326-2d-v1'),
  source_manifest jsonb NOT NULL CHECK (
    jsonb_typeof(source_manifest) = 'array' AND jsonb_array_length(source_manifest) > 0
  ),
  source_manifest_sha256 text GENERATED ALWAYS AS (
    encode(sha256(jsonb_send(source_manifest)),'hex')
  ) STORED,
  manifest_digest_algorithm text NOT NULL DEFAULT 'sha256-postgres-jsonb-send-v1'
    CHECK (manifest_digest_algorithm = 'sha256-postgres-jsonb-send-v1'),
  profile_sha256 text CHECK (profile_sha256 ~ '^[0-9a-f]{64}$'),
  terrain_manifest_sha256 text CHECK (terrain_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  profile_method_version text,
  review_file_hashes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(review_file_hashes) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (candidate_key, revision_version),
  CHECK (public.ST_IsValid(geometry_snapshot) AND NOT public.ST_IsEmpty(geometry_snapshot)
    AND public.ST_NDims(geometry_snapshot) = 2
    AND public.ST_NPoints(geometry_snapshot) >= 2
    AND public.ST_XMin(public.Box3D(geometry_snapshot)) >= -180
    AND public.ST_XMax(public.Box3D(geometry_snapshot)) <= 180
    AND public.ST_YMin(public.Box3D(geometry_snapshot)) >= -90
    AND public.ST_YMax(public.Box3D(geometry_snapshot)) <= 90),
  CHECK (
    (canonical_geometry_id IS NULL AND canonical_geometry_version IS NULL
      AND route_definition_id IS NULL AND definition_version IS NULL AND definition_context_sha256 IS NULL)
    OR (canonical_geometry_id IS NOT NULL AND canonical_geometry_version IS NOT NULL
      AND length(btrim(canonical_geometry_version)) > 0 AND definition_context_sha256 IS NOT NULL
      AND route_definition_id IS NOT NULL AND definition_version IS NOT NULL AND length(btrim(definition_version)) > 0)
  ),
  CHECK (
    (profile_sha256 IS NULL AND terrain_manifest_sha256 IS NULL AND profile_method_version IS NULL)
    OR (profile_sha256 IS NOT NULL AND terrain_manifest_sha256 IS NOT NULL
      AND profile_method_version IS NOT NULL AND length(btrim(profile_method_version)) > 0)
  )
);

CREATE TABLE public.route_geometry_review_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_revision_id uuid NOT NULL REFERENCES public.route_geometry_review_revisions(id) ON DELETE RESTRICT,
  geometry_sha256 text NOT NULL CHECK (geometry_sha256 ~ '^[0-9a-f]{64}$'),
  source_manifest_sha256 text NOT NULL CHECK (source_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  profile_sha256 text CHECK (profile_sha256 ~ '^[0-9a-f]{64}$'),
  terrain_manifest_sha256 text CHECK (terrain_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  evaluator_version text NOT NULL CHECK (length(btrim(evaluator_version)) > 0),
  evaluator_sha256 text NOT NULL CHECK (evaluator_sha256 ~ '^[0-9a-f]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('needs_review','rejected','accepted')),
  structural_checks_passed boolean NOT NULL DEFAULT false,
  source_rights_reviewed boolean NOT NULL DEFAULT false,
  route_access_reviewed boolean NOT NULL DEFAULT false,
  terrain_rights_reviewed boolean NOT NULL DEFAULT false,
  elevation_coverage_complete boolean NOT NULL DEFAULT false,
  profile_reviewed boolean NOT NULL DEFAULT false,
  review_authority text NOT NULL CHECK (length(btrim(review_authority)) > 0),
  reviewed_at timestamptz,
  valid_until timestamptz,
  diagnostics jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(diagnostics) = 'array'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (outcome <> 'accepted' OR (
    structural_checks_passed AND source_rights_reviewed AND route_access_reviewed
    AND reviewed_at IS NOT NULL AND valid_until IS NOT NULL AND valid_until > reviewed_at
    AND (profile_sha256 IS NULL OR (
      terrain_manifest_sha256 IS NOT NULL AND terrain_rights_reviewed
      AND elevation_coverage_complete AND profile_reviewed))
  ))
);
CREATE INDEX route_review_validations_revision_idx
  ON public.route_geometry_review_validations(review_revision_id);

CREATE TABLE public.route_geometry_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_revision_id uuid NOT NULL REFERENCES public.route_geometry_review_revisions(id) ON DELETE RESTRICT,
  validation_id uuid NOT NULL REFERENCES public.route_geometry_review_validations(id) ON DELETE RESTRICT,
  supersedes_decision_id uuid UNIQUE REFERENCES public.route_geometry_review_decisions(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('approved','revoked')),
  release_scope text NOT NULL DEFAULT 'development' CHECK (release_scope = 'development'),
  evaluator_version text NOT NULL CHECK (length(btrim(evaluator_version)) > 0),
  evaluator_sha256 text NOT NULL CHECK (evaluator_sha256 ~ '^[0-9a-f]{64}$'),
  review_authority text NOT NULL CHECK (length(btrim(review_authority)) > 0),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX route_review_decisions_one_root_idx
  ON public.route_geometry_review_decisions(review_revision_id)
  WHERE supersedes_decision_id IS NULL;
CREATE INDEX route_review_decisions_revision_idx
  ON public.route_geometry_review_decisions(review_revision_id);

-- Include all member/provenance/rights inputs. A later rights edit or source
-- revision must not inherit a historical decision. Timestamps normalise to UTC.
CREATE FUNCTION public.sde_review_source_manifest(p_geometry_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'memberId',gm.id,'sequence',gm.sequence,'type',gm.source_member_type,
    'sourceMemberId',gm.source_member_id,'direction',gm.direction,
    'sourceBundleId',sb.id,'sha256',sb.sha256,'provider',sb.provider,
    'url',sb.source_url,'licence',sb.licence,'provenanceVersion',sb.provenance_version,
    'metadata',sb.metadata,
    'retrievedAt',to_char(sb.retrieved_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'rightsEvidence',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',e.id,'key',e.source_key,'version',e.version,
        'publisher',e.publisher,'url',e.url,'title',e.title,
        'rightsClassification',e.rights_classification,
        'geometryReuseAllowed',e.geometry_reuse_allowed,'rightsStatement',e.rights_statement,
        'retrievedAt',to_char(e.retrieved_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      ) ORDER BY e.id)
      FROM public.evidence_sources e WHERE e.publisher=sb.provider AND e.url=sb.source_url
    ),'[]'::jsonb)
  ) ORDER BY gm.sequence),'[]'::jsonb)
  FROM public.route_geometry_members gm
  LEFT JOIN public.source_bundles sb ON sb.id=gm.source_bundle_id
  WHERE gm.route_geometry_id=p_geometry_id
$$;

CREATE FUNCTION public.sde_review_definition_context(p_definition_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object(
    'definitionId',rd.id,'definitionVersion',rd.version,'description',rd.description,'legacyRouteId',rd.route_id,
    'identityId',ri.id,'identityKey',ri.identity_key,'identityVersion',ri.version,'mountainId',m.id,
    'mountainElevation',m.elevation_m,'mountainGeometry',encode(public.ST_AsEWKB(m.geom,'XDR'),'hex')
  )::text,'UTF8')),'hex')
  FROM public.route_definitions rd JOIN public.route_identities ri ON ri.id=rd.route_identity_id
  JOIN public.mountains m ON m.id=ri.mountain_id WHERE rd.id=p_definition_id
$$;

CREATE FUNCTION public.sde_review_binding_current(p_revision_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT COALESCE((
    SELECT
      g.route_definition_id=r.route_definition_id
      AND g.version=r.canonical_geometry_version AND rd.version=r.definition_version
      AND ri.version=rd.version AND g.version=rd.version
      AND rd.status::text='verified' AND ri.status::text='verified' AND m.status::text='verified'
      AND public.sde_review_definition_context(rd.id)=r.definition_context_sha256
      AND encode(sha256(public.ST_AsEWKB(g.geom,'XDR')),'hex')=r.geometry_sha256
      AND public.ST_SRID(g.geom)=4326 AND public.ST_NDims(g.geom)=2
      AND public.ST_GeometryType(g.geom)='ST_LineString' AND public.ST_IsValid(g.geom)
      AND public.sde_review_source_manifest(g.id)=r.source_manifest
      AND EXISTS (SELECT 1 FROM public.route_geometry_members gm WHERE gm.route_geometry_id=g.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.route_geometry_members gm
        LEFT JOIN public.source_bundles sb ON sb.id=gm.source_bundle_id
        WHERE gm.route_geometry_id=g.id AND (
          sb.id IS NULL OR sb.sha256 !~ '^[0-9a-f]{64}$' OR length(btrim(sb.licence))=0
          OR gm.direction NOT IN (-1,1) OR length(btrim(gm.source_member_type))=0
          OR length(btrim(gm.source_member_id))=0
          OR NOT EXISTS (
            SELECT 1 FROM public.evidence_sources e
            WHERE e.publisher=sb.provider AND e.url=sb.source_url
              AND e.geometry_reuse_allowed=true AND e.rights_classification::text='reusable_geometry'
              AND length(btrim(e.rights_statement))>0
          )
          OR EXISTS (
            SELECT 1 FROM public.evidence_sources e
            WHERE e.publisher=sb.provider AND e.url=sb.source_url
              AND (e.geometry_reuse_allowed=false OR e.rights_classification::text<>'reusable_geometry')
          )
        )
      )
    FROM public.route_geometry_review_revisions r
    JOIN public.route_geometries g ON g.id=r.canonical_geometry_id
    JOIN public.route_definitions rd ON rd.id=r.route_definition_id
    JOIN public.route_identities ri ON ri.id=rd.route_identity_id
    JOIN public.mountains m ON m.id=ri.mountain_id
    WHERE r.id=p_revision_id
  ),false)
$$;

CREATE FUNCTION public.sde_review_reject_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Route review evidence is append-only; record a new revision/decision'
    USING ERRCODE='23514';
END $$;

CREATE FUNCTION public.sde_review_check_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE g public.route_geometries%ROWTYPE; rd public.route_definitions%ROWTYPE;
BEGIN
  IF NEW.canonical_geometry_id IS NOT NULL THEN
    SELECT * INTO g FROM public.route_geometries WHERE id=NEW.canonical_geometry_id;
    SELECT * INTO rd FROM public.route_definitions WHERE id=NEW.route_definition_id;
    IF g.id IS NULL OR rd.id IS NULL
       OR g.route_definition_id IS DISTINCT FROM NEW.route_definition_id
       OR g.version IS DISTINCT FROM NEW.canonical_geometry_version
       OR rd.version IS DISTINCT FROM NEW.definition_version
       OR encode(sha256(public.ST_AsEWKB(g.geom,'XDR')),'hex')
          IS DISTINCT FROM encode(sha256(public.ST_AsEWKB(NEW.geometry_snapshot,'XDR')),'hex')
       OR public.sde_review_source_manifest(g.id) IS DISTINCT FROM NEW.source_manifest THEN
      RAISE EXCEPTION 'Review revision must exactly match its canonical geometry, definition and members'
        USING ERRCODE='23514';
    END IF;
    NEW.definition_context_sha256 := public.sde_review_definition_context(NEW.route_definition_id);
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.sde_review_check_validation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE r public.route_geometry_review_revisions%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.route_geometry_review_revisions WHERE id=NEW.review_revision_id;
  IF r.id IS NULL OR NEW.geometry_sha256 IS DISTINCT FROM r.geometry_sha256
     OR NEW.source_manifest_sha256 IS DISTINCT FROM r.source_manifest_sha256
     OR NEW.profile_sha256 IS DISTINCT FROM r.profile_sha256
     OR NEW.terrain_manifest_sha256 IS DISTINCT FROM r.terrain_manifest_sha256 THEN
    RAISE EXCEPTION 'Validation hashes must match the exact review revision' USING ERRCODE='23514';
  END IF;
  IF NEW.outcome='accepted' AND (
    NOT public.sde_review_binding_current(r.id)
    OR NEW.reviewed_at IS NULL OR NEW.reviewed_at>clock_timestamp()
    OR NEW.valid_until IS NULL OR NEW.valid_until<=clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'Accepted validation requires a current bound route and dated review'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.sde_review_check_decision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v public.route_geometry_review_validations%ROWTYPE;
        prior public.route_geometry_review_decisions%ROWTYPE;
BEGIN
  -- Serialize appends, never edit an earlier review record.
  PERFORM 1 FROM public.route_geometry_review_revisions WHERE id=NEW.review_revision_id FOR UPDATE;
  SELECT * INTO v FROM public.route_geometry_review_validations WHERE id=NEW.validation_id;
  IF v.id IS NULL OR v.review_revision_id IS DISTINCT FROM NEW.review_revision_id
     OR v.evaluator_version IS DISTINCT FROM NEW.evaluator_version
     OR v.evaluator_sha256 IS DISTINCT FROM NEW.evaluator_sha256 THEN
    RAISE EXCEPTION 'Decision must use the exact validation revision and evaluator' USING ERRCODE='23514';
  END IF;
  SELECT d.* INTO prior FROM public.route_geometry_review_decisions d
    WHERE d.review_revision_id=NEW.review_revision_id
      AND NOT EXISTS (SELECT 1 FROM public.route_geometry_review_decisions n WHERE n.supersedes_decision_id=d.id);
  IF (prior.id IS NULL AND (NEW.supersedes_decision_id IS NOT NULL OR NEW.decision<>'approved'))
     OR (prior.id IS NOT NULL AND (
       NEW.supersedes_decision_id IS DISTINCT FROM prior.id OR NEW.decision=prior.decision
     )) THEN
    RAISE EXCEPTION 'Decision must extend the current approval/revocation chain' USING ERRCODE='23514';
  END IF;
  IF NEW.decision='approved' AND (
    v.outcome<>'accepted' OR v.valid_until IS NULL OR v.valid_until<=clock_timestamp()
    OR NOT public.sde_review_binding_current(NEW.review_revision_id)
    OR (prior.decision='revoked' AND (
      v.id=prior.validation_id OR v.reviewed_at<=prior.created_at
    ))
  ) THEN
    RAISE EXCEPTION 'Approval requires a current accepted validation with eligible source rights'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.sde_review_eligible(
  p_revision_id uuid, p_evaluator_version text, p_evaluator_sha256 text
) RETURNS boolean LANGUAGE sql STABLE STRICT SET search_path = pg_catalog, public AS $$
  SELECT COALESCE((
    SELECT d.decision='approved' AND d.release_scope='development'
      AND v.outcome='accepted' AND v.valid_until>statement_timestamp()
      AND d.evaluator_version=p_evaluator_version AND d.evaluator_sha256=p_evaluator_sha256
      AND public.sde_review_binding_current(d.review_revision_id)
    FROM public.route_geometry_review_decisions d
    JOIN public.route_geometry_review_validations v ON v.id=d.validation_id
    WHERE d.review_revision_id=p_revision_id
      AND NOT EXISTS (SELECT 1 FROM public.route_geometry_review_decisions n WHERE n.supersedes_decision_id=d.id)
  ),false)
$$;

CREATE TRIGGER route_review_revision_binding BEFORE INSERT
  ON public.route_geometry_review_revisions FOR EACH ROW EXECUTE FUNCTION public.sde_review_check_revision();
CREATE TRIGGER route_review_validation_binding BEFORE INSERT
  ON public.route_geometry_review_validations FOR EACH ROW EXECUTE FUNCTION public.sde_review_check_validation();
CREATE TRIGGER route_review_decision_binding BEFORE INSERT
  ON public.route_geometry_review_decisions FOR EACH ROW EXECUTE FUNCTION public.sde_review_check_decision();
CREATE TRIGGER route_review_revision_immutable BEFORE UPDATE OR DELETE
  ON public.route_geometry_review_revisions FOR EACH ROW EXECUTE FUNCTION public.sde_review_reject_mutation();
CREATE TRIGGER route_review_validation_immutable BEFORE UPDATE OR DELETE
  ON public.route_geometry_review_validations FOR EACH ROW EXECUTE FUNCTION public.sde_review_reject_mutation();
CREATE TRIGGER route_review_decision_immutable BEFORE UPDATE OR DELETE
  ON public.route_geometry_review_decisions FOR EACH ROW EXECUTE FUNCTION public.sde_review_reject_mutation();
CREATE TRIGGER route_review_revision_no_truncate BEFORE TRUNCATE
  ON public.route_geometry_review_revisions FOR EACH STATEMENT EXECUTE FUNCTION public.sde_review_reject_mutation();
CREATE TRIGGER route_review_validation_no_truncate BEFORE TRUNCATE
  ON public.route_geometry_review_validations FOR EACH STATEMENT EXECUTE FUNCTION public.sde_review_reject_mutation();
CREATE TRIGGER route_review_decision_no_truncate BEFORE TRUNCATE
  ON public.route_geometry_review_decisions FOR EACH STATEMENT EXECUTE FUNCTION public.sde_review_reject_mutation();

REVOKE ALL ON public.route_geometry_review_revisions,
  public.route_geometry_review_validations,public.route_geometry_review_decisions FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sde_review_source_manifest(uuid),
  public.sde_review_definition_context(uuid),public.sde_review_binding_current(uuid),public.sde_review_reject_mutation(),
  public.sde_review_check_revision(),public.sde_review_check_validation(),
  public.sde_review_check_decision(),public.sde_review_eligible(uuid,text,text) FROM PUBLIC;

COMMENT ON TABLE public.route_geometry_review_revisions IS
  'Append-only review snapshots; file hashes are distinct from generated canonical EWKB/source digests.';
COMMENT ON TABLE public.route_geometry_review_validations IS
  'Exact-version review decisions, not automatic evidence of safe navigation or source rights.';
COMMENT ON TABLE public.route_geometry_review_decisions IS
  'Development-scoped approval/revocation chain only. Does not activate the canonical API.';
