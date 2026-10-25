import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { assertReviewDatabase, previewReview, importReview, getReview, validateReview, decideReview, loadReviewFile, reviewDevelopmentEnabled } from "./routeReviewAdmin.js";
import { sha256 } from "./routeReviewEvidence.js";
import { reviewFileStore, type ReviewFileStore, type StoredReviewFile } from "./routeReviewStorage.js";

test("development route review: real PostgreSQL workflow, all records rolled back", {
  skip: process.env.RUN_ROUTE_REVIEW_INTEGRATION !== "1",
}, async t => {
  const client = await pool.connect();
  const memory = new Map<string, Buffer>();
  const store: ReviewFileStore = {
    async put(id, file) {
      const objectPath = `${id}/${file.name}`; memory.set(objectPath, file.bytes);
      return { objectPath, sha256: file.sha256, bytes: file.bytes.length };
    },
    async read(file) {
      const bytes = memory.get(file.objectPath);
      if (!bytes || sha256(bytes) !== file.sha256 || bytes.length !== file.bytes) throw new Error("Integrity failure");
      return bytes;
    },
  };
  async function rejected(fn: () => Promise<unknown>, pattern: RegExp) {
    await client.query("SAVEPOINT test_reject");
    try { await assert.rejects(fn, pattern); }
    finally {
      await client.query("ROLLBACK TO SAVEPOINT test_reject");
      await client.query("RELEASE SAVEPOINT test_reject");
    }
  }
  const geometry = { type: "LineString", coordinates: [[-4,53],[-4.001,53.001],[-4.002,53.003]] };
  const input = { candidateKey: `TEST ONLY ${randomUUID()}`, revisionVersion: "v1",
    geometryFile: JSON.stringify(geometry), sourceManifest: [{ testOnly: true }] };
  const draft = { outcome: "needs_review", sourceRightsReviewed: false, routeAccessReviewed: false,
    terrainRightsReviewed: false, profileReviewed: false, authority: "ROLLBACK TEST", reason: "TEST ONLY - not real evidence" };
  try {
    await client.query("BEGIN"); await assertReviewDatabase(client);
    await t.test("production gate stays closed", () => {
      const before = process.env.NODE_ENV;
      process.env.NODE_ENV = "production"; assert.equal(reviewDevelopmentEnabled(), false);
      process.env.NODE_ENV = before;
    });
    const candidate = await importReview(client, input, store);
    await t.test("immutable import, download, detail, duplicate and no eligibility", async () => {
      const detail = await getReview(client, candidate.id);
      assert.equal(detail.revision.candidateKey, input.candidateKey);
      assert.equal(detail.revision.eligible, false);
      assert.equal(detail.revision.canonicalGeometryId, null);
      assert.equal((await loadReviewFile(client, candidate.id, "geometry", store)).toString(), input.geometryFile);
      assert.equal((detail.revision.reviewFileHashes as any).files.geometry.objectPath, undefined);
      assert.equal((await previewReview(client, input)).valid, false);
      await rejected(() => importReview(client, input, store), /already exists/);
    });
    const pending = await validateReview(client, candidate.id, draft, store);
    await t.test("unbound reviews persist but acceptance and approval fail closed", async () => {
      assert.equal((await getReview(client, candidate.id)).validations[0]?.outcome, "needs_review");
      await rejected(() => validateReview(client, candidate.id, { ...draft, outcome: "accepted",
        sourceRightsReviewed: true, routeAccessReviewed: true, validUntil: new Date(Date.now()+3600000).toISOString() }, store), /canonical binding/);
      await rejected(() => decideReview(client, candidate.id, { decision: "approved", validationId: pending.id,
        expectedDecisionId: null, authority: "TEST", reason: "TEST ONLY" }), /accepted|approval|validation/i);
    });
    const ids = Array.from({ length: 5 }, () => randomUUID());
    const [identity, definition, geometryId, bundle, evidence] = ids as [string,string,string,string,string];
    const { rows: [mountain] } = await client.query("SELECT id FROM public.mountains WHERE status::text='verified' ORDER BY id LIMIT 1");
    const sourceUrl = `https://example.invalid/rollback-only/${bundle}`;
    await client.query(`INSERT INTO public.route_identities(id,mountain_id,identity_key,version,canonical_name,status)
      VALUES ($1,$2,$3,'rollback-v1','ROLLBACK TEST ONLY','verified')`, [identity, mountain.id, `rollback:${identity}`]);
    await client.query(`INSERT INTO public.route_definitions(id,route_identity_id,version,description,status)
      VALUES ($1,$2,'rollback-v1','ROLLBACK TEST ONLY','verified')`, [definition, identity]);
    await client.query(`INSERT INTO public.route_geometries(id,route_definition_id,version,geom,derivation_method)
      VALUES ($1,$2,'rollback-v1',ST_SetSRID(ST_GeomFromGeoJSON($3),4326),'rollback-test-only')`, [geometryId, definition, JSON.stringify(geometry)]);
    await client.query(`INSERT INTO public.source_bundles(id,source_type,provider,source_url,licence,local_path,sha256,size_bytes,retrieved_at,provenance_version)
      VALUES ($1,'qa_test','rollback-test',$2,'TEST ONLY','rollback-only',repeat('a',64),0,clock_timestamp(),'rollback-v1')`, [bundle, sourceUrl]);
    await client.query(`INSERT INTO public.evidence_sources(id,source_key,version,publisher,title,url,rights_classification,rights_statement,geometry_reuse_allowed,retrieved_at)
      VALUES ($1,$2,'rollback-v1','rollback-test','TEST ONLY',$3,'reusable_geometry','TEST ONLY',true,clock_timestamp())`, [evidence, `rollback:${evidence}`, sourceUrl]);
    await client.query(`INSERT INTO public.route_geometry_members(id,route_geometry_id,source_bundle_id,sequence,source_member_type,source_member_id,direction)
      VALUES (gen_random_uuid(),$1,$2,0,'test_way','rollback-only',1)`, [geometryId, bundle]);
    const { rows: [manifest] } = await client.query("SELECT public.sde_review_source_manifest($1) AS value", [geometryId]);
    const bound = await importReview(client, { ...input, candidateKey: `${input.candidateKey} bound`,
      canonicalGeometryId: geometryId, sourceManifest: manifest.value }, store);
    const acceptedInput = { ...draft, outcome: "accepted", sourceRightsReviewed: true, routeAccessReviewed: true,
      validUntil: new Date(Date.now()+3600000).toISOString() };
    const accepted = await validateReview(client, bound.id, acceptedInput, store);
    const approval = await decideReview(client, bound.id, { decision: "approved", validationId: accepted.id,
      expectedDecisionId: null, authority: "ROLLBACK TEST", reason: "TEST ONLY" });
    await t.test("bound explicit approval has development eligibility only", async () => {
      assert.equal((await getReview(client, bound.id)).revision.eligible, true);
    });
    const revoke = await decideReview(client, bound.id, { decision: "revoked", validationId: accepted.id,
      expectedDecisionId: approval.id, authority: "ROLLBACK TEST", reason: "TEST ONLY revoke" });
    await t.test("revocation, stale decisions and old validation cannot silently restore approval", async () => {
      assert.equal((await getReview(client, bound.id)).revision.eligible, false);
      await rejected(() => decideReview(client, bound.id, { decision: "approved", validationId: accepted.id,
        expectedDecisionId: approval.id, authority: "TEST", reason: "TEST" }), /another session/);
      await rejected(() => decideReview(client, bound.id, { decision: "approved", validationId: accepted.id,
        expectedDecisionId: revoke.id, authority: "TEST", reason: "TEST" }), /Approval requires a current accepted validation/);
      const renewed = await validateReview(client, bound.id, acceptedInput, store);
      await decideReview(client, bound.id, { decision: "approved", validationId: renewed.id,
        expectedDecisionId: revoke.id, authority: "TEST", reason: "TEST ONLY renewed" });
      assert.equal((await getReview(client, bound.id)).decisions.length, 3);
    });
    await t.test("altered evidence bytes cannot be reviewed", async () => {
      memory.set(`${candidate.id}/geometry`, Buffer.from("changed"));
      await rejected(() => validateReview(client, candidate.id, draft, store), /Integrity/);
    });
  } finally {
    await client.query("ROLLBACK"); client.release(); await pool.end();
  }
});

test("private App Storage original-file round trip (one isolated development test object)", {
  skip: process.env.RUN_ROUTE_REVIEW_STORAGE !== "1",
}, async () => {
  const bytes = Buffer.from('{"testOnly":true,"public":false}');
  const saved: StoredReviewFile = await reviewFileStore.put(randomUUID(), { name: "geometry", bytes, sha256: sha256(bytes) });
  assert.deepEqual(await reviewFileStore.read(saved), bytes);
});
