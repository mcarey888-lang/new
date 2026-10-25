-- Database integration tests. All fixture rows and helper objects ROLLBACK.
-- Execute as one development SQL call; do not split the transaction.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
  IF current_database()<>'heliumdb' THEN RAISE EXCEPTION 'Development test database required'; END IF;
END $$;
CREATE TEMP TABLE route_review_test_results(checks integer);
CREATE FUNCTION pg_temp.test_route_review_validation(p_revision uuid,p_outcome text,p_reviewed boolean)
RETURNS uuid LANGUAGE sql VOLATILE AS $$
  INSERT INTO public.route_geometry_review_validations(
    review_revision_id,geometry_sha256,source_manifest_sha256,profile_sha256,terrain_manifest_sha256,
    evaluator_version,evaluator_sha256,outcome,structural_checks_passed,
    source_rights_reviewed,route_access_reviewed,terrain_rights_reviewed,
    elevation_coverage_complete,profile_reviewed,review_authority,reviewed_at,valid_until
  ) SELECT id,geometry_sha256,source_manifest_sha256,profile_sha256,terrain_manifest_sha256,
    'rollback-test-v1',repeat('c',64),p_outcome,true,p_reviewed,p_reviewed,p_reviewed,
    p_reviewed,p_reviewed,'AUTOMATED TEST ONLY - transaction rolled back',
    CASE WHEN p_reviewed THEN clock_timestamp() END,
    CASE WHEN p_reviewed THEN clock_timestamp()+interval '1 day' END
  FROM public.route_geometry_review_revisions WHERE id=p_revision RETURNING id
$$;
DO $$
DECLARE
  mountain uuid; identity_id uuid:=gen_random_uuid(); definition_id uuid:=gen_random_uuid();
  geometry_id uuid:=gen_random_uuid(); bundle_id uuid:=gen_random_uuid(); evidence_id uuid:=gen_random_uuid();
  revision_id uuid; unbound_id uuid; validation_id uuid; draft_id uuid; decision_id uuid; revoked_id uuid;
  renewed_id uuid; r public.route_geometry_review_revisions%ROWTYPE; checks integer:=0;
  source_url text:='https://example.invalid/rollback-only/'||bundle_id::text;
  line public.geometry:=public.ST_GeomFromText('LINESTRING(-4 53,-4.001 53.001,-4.002 53.003)',4326);
BEGIN
  SELECT id INTO mountain FROM public.mountains WHERE status::text='verified' ORDER BY id LIMIT 1;
  IF mountain IS NULL THEN RAISE EXCEPTION 'No verified test parent mountain available'; END IF;
  -- Never edit a real row, even temporarily. Every test-owned fixture rolls back.
  INSERT INTO public.route_identities(id,mountain_id,identity_key,version,canonical_name,status)
    VALUES(identity_id,mountain,'rollback-test:'||identity_id::text,'rollback-v1','ROLLBACK TEST ONLY','verified');
  INSERT INTO public.route_definitions(id,route_identity_id,version,description,status)
    VALUES(definition_id,identity_id,'rollback-v1','ROLLBACK TEST ONLY','verified');
  INSERT INTO public.route_geometries(id,route_definition_id,version,geom,derivation_method)
    VALUES(geometry_id,definition_id,'rollback-v1',line,'rollback-test-only');
  INSERT INTO public.source_bundles(id,source_type,provider,source_url,licence,local_path,sha256,
    size_bytes,retrieved_at,provenance_version)
    VALUES(bundle_id,'qa_test','rollback-review-test',source_url,'TEST ONLY','rollback-only',
      md5(bundle_id::text)||md5(bundle_id::text),0,clock_timestamp(),'rollback-v1');
  INSERT INTO public.evidence_sources(id,source_key,version,publisher,title,url,rights_classification,
    rights_statement,geometry_reuse_allowed,retrieved_at)
    VALUES(evidence_id,'rollback-test:'||evidence_id::text,'rollback-v1','rollback-review-test',
      'TEST ONLY - not real rights evidence',source_url,'reusable_geometry','TEST ONLY',true,clock_timestamp());
  INSERT INTO public.route_geometry_members(id,route_geometry_id,source_bundle_id,sequence,
    source_member_type,source_member_id,direction)
    VALUES(gen_random_uuid(),geometry_id,bundle_id,0,'test_way','rollback-only',1);
  INSERT INTO public.route_geometry_review_revisions(candidate_key,revision_version,
    canonical_geometry_id,canonical_geometry_version,route_definition_id,definition_version,
    geometry_snapshot,source_manifest,profile_sha256,terrain_manifest_sha256,profile_method_version)
    VALUES('rollback-test','v1',geometry_id,'rollback-v1',definition_id,'rollback-v1',
      line,public.sde_review_source_manifest(geometry_id),repeat('a',64),repeat('b',64),'test-profile-v1')
    RETURNING * INTO r;
  revision_id:=r.id;
  IF NOT public.sde_review_binding_current(revision_id) THEN RAISE EXCEPTION 'Valid binding rejected'; END IF;
  checks:=checks+1;

  INSERT INTO public.route_geometry_review_revisions(candidate_key,revision_version,geometry_snapshot,source_manifest)
    VALUES('rollback-test-unbound','v1',line,'[{"quarantineOnly":true}]') RETURNING id INTO unbound_id;
  BEGIN
    PERFORM pg_temp.test_route_review_validation(unbound_id,'accepted',true);
    RAISE EXCEPTION 'FAIL: unbound candidate accepted';
  EXCEPTION WHEN check_violation THEN checks:=checks+1; END;
  BEGIN
    PERFORM pg_temp.test_route_review_validation(revision_id,'accepted',false);
    RAISE EXCEPTION 'FAIL: automatic checks impersonated reviewed acceptance';
  EXCEPTION WHEN check_violation THEN checks:=checks+1; END;
  BEGIN
    INSERT INTO public.route_geometry_review_validations(
      review_revision_id,geometry_sha256,source_manifest_sha256,profile_sha256,terrain_manifest_sha256,
      evaluator_version,evaluator_sha256,outcome,review_authority)
      VALUES(revision_id,r.geometry_sha256,r.source_manifest_sha256,repeat('d',64),r.terrain_manifest_sha256,
        'rollback-test-v1',repeat('c',64),'needs_review','rollback-test');
    RAISE EXCEPTION 'FAIL: mismatched profile reused revision';
  EXCEPTION WHEN check_violation THEN checks:=checks+1; END;
  BEGIN
    INSERT INTO public.route_geometry_review_revisions(candidate_key,revision_version,geometry_snapshot,
      source_manifest,profile_sha256,terrain_manifest_sha256)
      VALUES('rollback-test-invalid-profile','v1',line,'[{}]',repeat('a',64),repeat('b',64));
    RAISE EXCEPTION 'FAIL: missing profile method accepted through NULL check';
  EXCEPTION WHEN check_violation THEN checks:=checks+1; END;

  draft_id:=pg_temp.test_route_review_validation(revision_id,'needs_review',false);
  BEGIN
    INSERT INTO public.route_geometry_review_decisions(review_revision_id,validation_id,decision,
      evaluator_version,evaluator_sha256,review_authority,reason)
      VALUES(revision_id,draft_id,'approved','rollback-test-v1',repeat('c',64),'rollback-test','draft must not publish');
    RAISE EXCEPTION 'FAIL: draft published';
  EXCEPTION WHEN check_violation THEN checks:=checks+1; END;
  validation_id:=pg_temp.test_route_review_validation(revision_id,'accepted',true);
  INSERT INTO public.route_geometry_review_decisions(review_revision_id,validation_id,decision,
    evaluator_version,evaluator_sha256,review_authority,reason)
    VALUES(revision_id,validation_id,'approved','rollback-test-v1',repeat('c',64),
      'AUTOMATED TEST ONLY','test-only approval - rolls back') RETURNING id INTO decision_id;
  IF NOT public.sde_review_eligible(revision_id,'rollback-test-v1',repeat('c',64)) THEN
    RAISE EXCEPTION 'FAIL: valid development approval unavailable';
  END IF;
  checks:=checks+1;
  IF public.sde_review_eligible(revision_id,'rollback-test-v2',repeat('c',64))
    OR public.sde_review_eligible(revision_id,'rollback-test-v1',repeat('d',64)) THEN
    RAISE EXCEPTION 'FAIL: changed evaluator reused old approval';
  END IF;
  checks:=checks+1;

  BEGIN
    UPDATE public.route_geometries SET geom=public.ST_Reverse(geom) WHERE id=geometry_id;
    IF public.sde_review_eligible(revision_id,'rollback-test-v1',repeat('c',64)) THEN
      RAISE EXCEPTION 'FAIL: changed coordinate order reused old approval';
    END IF;
    checks:=checks+1;
    RAISE EXCEPTION USING ERRCODE='P1234',MESSAGE='undo fixture-only edit';
  EXCEPTION WHEN SQLSTATE 'P1234' THEN NULL;
    WHEN raise_exception THEN
      IF SQLERRM<>'immutable provenance/version fields cannot be updated' THEN RAISE; END IF;
      checks:=checks+1;
  END;
  BEGIN
    UPDATE public.route_definitions SET description='Changed instructions, same version' WHERE id=definition_id;
    IF public.sde_review_eligible(revision_id,'rollback-test-v1',repeat('c',64)) THEN
      RAISE EXCEPTION 'FAIL: changed definition reused old approval';
    END IF;
    checks:=checks+1;
    RAISE EXCEPTION USING ERRCODE='P1234',MESSAGE='undo fixture-only edit';
  EXCEPTION WHEN SQLSTATE 'P1234' THEN NULL;
    WHEN raise_exception THEN
      IF SQLERRM<>'immutable provenance/version fields cannot be updated' THEN RAISE; END IF;
      checks:=checks+1;
  END;
  BEGIN
    INSERT INTO public.route_geometry_review_revisions(candidate_key,revision_version,
      canonical_geometry_id,canonical_geometry_version,route_definition_id,definition_version,
      geometry_snapshot,source_manifest)
      VALUES('rollback-reversed-snapshot','v1',geometry_id,'rollback-v1',definition_id,'rollback-v1',
        public.ST_Reverse(line),r.source_manifest);
    RAISE EXCEPTION 'FAIL: reversed snapshot bound to unchanged canonical geometry';
  EXCEPTION WHEN check_violation THEN checks:=checks+1; END;
  BEGIN
    INSERT INTO public.route_geometry_review_revisions(candidate_key,revision_version,
      canonical_geometry_id,canonical_geometry_version,route_definition_id,definition_version,
      geometry_snapshot,source_manifest)
      VALUES('rollback-wrong-manifest','v1',geometry_id,'rollback-v1',definition_id,'rollback-v1',
        line,'[{"wrongSource":true}]');
    RAISE EXCEPTION 'FAIL: wrong manifest bound to unchanged geometry';
  EXCEPTION WHEN check_violation THEN checks:=checks+1; END;
  BEGIN
    INSERT INTO public.evidence_sources(id,source_key,version,publisher,title,url,rights_classification,
      geometry_reuse_allowed,retrieved_at)
      VALUES(gen_random_uuid(),'rollback-conflict:'||evidence_id::text,'rollback-v2','rollback-review-test',
        'TEST conflict',source_url,'factual_identity_only',false,clock_timestamp());
    IF public.sde_review_eligible(revision_id,'rollback-test-v1',repeat('c',64)) THEN
      RAISE EXCEPTION 'FAIL: changed rights reused old approval';
    END IF;
    checks:=checks+1;
    RAISE EXCEPTION USING ERRCODE='P1234',MESSAGE='undo fixture-only evidence';
  EXCEPTION WHEN SQLSTATE 'P1234' THEN NULL; END;
  BEGIN
    INSERT INTO public.route_geometry_members(id,route_geometry_id,source_bundle_id,sequence,
      source_member_type,source_member_id,direction)
      VALUES(gen_random_uuid(),geometry_id,bundle_id,1,'test_way','extra-rollback-member',1);
    IF public.sde_review_eligible(revision_id,'rollback-test-v1',repeat('c',64)) THEN
      RAISE EXCEPTION 'FAIL: added member reused old approval';
    END IF;
    checks:=checks+1;
    RAISE EXCEPTION USING ERRCODE='P1234',MESSAGE='undo fixture-only member';
  EXCEPTION WHEN SQLSTATE 'P1234' THEN NULL; END;
  BEGIN
    UPDATE public.route_geometry_review_validations SET outcome='needs_review' WHERE id=validation_id;
    RAISE EXCEPTION 'FAIL: validation history edited';
  EXCEPTION WHEN check_violation THEN checks:=checks+1; END;
  BEGIN
    DELETE FROM public.route_geometry_review_revisions WHERE id=unbound_id;
    RAISE EXCEPTION 'FAIL: review history deleted';
  EXCEPTION WHEN check_violation THEN checks:=checks+1; END;
  BEGIN
    TRUNCATE public.route_geometry_review_revisions,public.route_geometry_review_validations,
      public.route_geometry_review_decisions;
    RAISE EXCEPTION 'FAIL: review history truncated';
  EXCEPTION WHEN check_violation THEN checks:=checks+1; END;
  BEGIN
    INSERT INTO public.route_geometry_review_decisions(review_revision_id,validation_id,supersedes_decision_id,decision,
      release_scope,evaluator_version,evaluator_sha256,review_authority,reason)
      VALUES(revision_id,validation_id,decision_id,'revoked','production','rollback-test-v1',repeat('c',64),'test','must reject');
    RAISE EXCEPTION 'FAIL: production-scoped decision accepted';
  EXCEPTION WHEN check_violation THEN checks:=checks+1; END;

  INSERT INTO public.route_geometry_review_decisions(review_revision_id,validation_id,supersedes_decision_id,
    decision,evaluator_version,evaluator_sha256,review_authority,reason)
    VALUES(revision_id,validation_id,decision_id,'revoked','rollback-test-v1',repeat('c',64),'test','test-only revoke')
    RETURNING id INTO revoked_id;
  IF public.sde_review_eligible(revision_id,'rollback-test-v1',repeat('c',64)) THEN
    RAISE EXCEPTION 'FAIL: revocation did not remove eligibility';
  END IF;
  checks:=checks+1;
  BEGIN
    INSERT INTO public.route_geometry_review_decisions(review_revision_id,validation_id,supersedes_decision_id,
      decision,evaluator_version,evaluator_sha256,review_authority,reason)
      VALUES(revision_id,validation_id,revoked_id,'approved','rollback-test-v1',repeat('c',64),'test','stale review');
    RAISE EXCEPTION 'FAIL: revocation undone using stale validation';
  EXCEPTION WHEN check_violation THEN checks:=checks+1; END;
  renewed_id:=pg_temp.test_route_review_validation(revision_id,'accepted',true);
  INSERT INTO public.route_geometry_review_decisions(review_revision_id,validation_id,supersedes_decision_id,
    decision,evaluator_version,evaluator_sha256,review_authority,reason)
    VALUES(revision_id,renewed_id,revoked_id,'approved','rollback-test-v1',repeat('c',64),'test','fresh test review');
  IF NOT public.sde_review_eligible(revision_id,'rollback-test-v1',repeat('c',64)) THEN
    RAISE EXCEPTION 'FAIL: fresh explicit review could not restore eligibility';
  END IF;
  checks:=checks+1;
  INSERT INTO route_review_test_results VALUES(checks);
END $$;
SELECT checks AS passing_integration_checks FROM route_review_test_results;
ROLLBACK;
