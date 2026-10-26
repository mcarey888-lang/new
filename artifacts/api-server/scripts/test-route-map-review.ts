/** Transactional integration check. All test feedback is rolled back. */
import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import { assertReviewDatabase, getReview } from "../src/services/routeReviewAdmin.js";
import { listMapReviews, recordMapReview } from "../src/services/routeMapReview.js";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await assertReviewDatabase(client);
  const { rows: [revision] } = await client.query(
    "SELECT id FROM public.route_geometry_review_revisions ORDER BY created_at DESC LIMIT 1");
  assert(revision, "An existing review is required");
  const before = await getReview(client, revision.id);
  const history = await listMapReviews(client, revision.id);
  const first = await recordMapReview(client, revision.id, {
    outcome: "looks_correct", note: "Rollback-only integration check",
    expectedReviewId: history[0]?.id ?? null,
  });
  assert.equal(first.outcome, "looks_correct");
  assert.equal((await listMapReviews(client, revision.id))[0].id, first.id);
  await assert.rejects(recordMapReview(client, revision.id, {
    outcome: "rejected", expectedReviewId: history[0]?.id ?? null,
  }), (e: any) => e.status === 409);
  for (const outcome of ["needs_changes", "rejected"]) {
    const current = await listMapReviews(client, revision.id);
    await recordMapReview(client, revision.id, { outcome, expectedReviewId: current[0].id });
    assert.equal((await listMapReviews(client, revision.id))[0].outcome, outcome);
  }
  await client.query("SAVEPOINT immutable_history");
  await assert.rejects(client.query("UPDATE public.route_geometry_map_reviews SET note='changed' WHERE id=$1", [first.id]),
    /append-only/);
  await client.query("ROLLBACK TO SAVEPOINT immutable_history");
  await assert.rejects(client.query("DELETE FROM public.route_geometry_map_reviews WHERE id=$1", [first.id]),
    /append-only/);
  await client.query("ROLLBACK TO SAVEPOINT immutable_history");
  const after = await getReview(client, revision.id);
  assert.deepEqual(after.validations, before.validations);
  assert.deepEqual(after.decisions, before.decisions);
  const { latestMapReview: previousStatus, ...previousRevision } = before.revision;
  const { latestMapReview: currentStatus, ...currentRevision } = after.revision;
  assert.equal(currentStatus, "rejected");
  assert.deepEqual(currentRevision, previousRevision);
  console.log("Map feedback save/history/stale conflict/immutability checks passed; rollback follows.");
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}
