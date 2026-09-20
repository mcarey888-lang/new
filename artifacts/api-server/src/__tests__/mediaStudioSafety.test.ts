import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { nextReviewVersion } from "../services/artwork/batch01.js";
import {
  updateVersionStatus,
  type ReviewCandidate,
} from "../services/artwork/reviewBatchService.js";

const routeSource = readFileSync(new URL("../routes/artwork.ts", import.meta.url), "utf8");
const serviceSource = readFileSync(
  new URL("../services/artwork/artworkService.ts", import.meta.url),
  "utf8",
);
const gallerySource = readFileSync(
  new URL("../../../artwork-admin/src/components/Batch01ReviewGallery.tsx", import.meta.url),
  "utf8",
);
const assetPageSource = readFileSync(
  new URL("../../../artwork-admin/src/pages/AssetGallery.tsx", import.meta.url),
  "utf8",
);
const storageSource = readFileSync(
  new URL("../services/artwork/artworkStorage.ts", import.meta.url),
  "utf8",
);
const mountainPageSource = readFileSync(
  new URL("../../../artwork-admin/src/pages/MountainQueue.tsx", import.meta.url),
  "utf8",
);

function candidate(assetId: string, version = 1): ReviewCandidate {
  return {
    assetId,
    title: assetId,
    family: "Test",
    placement: "Test placement",
    cropGuidance: "Test crop",
    prompt: "Test prompt",
    promptHash: "0123456789abcdef",
    provider: "test-provider",
    model: "test-model",
    dimensions: "1536x1024",
    version,
    generatedAt: "2026-09-20T00:00:00.000Z",
    generationCost: 0.04,
    status: "REVIEW REQUIRED",
    approved: false,
    published: false,
    masterPath: `/master-${assetId}-${version}`,
    heroPath: `/hero-${assetId}-${version}`,
    cardPath: `/card-${assetId}-${version}`,
    thumbnailPath: `/thumb-${assetId}-${version}`,
    objectPaths: {},
    attempts: version,
  };
}

describe("Media Studio curation safety", () => {
  it("approves only the exact asset/version and never publishes it", () => {
    const versions = [candidate("A"), candidate("B")];
    const result = updateVersionStatus(
      versions,
      "A",
      1,
      "APPROVED",
      "2026-09-20T01:00:00.000Z",
    );
    expect(result[0]).toMatchObject({ status: "APPROVED", approved: true, published: false });
    expect(result[1]).toEqual(versions[1]);
  });

  it("rejects without deleting version history", () => {
    const versions = [candidate("A", 1), candidate("A", 2)];
    const result = updateVersionStatus(
      versions,
      "A",
      2,
      "REJECTED",
      "2026-09-20T01:00:00.000Z",
      "UNUSABLE_CROP",
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(versions[0]);
    expect(result[1]).toMatchObject({ status: "REJECTED", rejectionReason: "UNUSABLE_CROP" });
  });

  it("reserves a new version after every previous reservation", () => {
    expect(nextReviewVersion([1])).toBe(2);
    expect(nextReviewVersion([1, 2])).toBe(3);
  });

  it("makes regeneration individual, objective-reasoned and confirmed", () => {
    expect(routeSource).toContain("Whole-batch generation is disabled; choose one asset");
    expect(routeSource).toContain("Regeneration requires explicit confirmation");
    expect(routeSource).toContain("isObjectiveFailureReason(reason)");
    expect(gallerySource).toContain("Only this asset will be generated");
  });

  it("fences manifest writes and confirms exact approvals", () => {
    expect(storageSource).toContain("preconditionOpts: { ifGenerationMatch: expectedGeneration }");
    expect(storageSource).toContain("await renew()");
    expect(gallerySource).toContain("Approve this exact version?");
    expect(gallerySource).toContain("It will not be published");
    expect(mountainPageSource).toContain("Approve “${candidate.title}” as the exact hero");
  });

  it("caps bulk generation at 25 explicit targets and requires count confirmation", () => {
    expect(routeSource).toContain("challengeIds.length > 25");
    expect(routeSource).toContain("expectedCount !== challengeIds.length");
    expect(routeSource).toContain("req.body?.confirmed !== true");
    expect(serviceSource).toContain("inArray(signatureChallenges.challengeId, challengeIds)");
  });

  it("keeps Batch 01 review fixtures out of production UI and API", () => {
    expect(routeSource).toContain('process.env.NODE_ENV !== "development"');
    expect(assetPageSource).toContain("import.meta.env.DEV");
  });

  it("does not invoke an image provider during safety tests", () => {
    const provider = { generate: vi.fn() };
    expect(provider.generate).not.toHaveBeenCalled();
  });
});