import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PoolClient } from "@workspace/db";
import { checkEvidence, sha256, validationInput, decisionInput, type CheckedEvidence } from "./routeReviewEvidence.js";
import { reviewFileStore, type ReviewFileStore, type StoredReviewFile } from "./routeReviewStorage.js";

export class ReviewError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const reviewDevelopmentEnabled = () =>
  process.env.NODE_ENV === "development" && process.env.REPLIT_DEPLOYMENT !== "1";

/** This is the application DEVELOPMENT review store, not a canonical read fallback. */
export async function assertReviewDatabase(client: PoolClient) {
  if (!reviewDevelopmentEnabled()) throw new ReviewError(404, "Development review is unavailable.");
  const { rows: [row] } = await client.query(`SELECT current_database() AS name,
    to_regclass('public.route_geometry_review_revisions') IS NOT NULL AS installed`);
  if (row.name !== "heliumdb" || !row.installed) throw new ReviewError(503, "Confirmed development review storage is unavailable.");
}
let policy: { version: string; sha256: string } | undefined;
export async function reviewPolicy() {
  if (!policy) {
    const files = ["./routeReviewEvidence.ts", "./routeReviewAdmin.ts", "./routing/profile.ts", "./routing/terrain.ts"];
    // The managed dev command runs the bundled dist/index.mjs from the package
    // working directory. import.meta.url therefore points at dist, not src.
    const sourceRoot = resolve(process.cwd(), "src/services");
    const inputs = await Promise.all(files.map(file => readFile(resolve(sourceRoot, file))));
    policy = { version: "route-admin-review-v1", sha256: sha256(Buffer.concat(inputs)) };
  }
  return policy;
}
function publicRow(row: Record<string, any>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) =>
    [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value]));
}
const baseSelect = `SELECT to_jsonb(r)-'geometry_snapshot' AS data,
  public.sde_review_binding_current(r.id) AS binding_current,
  public.sde_review_eligible(r.id,$1,$2) AS eligible,
  (SELECT decision FROM public.route_geometry_review_decisions WHERE review_revision_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1) AS latest_decision,
  (SELECT id FROM public.route_geometry_review_decisions WHERE review_revision_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1) AS latest_decision_id,
  (SELECT id FROM public.route_geometry_review_validations WHERE review_revision_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1) AS latest_validation_id`;
function summary(row: Record<string, any>) {
  const { data, ...rest } = row;
  const safe = { ...data };
  // Never disclose bucket paths to the browser; downloads go through admin guard.
  if (safe.review_file_hashes?.files) safe.review_file_hashes = {
    ...safe.review_file_hashes,
    files: Object.fromEntries(Object.entries(safe.review_file_hashes.files).map(([name, file]) => {
      const { sha256, bytes } = file as StoredReviewFile;
      return [name, { sha256, bytes }];
    })),
  };
  return publicRow({ ...safe, ...rest });
}
export async function listReviews(client: PoolClient) {
  const p = await reviewPolicy();
  const { rows } = await client.query(`${baseSelect} FROM public.route_geometry_review_revisions r
    ORDER BY r.created_at DESC,r.id DESC LIMIT 200`, [p.version, p.sha256]);
  return { environment: "development" as const, evaluator: p, items: rows.map(summary) };
}
export async function getReview(client: PoolClient, id: string) {
  const p = await reviewPolicy();
  const { rows: [row] } = await client.query(`${baseSelect},
    public.ST_AsGeoJSON(r.geometry_snapshot)::json AS geometry
    FROM public.route_geometry_review_revisions r WHERE r.id=$3`, [p.version, p.sha256, id]);
  if (!row) throw new ReviewError(404, "Review candidate not found.");
  const validations = await client.query(`SELECT * FROM public.route_geometry_review_validations
    WHERE review_revision_id=$1 ORDER BY created_at DESC,id DESC`, [id]);
  const decisions = await client.query(`SELECT * FROM public.route_geometry_review_decisions
    WHERE review_revision_id=$1 ORDER BY created_at DESC,id DESC`, [id]);
  return { revision: summary(row), validations: validations.rows.map(publicRow), decisions: decisions.rows.map(publicRow) };
}
export async function previewReview(client: PoolClient, raw: unknown): Promise<CheckedEvidence> {
  const checked = checkEvidence(raw);
  if (!checked.valid || !checked.input || !checked.geometry) return checked;
  const { rows: duplicate } = await client.query(`SELECT id FROM public.route_geometry_review_revisions
    WHERE candidate_key=$1 AND revision_version=$2`, [checked.input.candidateKey, checked.input.revisionVersion]);
  if (duplicate.length) checked.errors.push("This candidate key/revision already exists. Use a new revision; history cannot be overwritten.");
  if (checked.input.canonicalGeometryId) {
    const { rows: [binding] } = await client.query(`SELECT g.id,
      public.ST_AsEWKB(g.geom,'XDR')=public.ST_AsEWKB(public.ST_SetSRID(public.ST_GeomFromGeoJSON($2),4326),'XDR') AS geometry_matches,
      public.sde_review_source_manifest(g.id)=$3::jsonb AS manifest_matches
      FROM public.route_geometries g WHERE g.id=$1`,
    [checked.input.canonicalGeometryId, JSON.stringify(checked.geometry), JSON.stringify(checked.input.sourceManifest)]);
    if (!binding) checked.errors.push("Canonical geometry does not exist in development. No canonical route is created by this import.");
    else {
      if (!binding.geometry_matches) checked.errors.push("Uploaded coordinates/order differ from the bound canonical geometry.");
      if (!binding.manifest_matches) checked.errors.push("Source manifest is not the exact current canonical member/provenance snapshot.");
      checked.warnings.push("Canonical bytes and manifest are compared here. Full rights/status binding is checked by the database after saving.");
    }
  }
  checked.valid = checked.errors.length === 0;
  return checked;
}
export function previewResponse(checked: CheckedEvidence) {
  const { files, geometry: _geometry, input: _input, ...response } = checked;
  return { ...response, files: files.map(f => ({ name: f.name, sha256: f.sha256, bytes: f.bytes.length })) };
}
export async function importReview(client: PoolClient, raw: unknown, store: ReviewFileStore = reviewFileStore) {
  const checked = await previewReview(client, raw);
  if (!checked.valid || !checked.input || !checked.geometry) throw new ReviewError(400, checked.errors.join(" "));
  const id = randomUUID(), input = checked.input;
  const files: Record<string, StoredReviewFile> = {};
  // A failed transaction can leave private orphan objects, but never a committed
  // revision pointing to missing evidence. Objects are immutable, UUID-namespaced.
  for (const file of checked.files) files[file.name] = await store.put(id, file);
  const profile = files.profile;
  const { rows: [binding] } = input.canonicalGeometryId ? await client.query(`SELECT g.version,
    g.route_definition_id,rd.version AS definition_version
    FROM public.route_geometries g JOIN public.route_definitions rd ON rd.id=g.route_definition_id
    WHERE g.id=$1`, [input.canonicalGeometryId]) : { rows: [] };
  await client.query(`INSERT INTO public.route_geometry_review_revisions
    (id,candidate_key,revision_version,geometry_snapshot,source_manifest,canonical_geometry_id,
     canonical_geometry_version,route_definition_id,definition_version,
     profile_sha256,terrain_manifest_sha256,profile_method_version,review_file_hashes)
    VALUES ($1,$2,$3,public.ST_SetSRID(public.ST_GeomFromGeoJSON($4),4326),$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
  [id, input.candidateKey, input.revisionVersion, JSON.stringify(checked.geometry),
    JSON.stringify(input.sourceManifest), input.canonicalGeometryId ?? null,
    binding?.version ?? null, binding?.route_definition_id ?? null, binding?.definition_version ?? null,
    profile?.sha256 ?? null, files["terrain-manifest"]?.sha256 ?? null,
    profile ? "summitready-terrain-profile-review-v1/30m" : null,
    JSON.stringify({ format: "summitready-route-admin-v1", files })]);
  return { id };
}
async function revision(client: PoolClient, id: string) {
  const { rows: [row] } = await client.query(`SELECT * FROM public.route_geometry_review_revisions WHERE id=$1 FOR UPDATE`, [id]);
  if (!row) throw new ReviewError(404, "Review candidate not found.");
  return row;
}
export async function loadReviewFile(client: PoolClient, id: string, name: string, store: ReviewFileStore = reviewFileStore) {
  const { rows: [row] } = await client.query(`SELECT review_file_hashes FROM public.route_geometry_review_revisions WHERE id=$1`, [id]);
  const file = row?.review_file_hashes?.files?.[name] as StoredReviewFile | undefined;
  if (!file) throw new ReviewError(404, "Review evidence file is unavailable.");
  return store.read(file);
}
export async function validateReview(client: PoolClient, id: string, raw: unknown, store: ReviewFileStore = reviewFileStore) {
  const input = validationInput.parse(raw), row = await revision(client, id);
  const files = row.review_file_hashes?.files;
  if (!files?.geometry) throw new ReviewError(409, "This revision has no supported immutable evidence files. Import a new review revision.");
  const rawInput = {
    candidateKey: row.candidate_key, revisionVersion: row.revision_version,
    sourceManifest: row.source_manifest,
    geometryFile: (await store.read(files.geometry)).toString("utf8"),
    ...(row.canonical_geometry_id ? { canonicalGeometryId: row.canonical_geometry_id } : {}),
    ...(files.profile ? { profileFile: (await store.read(files.profile)).toString("utf8"),
      terrainManifestFile: (await store.read(files["terrain-manifest"])).toString("utf8") } : {}),
  };
  const checked = checkEvidence(rawInput);
  if (!checked.valid || !checked.geometry) throw new ReviewError(409, "Stored evidence failed integrity/structure checks. Import a new revision.");
  const { rows: [matches] } = await client.query(`SELECT
    encode(sha256(public.ST_AsEWKB(public.ST_SetSRID(public.ST_GeomFromGeoJSON($2),4326),'XDR')),'hex')=geometry_sha256 AS exact,
    public.sde_review_binding_current(id) AS bound
    FROM public.route_geometry_review_revisions WHERE id=$1`, [id, JSON.stringify(checked.geometry)]);
  if (!matches.exact || (files.profile?.sha256 ?? null) !== row.profile_sha256
    || (files["terrain-manifest"]?.sha256 ?? null) !== row.terrain_manifest_sha256) {
    throw new ReviewError(409, "Stored file digests no longer match the database revision.");
  }
  if (input.outcome === "accepted") {
    if (!matches.bound) throw new ReviewError(409, "Acceptance needs a current verified canonical binding with exact reusable-rights evidence.");
    if (!input.sourceRightsReviewed || !input.routeAccessReviewed) throw new ReviewError(400, "Explicit source-rights and route/access review are required.");
    if (row.profile_sha256 && (!checked.elevationCoverageComplete || !input.terrainRightsReviewed || !input.profileReviewed)) {
      throw new ReviewError(400, "Profile acceptance requires complete matching samples and explicit terrain-rights/profile review.");
    }
    const expiry = input.validUntil ? Date.parse(input.validUntil) : NaN;
    if (!Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 366 * 86400000) {
      throw new ReviewError(400, "Set a future expiry within one year for an accepted review.");
    }
  }
  const policy = await reviewPolicy();
  const { rows: [saved] } = await client.query(`INSERT INTO public.route_geometry_review_validations
    (review_revision_id,geometry_sha256,source_manifest_sha256,profile_sha256,terrain_manifest_sha256,
     evaluator_version,evaluator_sha256,outcome,structural_checks_passed,source_rights_reviewed,
     route_access_reviewed,terrain_rights_reviewed,elevation_coverage_complete,profile_reviewed,
     review_authority,reviewed_at,valid_until,diagnostics)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11,$12,$13,$14,clock_timestamp(),$15,$16::jsonb) RETURNING id`,
  [id, row.geometry_sha256, row.source_manifest_sha256, row.profile_sha256, row.terrain_manifest_sha256,
    policy.version, policy.sha256, input.outcome, input.sourceRightsReviewed, input.routeAccessReviewed,
    input.terrainRightsReviewed, checked.elevationCoverageComplete, input.profileReviewed,
    input.authority, input.validUntil ?? null, JSON.stringify([input.reason, ...checked.warnings, ...checked.blockers])]);
  return { id: saved.id as string };
}
export async function decideReview(client: PoolClient, id: string, raw: unknown) {
  const input = decisionInput.parse(raw);
  await revision(client, id);
  const { rows: [previous] } = await client.query(`SELECT * FROM public.route_geometry_review_decisions
    WHERE review_revision_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`, [id]);
  if ((previous?.id ?? null) !== input.expectedDecisionId) throw new ReviewError(409, "Review changed in another session. Reload before deciding.");
  if (input.decision === "revoked" && (!previous || previous.decision !== "approved" || input.validationId !== previous.validation_id)) {
    throw new ReviewError(409, "Revoke the current approval using its validation, not an unrelated review.");
  }
  const p = await reviewPolicy();
  const { rows: [saved] } = await client.query(`INSERT INTO public.route_geometry_review_decisions
    (review_revision_id,validation_id,supersedes_decision_id,decision,release_scope,
     evaluator_version,evaluator_sha256,review_authority,reason)
    VALUES ($1,$2,$3,$4,'development',$5,$6,$7,$8) RETURNING id`,
  [id, input.validationId, input.expectedDecisionId, input.decision, p.version, p.sha256, input.authority, input.reason]);
  return { id: saved.id as string };
}
