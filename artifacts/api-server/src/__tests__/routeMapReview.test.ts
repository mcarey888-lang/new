import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "@workspace/db";
import { listMapReviews, mapReviewInput, recordMapReview } from "../services/routeMapReview.js";

const id = "2678ccc8-36e2-4077-9748-1e30742f4c3c";
const prior = "59a67af4-ffa0-4cb5-b064-cfe4eff2a82a";
function client(results: unknown[][]) {
  const query = vi.fn();
  for (const rows of results) query.mockResolvedValueOnce({ rows });
  return { c: { query } as unknown as PoolClient, query };
}
describe("independent map review feedback", () => {
  it("accepts optional notes and no technical attestations", () => {
    expect(mapReviewInput.parse({ outcome: "looks_correct", expectedReviewId: null }).note).toBe("");
    for (const outcome of ["looks_correct", "needs_changes", "rejected"]) {
      expect(mapReviewInput.parse({ outcome, expectedReviewId: null }).outcome).toBe(outcome);
    }
  });
  it("rejects unknown outcomes, technical claims, oversize notes and missing concurrency token", () => {
    for (const body of [
      { outcome: "approved", expectedReviewId: null },
      { outcome: "looks_correct", expectedReviewId: null, sourceRightsReviewed: true },
      { outcome: "looks_correct", expectedReviewId: null, note: "x".repeat(2001) },
      { outcome: "looks_correct" },
    ]) expect(mapReviewInput.safeParse(body).success).toBe(false);
  });
  it("saves only feedback, locked to the exact revision", async () => {
    const row = { id: prior, review_revision_id: id, outcome: "looks_correct", note: "", created_at: "2026-10-26" };
    const { c, query } = client([[{ id }], [], [row]]);
    expect(await recordMapReview(c, id, { outcome: "looks_correct", expectedReviewId: null })).toEqual({
      id: prior, reviewRevisionId: id, outcome: "looks_correct", note: "", createdAt: "2026-10-26",
    });
    expect(query.mock.calls[0][0]).toContain("FOR UPDATE");
    expect(query.mock.calls[2][0]).toContain("INSERT INTO public.route_geometry_map_reviews");
    expect(query.mock.calls[2][1]).toEqual([id, "looks_correct", ""]);
    expect(query.mock.calls.map(c => c[0]).join(" ")).not.toMatch(/INSERT INTO public.route_geometry_review_(validations|decisions)|UPDATE public\./);
  });
  it("rejects stale sessions without writing", async () => {
    const { c, query } = client([[{ id }], [{ id: prior }]]);
    await expect(recordMapReview(c, id, { outcome: "rejected", expectedReviewId: null })).rejects.toMatchObject({ status: 409 });
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("rejects missing revisions without writing", async () => {
    const { c, query } = client([[]]);
    await expect(recordMapReview(c, id, { outcome: "looks_correct", expectedReviewId: null })).rejects.toMatchObject({ status: 404 });
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("returns saved history in client shape", async () => {
    const { c } = client([[{ id: prior, review_revision_id: id, outcome: "needs_changes", note: "Start here", created_at: "2026-10-26" }]]);
    expect(await listMapReviews(c, id)).toEqual([{ id: prior, reviewRevisionId: id, outcome: "needs_changes", note: "Start here", createdAt: "2026-10-26" }]);
  });
});
