import { describe, expect, it } from "vitest";
import {
  BATCH_01_ASSETS,
  BATCH_01_PROMPTS,
  isObjectiveFailureReason,
  nextReviewVersion,
  validateCandidateGeneration,
} from "../services/artwork/batch01.js";
import { buildPlacementAwarePrompt } from "../services/artwork/promptBuilder.js";

describe("Batch 01 artwork definitions", () => {
  it("defines exactly 12 unique individual masters", () => {
    expect(BATCH_01_ASSETS).toHaveLength(12);
    expect(new Set(BATCH_01_ASSETS.map((asset) => asset.assetId)).size).toBe(12);
    expect(BATCH_01_ASSETS.every((asset) => asset.assetId.startsWith("SR-"))).toBe(true);
  });

  it("builds placement-aware prompts with the review exclusions", () => {
    for (const asset of BATCH_01_PROMPTS) {
      expect(asset.prompt).toContain(`Actual app placement: ${asset.placement}`);
      expect(asset.prompt).toContain(`Focal location: ${asset.focalLocation}`);
      expect(asset.prompt).toContain(`Negative-space location: ${asset.negativeSpaceLocation}`);
      expect(asset.prompt).toContain("1536x1024");
      expect(asset.prompt).toContain("never a collage");
      expect(asset.prompt).toContain("No baked-in text");
      expect(asset.hash).toMatch(/^[a-f0-9]{16}$/);
    }
  });

  it("isolates hashes when placement metadata changes", () => {
    const asset = BATCH_01_ASSETS[0];
    const original = buildPlacementAwarePrompt(asset);
    const changed = buildPlacementAwarePrompt({
      ...asset,
      placement: `${asset.placement} alternate placement`,
    });
    expect(changed.hash).not.toBe(original.hash);
    expect(changed.prompt).not.toBe(original.prompt);
  });

  it("allows only the initial generation plus two reasoned regenerations", () => {
    expect(validateCandidateGeneration(false, 0)).toBe(1);
    expect(validateCandidateGeneration(true, 1, "UNUSABLE_CROP")).toBe(2);
    expect(validateCandidateGeneration(true, 2, "TEXT_OR_WATERMARK")).toBe(3);
    expect(() => validateCandidateGeneration(true, 1)).toThrow(/objectiveFailureReason/);
    expect(() => validateCandidateGeneration(false, 0, "FANTASY_GEOGRAPHY")).toThrow(/Initial/);
    expect(() => validateCandidateGeneration(true, 3, "UNUSABLE_CROP")).toThrow(/two-regeneration/);
    expect(isObjectiveFailureReason("WRONG_MOUNTAIN_MORPHOLOGY")).toBe(true);
    expect(isObjectiveFailureReason("AESTHETIC_PREFERENCE")).toBe(false);
    expect(nextReviewVersion([])).toBe(1);
    expect(nextReviewVersion([1, 2])).toBe(3);
    expect(nextReviewVersion([1, 2, 2])).toBe(3);
  });
});