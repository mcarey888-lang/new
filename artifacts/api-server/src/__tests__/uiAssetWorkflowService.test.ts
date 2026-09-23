import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  manifest: null as any,
  generation: 0,
  generationSequence: [17, 42, 99, 141, 203, 307] as number[],
  providerGenerate: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: { readFile: vi.fn(async () => JSON.stringify({ records: [
    { asset_key: "SR-SYM-ELEVATION-BANK-001", display_name: "Symbol", category: "SUMMITREADY_SYMBOL", generation_required: true, generation_prompt: "Draw a symbol", negative_prompt: "text", aspect_ratio: "1:1", transparent_background: true, generation_model: "gpt-image-1" },
    { asset_key: "RANK-1", display_name: "Rank", category: "RANK_ARTWORK", generation_required: true, generation_prompt: "Draw a rank", negative_prompt: "text", aspect_ratio: "1:1", transparent_background: true, generation_model: "gpt-image-1" },
  ] })) },
}));
vi.mock("../services/artwork/imageProvider.js", () => ({
  defaultImageProvider: { name: "mock", generate: (...args: unknown[]) => state.providerGenerate(...args) },
}));
vi.mock("../services/artwork/cropService.js", () => ({
  cropMasterImage: vi.fn(async () => ({ hero: Buffer.from("x"), card: Buffer.from("x"), thumbnail: Buffer.from("x"), master: Buffer.from("x") })),
}));
vi.mock("../services/artwork/artworkStorage.js", () => ({
  acquireReviewBatchGenerationLock: vi.fn(async () => ({ assertOwned: vi.fn(), release: vi.fn() })),
  readReviewBatchManifest: vi.fn(async () => state.manifest ? { value: state.manifest, generation: state.generation } : null),
  writeReviewBatchManifest: vi.fn(async (_id: string, value: unknown, expected: number) => {
    if (state.manifest && expected !== state.generation) throw new Error("CAS mismatch");
    state.manifest = structuredClone(value);
    state.generation = state.generationSequence.shift() ?? state.generation + 37;
    return state.generation;
  }),
  uploadReviewCandidate: vi.fn(async () => ({ masterPath: "/master", heroPath: "/hero", cardPath: "/card", thumbnailPath: "/thumb", objectPaths: {} })),
  downloadReviewCandidate: vi.fn(async () => Buffer.from("reference")),
  downloadReviewObject: vi.fn(async (objectPath: string) => ({ buffer: Buffer.from("reference"), mimeType: objectPath.endsWith(".png") ? "image/png" : "image/jpeg", objectPath })),
}));

import {
  CANDIDATE_COUNTS,
  createUiAssetCandidates,
  getUiAssetManifest,
  isCandidateReferenceEligible,
  resolveReferenceSelection,
  resolveReferenceMetadata,
  setUiAssetFamilyLock,
  transitionUiAsset,
  validateUiAssetCandidateCount,
  validateUiAssetModel,
} from "../services/artwork/uiAssetWorkflowService.js";

beforeEach(() => {
  state.manifest = null;
  state.generation = 0;
  state.generationSequence = [17, 42, 99, 141, 203, 307];
  state.providerGenerate.mockReset();
  state.providerGenerate.mockResolvedValue({ buffer: Buffer.from("image"), provider: "mock", cost: 0 });
});

describe("UI asset family workflow safety seams", () => {
  it("accepts only 1, 2, and 4 candidates and only gpt-image-1", () => {
    expect(CANDIDATE_COUNTS.map(validateUiAssetCandidateCount)).toEqual([1, 2, 4]);
    expect(() => validateUiAssetCandidateCount(3)).toThrow();
    expect(() => validateUiAssetCandidateCount(0)).toThrow();
    expect(validateUiAssetModel("gpt-image-1")).toBe("gpt-image-1");
    expect(() => validateUiAssetModel("dall-e-3")).toThrow(/only gpt-image-1/i);
  });

  it("inherits family prompt direction and caps references with master first", async () => {
    const manifest = await getUiAssetManifest();
    const family = manifest.families.find((item) => item.familyId === "RANKS")!;
    family.masterReferenceAsset = "MASTER";
    family.additionalReferenceAssets = ["RELATED-1", "RELATED-2", "RELATED-3"];
    expect(resolveReferenceSelection(manifest, family, ["CURATOR"])).toEqual(["MASTER", "RELATED-1", "RELATED-2"]);
    const candidates = await createUiAssetCandidates({ assetKey: "SR-SYM-ELEVATION-BANK-001", candidateCount: 1, confirmed: true, prompt: "Keep the family direction" });
    expect(candidates[0]!.prompt).toMatch(/line weight|Keep the family direction/);
  });

  it("allows DRAFT and SELECTED refinement candidates as actual image references", () => {
    expect(isCandidateReferenceEligible({ status: "DRAFT" })).toBe(true);
    expect(isCandidateReferenceEligible({ status: "SELECTED" })).toBe(true);
    expect(isCandidateReferenceEligible({ status: "REJECTED" })).toBe(false);
  });

  it("warns before rank members, permits explicit override, and supports family-master mode", async () => {
    await expect(createUiAssetCandidates({ assetKey: "RANK-1", confirmed: true })).rejects.toThrow(/family reference first/i);
    const overridden = await createUiAssetCandidates({ assetKey: "RANK-1", confirmed: true, overrideFamilyWarning: true, candidateCount: 1 });
    expect(overridden[0]!.status).toBe("DRAFT");
    const masters = await createUiAssetCandidates({ familyId: "ACHIEVEMENTS", mode: "family-master", confirmed: true, candidateCount: 1 });
    expect(masters[0]!.assetKey).toBe("FAMILY-MASTER-ACHIEVEMENTS");
    expect(masters[0]!.status).toBe("DRAFT");
  });

  it("supports select/reject/approval transitions and family reference approval", async () => {
    const [candidate] = await createUiAssetCandidates({ assetKey: "SR-SYM-ELEVATION-BANK-001", confirmed: true, candidateCount: 1 });
    expect((await transitionUiAsset(candidate!.candidateId, "select")).status).toBe("SELECTED");
    expect((await transitionUiAsset(candidate!.candidateId, "approve-as-family-reference")).status).toBe("APPROVED_FAMILY_REFERENCE");
    const manifest = await getUiAssetManifest();
    expect(manifest.families.find((item) => item.familyId === "SIGNATURE_SYMBOLS")!.masterReferenceAsset).toBe("SR-SYM-ELEVATION-BANK-001");
    await expect(transitionUiAsset(candidate!.candidateId, "reject")).rejects.toThrow(/reason/i);
  });

  it("guards family lock/unlock and preserves approved references", async () => {
    await expect(setUiAssetFamilyLock("RANKS", true, true)).rejects.toThrow(/approved family master/i);
    await expect(setUiAssetFamilyLock("RANKS", false, false)).rejects.toThrow(/confirmation/i);
    const [master] = await createUiAssetCandidates({ familyId: "RANKS", mode: "family-master", confirmed: true, candidateCount: 1 });
    await transitionUiAsset(master!.candidateId, "select");
    await transitionUiAsset(master!.candidateId, "approve-as-family-reference");
    await expect(setUiAssetFamilyLock("RANKS", true, true)).resolves.toMatchObject({ status: "LOCKED" });
    await expect(setUiAssetFamilyLock("RANKS", false, true)).resolves.toMatchObject({ status: "UNLOCKED" });
    expect((await getUiAssetManifest()).families.find((item) => item.familyId === "RANKS")!.masterReferenceAsset).toBe(master!.assetKey);
  });

  it("records append-only provider failures", async () => {
    state.providerGenerate.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(createUiAssetCandidates({ assetKey: "SR-SYM-ELEVATION-BANK-001", confirmed: true, candidateCount: 1 })).rejects.toThrow(/provider unavailable/);
    const manifest = await getUiAssetManifest();
    expect(manifest.history).toHaveLength(1);
    expect(manifest.history[0]!.outcome).toBe("FAILED");
    expect(manifest.history[0]!.error).toMatch(/provider unavailable/);
    expect(manifest.candidates).toHaveLength(0);
  });

  it("keeps master/refinement/curator refs required at the cap and rejects overflow", async () => {
    const manifest = await getUiAssetManifest();
    const family = manifest.families.find((item) => item.familyId === "RANKS")!;
    const make = (id: string, version: number, status: "SELECTED" | "APPROVED_ASSET") => ({
      candidateId: id, assetKey: id, familyId: "RANKS" as const, version, prompt: "", negativePrompt: "",
      model: "gpt-image-1", referenceAssets: [], status, generatedAt: "", paths: { objectPaths: { master: `expedition-artwork/review-batches/ui-asset-family-workflow/${id}/master.png` } },
    });
    const master = make("master", 1, "APPROVED_ASSET");
    const refinement = make("refine", 1, "SELECTED");
    const curator = make("curator", 2, "APPROVED_ASSET");
    family.masterReference = { candidateId: master.candidateId, assetKey: master.assetKey, version: 1 };
    const extra = make("extra", 1, "APPROVED_ASSET");
    manifest.candidates.push(master, refinement, curator, extra);
    const capped = resolveReferenceMetadata(manifest, family, {
      refineCandidateId: "refine", referenceCandidates: [{ candidateId: "curator", version: 2 }],
    });
    expect(capped.descriptors.map((item) => item.candidateId)).toEqual(["master", "refine", "curator"]);
    expect(() => resolveReferenceMetadata(manifest, family, {
      refineCandidateId: "refine",
      referenceCandidates: [{ candidateId: "curator", version: 2 }, { candidateId: "curator", version: 2 }, { candidateId: "extra", version: 1 }],
    })).toThrow(/available curator slots/i);
  });
});