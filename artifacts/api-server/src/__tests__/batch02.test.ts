import { describe, expect, it } from "vitest";
import {
  BATCH_02_ASSETS,
  BATCH_02_ESTIMATED_COST_PER_MASTER,
  BATCH_02_PROMPTS,
  validateBatch02InitialGeneration,
} from "../services/artwork/batch02.js";

describe("Batch 02 artwork definitions", () => {
  it("defines exactly 12 unique authorized masters", () => {
    expect(BATCH_02_ASSETS).toHaveLength(12);
    expect(new Set(BATCH_02_ASSETS.map((asset) => asset.assetId)).size).toBe(12);
    expect(BATCH_02_ASSETS.every((asset) => asset.assetId.endsWith("-002"))).toBe(true);
  });

  it("uses the exact authorized placements", () => {
    expect(BATCH_02_ASSETS.map((asset) => asset.placement)).toEqual([
      "explore.discovery.hero",
      "explore.route.card.ridge",
      "explore.route.card.summit",
      "explore.route.card.valley",
      "track.hero",
      "track.activity.hero",
      "expedition.discovery.hero",
      "expedition.stage.hero",
      "profile.hero",
      "rank.progress.background",
      "mountain.dna.background",
      "app.atmosphere.background",
    ]);
  });

  it("builds mobile-crop-aware prompts without named-mountain claims", () => {
    for (const asset of BATCH_02_PROMPTS) {
      expect(asset.prompt).toContain(`Actual app placement: ${asset.placement}`);
      expect(asset.prompt).toContain("1536x1024");
      expect(asset.prompt).toContain("never a collage");
      expect(asset.prompt).toContain("No baked-in text");
      expect(asset.hash).toMatch(/^[a-f0-9]{16}$/);
    }
    const combined = BATCH_02_PROMPTS.map((asset) => asset.prompt).join("\n");
    for (const namedMountain of ["Ben Nevis", "Snowdon", "Yr Wyddfa", "Helvellyn", "Mont Blanc", "Matterhorn"]) {
      expect(combined).not.toContain(namedMountain);
    }
  });

  it("estimates exactly twelve initial generations at $0.48", () => {
    expect(BATCH_02_ASSETS.length * BATCH_02_ESTIMATED_COST_PER_MASTER).toBeCloseTo(0.48);
  });

  it("permits only one initial attempt and never a retry", () => {
    expect(validateBatch02InitialGeneration(0)).toBe(1);
    expect(() => validateBatch02InitialGeneration(1)).toThrow(/exactly one initial generation attempt/);
    expect(() => validateBatch02InitialGeneration(2)).toThrow(/exactly one initial generation attempt/);
  });
});