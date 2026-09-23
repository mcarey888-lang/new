import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  stored: null as any,
  generation: 0,
  calls: [] as string[],
  failAt: "",
  hasMasters: true,
  assetKeys: Array.from({ length: 34 }, (_, index) => `ASSET-${index + 1}`),
}));

vi.mock("../services/artwork/artworkStorage.js", () => ({
  acquireReviewBatchGenerationLock: vi.fn(async () => ({ assertOwned: vi.fn(), release: vi.fn() })),
  readReviewBatchManifest: vi.fn(async () =>
    state.stored ? { value: structuredClone(state.stored), generation: state.generation } : null),
  writeReviewBatchManifest: vi.fn(async (_id: string, job: unknown, expected: number) => {
    if (expected !== state.generation) throw new Error("CAS mismatch");
    state.stored = structuredClone(job);
    return ++state.generation;
  }),
}));
vi.mock("../services/artwork/uiAssetWorkflowService.js", () => ({
  listUiAssetBulkTargets: vi.fn(async () => state.assetKeys),
  getUiAssetManifest: vi.fn(async () => ({
    families: ["RANKS", "ACHIEVEMENTS"].map((familyId) => ({
      familyId, displayName: familyId, masterReferenceAsset: state.hasMasters ? "MASTER" : undefined,
    })),
    history: [],
  })),
  createUiAssetCandidates: vi.fn(async (input: { assetKey: string; candidateCount: number; confirmed: boolean }, _provider: unknown, lifecycle?: { onStarted?: (id: string) => void }) => {
    state.calls.push(input.assetKey);
    lifecycle?.onStarted?.(`HISTORY-${input.assetKey}`);
    if (input.assetKey === state.failAt) throw new Error("Provider failed");
    return Array.from({ length: input.candidateCount }, () => ({}));
  }),
}));

import { getUiAssetBulkJob, startUiAssetBulkJob } from "../services/artwork/uiAssetBulkService.js";

beforeEach(() => {
  state.stored = null;
  state.generation = 0;
  state.calls = [];
  state.failAt = "";
  state.hasMasters = true;
});

describe("UI asset bulk generation", () => {
  it("requires confirmation and a master acknowledgement before spending", async () => {
    await expect(startUiAssetBulkJob(false, false)).rejects.toThrow(/confirmation/i);
    state.hasMasters = false;
    await expect(startUiAssetBulkJob(true, false)).rejects.toThrow(/family master/i);
    expect(state.calls).toEqual([]);
  });

  it("runs each asset once in sequence and rejects a duplicate batch", async () => {
    await startUiAssetBulkJob(true, false);
    await vi.waitFor(async () => expect((await getUiAssetBulkJob())?.status).toBe("COMPLETE"));
    expect(state.calls).toEqual(state.assetKeys);
    expect((await getUiAssetBulkJob())?.completedKeys).toHaveLength(34);
    await expect(startUiAssetBulkJob(true, false)).rejects.toThrow(/already exists/i);
    expect(state.calls).toHaveLength(34);
  });

  it("stops at a failed asset and keeps completed progress", async () => {
    state.failAt = "ASSET-3";
    await startUiAssetBulkJob(true, false);
    await vi.waitFor(async () => expect((await getUiAssetBulkJob())?.status).toBe("FAILED"));
    expect(state.calls).toEqual(["ASSET-1", "ASSET-2", "ASSET-3"]);
    expect((await getUiAssetBulkJob())?.completedKeys).toEqual(["ASSET-1", "ASSET-2"]);
  });
});