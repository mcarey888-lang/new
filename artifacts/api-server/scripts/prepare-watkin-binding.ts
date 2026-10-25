/**
 * Explicit development preparation only. Default: rollback all database writes.
 * --commit keeps NEW needs-review records; never updates an existing catalogue
 * record, marks anything verified, approves a route, or uses ENGINE_DATABASE_URL.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "@workspace/db";
import { assertReviewDatabase, importReview, getReview, validateReview } from "../src/services/routeReviewAdmin";
import { sha256, type EvidenceFile } from "../src/services/routeReviewEvidence";
import { reviewFileStore } from "../src/services/routeReviewStorage";
import { validatePilotEvidence, type PilotCandidate, type PilotSnapshot } from "./routePilotEvidence";

const root = resolve(import.meta.dirname, "../../..");
const commit = process.argv.includes("--commit");
const source = resolve(root, "generated-artifacts/route-pilot/watkin-v13-536c6c70dd48-20261025T193644Z");
const profileDir = resolve(root, "generated-artifacts/route-profile/watkin-4363b367997a-2026-10-25T19-51-45-606Z");
const [candidateBytes, geometryBytes, sourceBytes, profileBytes, terrainBytes, rightsBytes] = await Promise.all([
  readFile(resolve(source, "candidate.json")), readFile(resolve(source, "proposed-route.geojson")),
  readFile(resolve(source, "source-snapshot.json")), readFile(resolve(profileDir, "profile.json")),
  readFile(resolve(profileDir, "terrain-manifest.json")),
  readFile(resolve(root, "generated-artifacts/terrain-rights/watkin-06c6eef21a8d.json")),
]);
const candidate = JSON.parse(candidateBytes.toString()) as PilotCandidate & {
  catalogueMountain: { id: string; name: string; elevationM: number; latitude: number; longitude: number };
  capturedAt: string;
};
const original = JSON.parse(sourceBytes.toString()) as PilotSnapshot & { sourceUrl?: string };
const checks = validatePilotEvidence(candidate, geometryBytes, sourceBytes);
const profile = JSON.parse(profileBytes.toString());
const rights = JSON.parse(rightsBytes.toString());
assert.equal(profile.geometrySha256, sha256(geometryBytes));
assert.equal(profile.sourceSnapshotSha256, sha256(sourceBytes));
assert.equal(rights.originalManifestSha256, sha256(terrainBytes));
assert.equal(checks.accessReviewFlags.length, 0, "Access flags need explicit review before preparing this pilot.");
const geometry = { type: "LineString", coordinates: checks.coordinates };
const key = "Snowdon via Watkin Path — pilot";
const revisionVersion = "13-profile-2-linked-draft";
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout='15s'");
  await assertReviewDatabase(client);
  await client.query("SELECT pg_advisory_xact_lock(hashtext('development-watkin-binding'))");
  const existing = await client.query("SELECT id FROM public.route_geometry_review_revisions WHERE candidate_key=$1 AND revision_version=$2", [key, revisionVersion]);
  if (existing.rows.length) {
    const detail = await getReview(client, existing.rows[0].id);
    assert.equal(detail.revision.eligible, false);
    console.log(JSON.stringify({ alreadyPrepared: true, reviewId: existing.rows[0].id, approved: false }));
    await client.query("ROLLBACK");
  } else {
    const { rows: [mountain] } = await client.query(`SELECT id,name,status,elevation_m,
      public.ST_X(geom) AS longitude,public.ST_Y(geom) AS latitude FROM public.mountains WHERE id=$1 FOR SHARE`, [candidate.catalogueMountain.id]);
    assert.ok(mountain, "Exact pilot mountain is absent in development.");
    assert.equal(mountain.name, candidate.catalogueMountain.name);
    assert.equal(Number(mountain.elevation_m), candidate.catalogueMountain.elevationM);
    assert.ok(Math.abs(Number(mountain.latitude)-candidate.catalogueMountain.latitude)<0.00001);
    assert.ok(Math.abs(Number(mountain.longitude)-candidate.catalogueMountain.longitude)<0.00001);
    const [identityId, definitionId, geometryId, bundleId] = Array.from({length:4}, () => randomUUID());
    const version = "dev-watkin-osm-v13-1";
    const reviewSummary = {
      format: "summitready-route-review-summary-v1", mountain: candidate.catalogueMountain,
      routeKind: "Proposed out-and-back", routeStatus: "needs_review", mountainStatus: mountain.status,
      sourceCapturedAt: candidate.capturedAt, sourceEdgesChecked: checks.sourceEdgesChecked,
      sourceWayCount: checks.usedSourceWays, accessFlagsFound: checks.accessReviewFlags.length,
      existingExpeditionDistanceKm: candidate.distance.existingExpeditionDistanceKm,
      existingExpeditionAscentM: candidate.distance.existingExpeditionAscentM,
      terrainSourceFamily: "EU-DEM", terrainEditionConfirmed: rights.datasetEditionProvenByHeaders,
      terrainObligations: rights.obligations, preparedAt: new Date().toISOString(),
      note: "New development draft only. Existing catalogue status and expedition facts were not changed. No rights or access approval.",
    };
    await client.query(`INSERT INTO public.route_identities(id,mountain_id,identity_key,version,canonical_name,status)
      VALUES($1,$2,$3,$4,'Watkin Path — proposed out-and-back (development draft)','needs_review')`,
      [identityId,mountain.id,`development-pilot:${candidate.candidateId}`,version]);
    await client.query(`INSERT INTO public.route_definitions(id,route_identity_id,version,description,status)
      VALUES($1,$2,$3,'Unapproved development Watkin pilot; original OSM edges; proposed out-and-back. Not navigation-ready.','needs_review')`,
      [definitionId,identityId,version]);
    await client.query(`INSERT INTO public.route_geometries(id,route_definition_id,version,geom,derivation_method)
      VALUES($1,$2,$3,public.ST_SetSRID(public.ST_GeomFromGeoJSON($4),4326),'development-osm-pilot-unapproved')`,
      [geometryId,definitionId,version,JSON.stringify(geometry)]);
    // Commit mode uses private durable storage. A rollback rehearsal uses no
    // external writes and cannot leave a retained source reference.
    const sourceFile = commit
      ? await reviewFileStore.put(bundleId!, { name:"source-snapshot",bytes:sourceBytes,sha256:sha256(sourceBytes) })
      : { objectPath:"development-rollback-rehearsal-only",sha256:sha256(sourceBytes),bytes:sourceBytes.length };
    await client.query(`INSERT INTO public.source_bundles(id,source_type,provider,source_url,licence,local_path,sha256,size_bytes,retrieved_at,provenance_version,metadata)
      VALUES($1,'osm_pilot_snapshot','OpenStreetMap',$2,'ODbL-1.0',$3,$4,$5,$6,$7,$8::jsonb)`,
      [bundleId,original.sourceUrl ?? `https://www.openstreetmap.org/relation/${candidate.source.relationId}`,
        sourceFile.objectPath,sha256(sourceBytes),sourceBytes.length,candidate.capturedAt,version,
        JSON.stringify({reviewSummary,attribution:original.attribution,rightsReviewComplete:false,
          relationId:candidate.source.relationId,relationVersion:candidate.source.relationVersion})]);
    const ways = new Map(original.ways.map(w=>[w.id,w]));
    const segments: { wayId:string; wayVersion:string; fromNode:string; toNode:string; direction:number }[] = [];
    for (const edge of candidate.orderedSourceEdges) {
      const way = ways.get(edge.wayId)!;
      const start = way.nodes.indexOf(edge.fromNode);
      const direction = way.nodes[start+1] === edge.toNode ? 1 : -1;
      const previous = segments.at(-1);
      if (previous?.wayId===edge.wayId && previous.wayVersion===edge.wayVersion
        && previous.direction===direction && previous.toNode===edge.fromNode) previous.toNode=edge.toNode;
      else segments.push({...edge,direction});
    }
    await client.query(`INSERT INTO public.route_geometry_members(id,route_geometry_id,source_bundle_id,sequence,source_member_type,source_member_id,direction)
      SELECT gen_random_uuid(),$1,$2,(x.ordinality-1)::integer,'osm-way-segment',
      x.value->>'member',(x.value->>'direction')::integer
      FROM jsonb_array_elements($3::jsonb) WITH ORDINALITY AS x(value,ordinality)`,
      [geometryId,bundleId,JSON.stringify(segments.map(s=>({member:`${s.wayId}@${s.wayVersion}:${s.fromNode}:${s.toNode}`,direction:s.direction})))]);
    const { rows:[manifest] } = await client.query("SELECT public.sde_review_source_manifest($1) AS value",[geometryId]);
    const memory = new Map<string,Buffer>();
    const rehearsalStore = {
      async put(id:string,file:EvidenceFile){const path=`${id}/${file.name}`;memory.set(path,file.bytes);return {objectPath:path,sha256:file.sha256,bytes:file.bytes.length};},
      async read(file:{objectPath:string}){const bytes=memory.get(file.objectPath);assert.ok(bytes);return bytes;},
    };
    const store = commit ? reviewFileStore : rehearsalStore;
    const result = await importReview(client,{
      candidateKey:key,revisionVersion,canonicalGeometryId:geometryId,sourceManifest:manifest.value,
      geometryFile:geometryBytes.toString(),profileFile:profileBytes.toString(),terrainManifestFile:terrainBytes.toString(),
    },store,[{name:"source-snapshot",bytes:sourceBytes,sha256:sha256(sourceBytes)},
      {name:"terrain-rights",bytes:rightsBytes,sha256:sha256(rightsBytes)}]);
    await validateReview(client,result.id,{outcome:"needs_review",sourceRightsReviewed:false,routeAccessReviewed:false,
      terrainRightsReviewed:false,profileReviewed:false,authority:"Development preparation (automated; not human approval)",
      reason:"Exact draft geometry and source segments linked. Peak remains imported, route/definition need review, reuse evidence is not approved. Existing records unchanged."},store);
    const detail = await getReview(client,result.id);
    assert.equal(detail.revision.canonicalGeometryId,geometryId);
    assert.equal(detail.revision.bindingCurrent,false);
    assert.equal(detail.revision.eligible,false);
    assert.equal(detail.decisions.length,0);
    await assert.rejects(() => validateReview(client,result.id,{
      outcome:"accepted",sourceRightsReviewed:true,routeAccessReviewed:true,terrainRightsReviewed:true,profileReviewed:true,
      authority:"GUARD TEST ONLY — must not persist",reason:"Verify draft cannot be accepted.",
      validUntil:new Date(Date.now()+3600000).toISOString(),
    },store), /current verified canonical binding/);
    const {rows:[unchanged]} = await client.query("SELECT status FROM public.mountains WHERE id=$1",[mountain.id]);
    assert.equal(unchanged.status,mountain.status);
    await client.query(commit ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({mode:commit?"development-draft-committed":"rehearsal-rolled-back",
      reviewId:result.id,canonicalGeometryId:geometryId,sourceSegments:segments.length,sourceWays:checks.usedSourceWays,
      sourceEdgesChecked:checks.sourceEdgesChecked,mountainStatusUnchanged:mountain.status,approved:false}));
  }
} catch(error) { await client.query("ROLLBACK");throw error; }
finally { client.release();await pool.end(); }
