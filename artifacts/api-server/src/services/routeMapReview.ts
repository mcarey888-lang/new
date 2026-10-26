import type { PoolClient } from "@workspace/db";
import { z } from "zod";
import { ReviewError } from "./routeReviewAdmin.js";

/** This contract is deliberately distinct from validationInput/decisionInput. */
export const mapReviewInput = z.object({
  outcome: z.enum(["looks_correct", "needs_changes", "rejected"]),
  note: z.string().trim().max(2000).optional().default(""),
  expectedReviewId: z.string().uuid().nullable(),
}).strict();

function publicMapReview(row: Record<string, unknown>) {
  return {
    id: row.id, reviewRevisionId: row.review_revision_id,
    outcome: row.outcome, note: row.note, createdAt: row.created_at,
  };
}
export async function listMapReviews(client: PoolClient, revisionId: string) {
  const { rows } = await client.query(`SELECT id,review_revision_id,outcome,note,created_at
    FROM public.route_geometry_map_reviews WHERE review_revision_id=$1
    ORDER BY created_at DESC,id DESC`, [revisionId]);
  return rows.map(publicMapReview);
}

/** Called only inside the guarded development router transaction. */
export async function recordMapReview(client: PoolClient, revisionId: string, raw: unknown) {
  const input = mapReviewInput.parse(raw);
  // Lock the revision, including for its first feedback, to serialize concurrent saves.
  const found = await client.query(`SELECT id FROM public.route_geometry_review_revisions
    WHERE id=$1 FOR UPDATE`, [revisionId]);
  if (!found.rows.length) throw new ReviewError(404, "Review candidate not found.");
  const latest = await client.query(`SELECT id FROM public.route_geometry_map_reviews
    WHERE review_revision_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`, [revisionId]);
  if ((latest.rows[0]?.id ?? null) !== input.expectedReviewId) {
    throw new ReviewError(409, "Stale map review: it changed in another session. Reload the latest review before saving.");
  }
  const { rows: [row] } = await client.query(`INSERT INTO public.route_geometry_map_reviews
    (review_revision_id,outcome,note) VALUES ($1,$2,$3)
    RETURNING id,review_revision_id,outcome,note,created_at`,
  [revisionId, input.outcome, input.note]);
  return publicMapReview(row);
}
