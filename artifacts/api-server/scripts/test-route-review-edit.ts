/** Real DB save semantics with memory-only evidence files and full rollback. */
import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import { assertReviewDatabase, getReview } from "../src/services/routeReviewAdmin.js";
import { editReview } from "../src/services/routeReviewEdit.js";
import { listMapReviews } from "../src/services/routeMapReview.js";
import type { ReviewFileStore } from "../src/services/routeReviewStorage.js";
const files = new Map<string,Buffer>();
const store: ReviewFileStore = {
  async put(id,file) {
    const objectPath=`memory/${id}/${file.name}`;
    files.set(objectPath,file.bytes);
    return {objectPath,sha256:file.sha256,bytes:file.bytes.length};
  },
  async read(file) { return files.get(file.objectPath)!; },
};
const c=await pool.connect();
try {
  await c.query("BEGIN");
  await assertReviewDatabase(c);
  const {rows:[head]}=await c.query(`SELECT id FROM public.route_geometry_review_revisions ORDER BY created_at DESC,id DESC LIMIT 1`);
  const before=await getReview(c,head.id);
  const originalFeedback=await listMapReviews(c,head.id);
  const coords=(before.revision.geometry as {coordinates:number[][]}).coordinates.slice(1);
  const saved=await editReview(c,head.id,{coordinates:coords,expectedLatestRevisionId:head.id,note:"Rollback-only editor integration"},store);
  const draft=await getReview(c,saved.id);
  assert.equal(draft.revision.canonicalGeometryId,null);
  assert.equal(draft.revision.profileSha256,null);
  assert.equal(draft.revision.eligible,false);
  assert.deepEqual(draft.validations,[]);
  assert.deepEqual(draft.decisions,[]);
  assert.deepEqual(await listMapReviews(c,saved.id),[]);
  assert.deepEqual(draft.revision.geometry,{type:"LineString",coordinates:coords});
  assert.equal((draft.revision.sourceManifest as any[])[0].parentReviewRevisionId,head.id);
  assert.deepEqual(await getReview(c,head.id),before);
  assert.deepEqual(await listMapReviews(c,head.id),originalFeedback);
  await assert.rejects(editReview(c,head.id,{coordinates:coords,expectedLatestRevisionId:head.id},store),(e:any)=>e.status===409);
  console.log("Exact edited geometry persisted; original evidence/feedback unchanged; new binding/profile/approvals absent; stale edit rejected. Rolling back.");
} finally {
  await c.query("ROLLBACK"); c.release();await pool.end();
}
