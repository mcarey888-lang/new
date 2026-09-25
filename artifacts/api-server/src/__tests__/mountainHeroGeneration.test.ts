import { describe, expect, it } from "vitest";
import {
  isGeneratedMountainCandidateOwnedBy,
  withoutRejectedMountainHeroCandidate,
  type MountainHeroCandidate,
  type MountainHeroGenerationRecord,
} from "../services/artwork/mountainHeroReview.js";

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
});