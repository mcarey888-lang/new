import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  manifest: null as any,
  writes: [] as any[],
  generate: vi.fn(),
}));

vi.mock("../services/artwork/artworkStorage.js", () => ({
  acquireReviewBatchGenerationLock: vi.fn(async () => ({
    assertOwned: vi.fn(),
    release: vi.fn(async () => undefined),
  })),
  readReviewBatchManifest: vi.fn(async () => ({ value: structuredClone(state.manifest), generation: state.writes.length + 1 })),
  writeReviewBatchManifest: vi.fn(async (_batchId: string, manifest: unknown) => {
    state.manifest = structuredClone(manifest);
    state.writes.push(structuredClone(manifest));
    return state.writes.length + 1;
  }),
  uploadReviewCandidate: vi.fn(() => {
    throw new Error("storage must not be reached in mutation safety tests");
  }),
}));

vi.mock("../services/artwork/imageProvider.js", () => ({
  defaultImageProvider: { name: "throwing-test-provider", generate: state.generate },
}));

vi.mock("../services/artwork/cropService.js", () => ({
  cropMasterImage: vi.fn(() => {
    throw new Error("crop service must not be reached in mutation safety tests");
  }),
}));

import {
  approveBatch01Version,
  generateBatch01Candidate,
  rejectBatch01Version,
} from "../services/artwork/reviewBatchService.js";

function version(assetId: string, number: number) {
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
    version: number,
    generatedAt: "2026-09-20T00:00:00.000Z",
    generationCost: 0.04,
    status: "REVIEW REQUIRED",
    approved: false,
    published: false,
    masterPath: `/master-${assetId}-${number}`,
    heroPath: `/hero-${assetId}-${number}`,
    cardPath: `/card-${assetId}-${number}`,
    thumbnailPath: `/thumb-${assetId}-${number}`,
    objectPaths: {},
    attempts: number,
  };
}

beforeEach(() => {
  const a1 = version("SR-MTN-MONTBLANC-001", 1);
  const b1 = version("SR-MTN-MATTERHORN-001", 1);
  state.manifest = {
    batchId: "batch-01",
    status: "REVIEW REQUIRED",
    approved: false,
    published: false,
    updatedAt: "2026-09-20T00:00:00.000Z",
    estimatedCost: 0.08,
    attemptLedger: [
      { assetId: a1.assetId, attempt: 1, version: 1, reason: "INITIAL", status: "stored", startedAt: a1.generatedAt, completedAt: a1.generatedAt, provider: a1.provider, cost: 0.04 },
      { assetId: b1.assetId, attempt: 1, version: 1, reason: "INITIAL", status: "stored", startedAt: b1.generatedAt, completedAt: b1.generatedAt, provider: b1.provider, cost: 0.04 },
    ],
    candidates: [a1, b1],
    versions: [a1, b1],
  };
  state.writes = [];
  state.generate.mockReset();
});

describe("Batch 01 persisted mutation behavior", () => {
  it("approves only one exact version and never publishes it", async () => {
    const result = await approveBatch01Version("SR-MTN-MONTBLANC-001", 1);
    expect(result.candidates[0]).toMatchObject({ status: "APPROVED", approved: true, published: false });
    expect(result.candidates[1]).toMatchObject({ status: "REVIEW REQUIRED", approved: false, published: false });
    expect(state.generate).not.toHaveBeenCalled();
  });

  it("rejects one exact version while retaining every history entry", async () => {
    const result = await rejectBatch01Version("SR-MTN-MONTBLANC-001", 1, "UNUSABLE_CROP");
    expect(result.versions).toHaveLength(2);
    expect(result.versions[0]).toMatchObject({ status: "REJECTED", rejectionReason: "UNUSABLE_CROP" });
    expect(result.versions[1]).toMatchObject({ status: "REVIEW REQUIRED" });
    expect(state.generate).not.toHaveBeenCalled();
  });

  it("a single-asset regeneration cannot invoke a real provider or the batch", async () => {
    state.generate.mockRejectedValueOnce(new Error("intentional test stop"));
    await expect(generateBatch01Candidate(
      "SR-MTN-MONTBLANC-001",
      "UNUSABLE_CROP",
    )).rejects.toThrow("intentional test stop");
    expect(state.generate).toHaveBeenCalledTimes(1);
    expect(state.manifest.candidates).toHaveLength(2);
    expect(state.manifest.attemptLedger.filter(
      (attempt: { assetId: string }) => attempt.assetId === "SR-MTN-MONTBLANC-001",
    )).toHaveLength(2);
  });
});