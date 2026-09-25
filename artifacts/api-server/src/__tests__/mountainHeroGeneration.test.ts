import { describe, expect, it } from "vitest";
import {
  applyMountainHeroRejection,
  isApprovalRecordForRejectedImage,
  isGeneratedMountainCandidateOwnedBy,
  readyGeneratedReviewIds,
  withoutRejectedMountainHeroCandidate,
  type MountainHeroCandidate,
  type MountainHeroGenerationRecord,
} from "../services/artwork/mountainHeroReview.js";
import { isMountainHeroImageRejected } from "../services/artwork/mountainHeroReviewState.js";

const mountainId = "01b2c3d4-e5f6-4789-a012-3456789abcde";
const candidate: MountainHeroCandidate = {
  id: "job-123",
  title: "Test Mountain — AI-generated illustration (not a photograph)",
  imageUrl: `/api/artwork/mountains/${mountainId}/generated/job-123`,
  sourcePageUrl: `/api/artwork/mountains/${mountainId}/generated/job-123`,
  source: "AI-generated illustration",
  width: 1536,
  height: 1024,
  license: null,
  artist: "Generated with test-provider",
  score: 0,
};

describe("generated mountain candidate ownership", () => {
  it("accepts only the exact stored candidate for its mountain", () => {
    expect(isGeneratedMountainCandidateOwnedBy(candidate, mountainId, candidate)).toBe(true);
  });

  it("rejects a candidate generated for another mountain", () => {
    const otherMountainCandidate = {
      ...candidate,
      imageUrl: "/api/artwork/mountains/another-mountain/generated/job-123",
      sourcePageUrl: "/api/artwork/mountains/another-mountain/generated/job-123",
    };
    expect(isGeneratedMountainCandidateOwnedBy(otherMountainCandidate, mountainId, otherMountainCandidate)).toBe(false);
  });

  it("rejects arbitrary or tampered AI candidate data", () => {
    expect(isGeneratedMountainCandidateOwnedBy(
      { ...candidate, imageUrl: "https://example.com/arbitrary.jpg" },
      mountainId,
      candidate,
    )).toBe(false);
    expect(isGeneratedMountainCandidateOwnedBy(
      { ...candidate, id: "different-job" },
      mountainId,
      candidate,
    )).toBe(false);
  });
});

describe("rejected generated candidate visibility", () => {
  it("omits a rejected candidate from the generation status fallback", () => {
    const generation: MountainHeroGenerationRecord = {
      status: "ready",
      jobId: candidate.id,
      updatedAt: "2026-01-01T00:00:00.000Z",
      candidate,
    };

    expect(withoutRejectedMountainHeroCandidate(generation, [candidate.imageUrl])).toEqual({
      status: "ready",
      jobId: candidate.id,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("unpublishes a rejected current approval while retaining the rejection record", () => {
    const result = applyMountainHeroRejection({
      status: "approved",
      imageUrl: candidate.imageUrl,
      selected: candidate,
      rejectedUrls: [],
      updatedAt: "2026-01-01T00:00:00.000Z",
    }, candidate.imageUrl, "2026-01-02T00:00:00.000Z");

    expect(result.unpublished).toBe(true);
    expect(result.record).toEqual({
      status: "pending",
      rejectedUrls: [candidate.imageUrl],
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("removes only an ID-bound approval matching the rejected URL", () => {
    const approval = JSON.stringify({ mountainId, imageUrl: candidate.imageUrl });
    expect(isApprovalRecordForRejectedImage(approval, mountainId, candidate.imageUrl)).toBe(true);
    expect(isApprovalRecordForRejectedImage(
      JSON.stringify({ mountainId: "11b2c3d4-e5f6-4789-a012-3456789abcde", imageUrl: candidate.imageUrl }),
      mountainId,
      candidate.imageUrl,
    )).toBe(false);
    expect(isApprovalRecordForRejectedImage(
      JSON.stringify({ mountainId, imageUrl: "different-image" }),
      mountainId,
      candidate.imageUrl,
    )).toBe(false);
  });

  it("blocks a rejected generated URL from approval and auto-hero reuse paths", () => {
    const reviewData = JSON.stringify({ rejectedUrls: [candidate.imageUrl] });
    expect(isMountainHeroImageRejected(reviewData, candidate.imageUrl)).toBe(true);
    expect(isMountainHeroImageRejected(reviewData, "/different/mountain/image.jpg")).toBe(false);
  });
});

describe("generated artwork review filter", () => {
  const row = (id: string, status: string) => ({
    slug: `hero-generation:v1:${id}`,
    data: JSON.stringify({ status, candidate }),
  });

  it("includes ready candidates without an approval", () => {
    expect(readyGeneratedReviewIds(
      [row(mountainId, "ready"), row("still-generating", "generating")],
      new Map(),
    )).toEqual([mountainId]);
  });

  it("excludes approved, rejected, and malformed generation records", () => {
    const reviews = new Map([
      ["approved", { status: "approved" as const, updatedAt: "" }],
      ["rejected", { status: "pending" as const, rejectedUrls: [candidate.imageUrl], updatedAt: "" }],
    ]);
    expect(readyGeneratedReviewIds([
      row("approved", "ready"),
      row("rejected", "ready"),
      { slug: "hero-generation:v1:malformed", data: "not-json" },
    ], reviews)).toEqual([]);
  });
});