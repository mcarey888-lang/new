import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  update: vi.fn(), copy: vi.fn(), cleanup: vi.fn(),
  assertOwned: vi.fn(), release: vi.fn(), acquire: vi.fn(),
}));
vi.mock("@workspace/db", async importOriginal => ({
  ...await importOriginal<typeof import("@workspace/db")>(),
  db: {
    transaction: async (work: (tx: unknown) => Promise<unknown>) => work({
      select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ for: async () => fake.rows }) }) }) }),
      update: () => ({ set: (data: unknown) => ({ where: () => fake.update(data) }) }),
    }),
    select: () => ({ from: () => ({ where: () => ({ orderBy: async () => fake.rows }) }) }),
  },
}));
vi.mock("../services/artwork/artworkStorage.js", () => ({
  servingPath: (id: string, crop: string) => `/api/artwork/image/${id}/${crop}`,
  acquireSignatureArtworkLock: (...args: unknown[]) => fake.acquire(...args),
  copyApprovedSignatureArtwork: (...args: unknown[]) => fake.copy(...args),
}));
import { approvedSignatureArtworkLibrary, assignApprovedSignatureArtwork } from "../services/artwork/expeditionArtworkAssignment";

const source = () => ({
  challengeId: "SIG053", challengeName: "Welsh Mont Blanc", targetMountainName: "Mont Blanc",
  approved: true, imageStatus: "approved", imageVersion: 3, imagePrompt: "Original approved prompt",
  heroImage: "/api/artwork/image/SIG053/hero", cardImage: "/api/artwork/image/SIG053/card",
  thumbnailImage: "/api/artwork/image/SIG053/thumbnail", status: "active",
});
const target = () => ({ challengeId: "EXP_TEST", imageVersion: 0, imageStatus: "pending",
  approved: false, status: "draft", updatedAtText: "2026-10-27 12:00:00+00" });
const input = () => ({ sourceChallengeId: "SIG053", sourceImageVersion: 3, expectedUpdatedAt: "2026-10-27 12:00:00+00" });

describe("explicit approved Signature artwork reuse (mock storage and repository)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.rows = [source(), target()];
    fake.update.mockResolvedValue(undefined);
    fake.cleanup.mockResolvedValue(undefined);
    fake.copy.mockResolvedValue({ cleanup: fake.cleanup });
    fake.assertOwned.mockResolvedValue(undefined);
    fake.release.mockResolvedValue(undefined);
    fake.acquire.mockResolvedValue({ assertOwned: fake.assertOwned, release: fake.release });
  });
  it("copies pinned approved artwork into the destination and does not activate or modify the source", async () => {
    const original = structuredClone(fake.rows[0]);
    const result = await assignApprovedSignatureArtwork("EXP_TEST", input());
    expect(result).toEqual({ assigned: true, sourceChallengeId: "SIG053", sourceImageVersion: 3, imageVersion: 1 });
    expect(fake.copy).toHaveBeenCalledWith("SIG053", 3, "EXP_TEST", 1);
    expect(fake.update).toHaveBeenCalledTimes(1);
    const metadata = fake.update.mock.calls[0][0];
    expect(metadata).toMatchObject({ heroImage: "/api/artwork/image/EXP_TEST/hero", approved: true,
      imageStatus: "approved", imageVersion: 1, generationCost: 0, provider: "reused-approved-signature" });
    expect(metadata).not.toHaveProperty("status");
    expect(metadata).not.toHaveProperty("dnaMatchScore");
    expect(JSON.parse(metadata.imagePrompt)).toMatchObject({ sourceChallengeId: "SIG053", sourceImageVersion: 3 });
    expect(fake.rows[0]).toEqual(original);
    expect(fake.cleanup).not.toHaveBeenCalled();
    expect(fake.release).toHaveBeenCalledOnce();
  });
  it.each([
    { approved: false }, { imageStatus: "generating" }, { imageVersion: 4 },
    { cardImage: null }, { heroImage: "/api/artwork/image/OTHER/hero" },
  ])("rejects changed, unapproved or incomplete sources before copying: %j", async patch => {
    Object.assign(fake.rows[0], patch);
    await expect(assignApprovedSignatureArtwork("EXP_TEST", input())).rejects.toMatchObject({ status: 409 });
    expect(fake.copy).not.toHaveBeenCalled();
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.release).toHaveBeenCalledOnce();
  });
  it("requires a fresh destination revision", async () => {
    await expect(assignApprovedSignatureArtwork("EXP_TEST", { ...input(), expectedUpdatedAt: "stale" }))
      .rejects.toMatchObject({ status: 409 });
    expect(fake.copy).not.toHaveBeenCalled();
  });
  it("requires explicit replacement and increments the destination version", async () => {
    Object.assign(fake.rows[1], { imageVersion: 7, heroImage: "/api/artwork/image/EXP_TEST/hero" });
    await expect(assignApprovedSignatureArtwork("EXP_TEST", input())).rejects.toMatchObject({ status: 409 });
    expect(fake.copy).not.toHaveBeenCalled();
    await assignApprovedSignatureArtwork("EXP_TEST", { ...input(), replaceExisting: true });
    expect(fake.copy).toHaveBeenCalledWith("SIG053", 3, "EXP_TEST", 8);
  });
  it("does not change existing metadata if copying fails", async () => {
    fake.copy.mockRejectedValueOnce(new Error("source crop missing"));
    await expect(assignApprovedSignatureArtwork("EXP_TEST", input())).rejects.toThrow("source crop missing");
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.release).toHaveBeenCalledOnce();
  });
  it("preserves copied files if the database publish outcome is uncertain", async () => {
    fake.update.mockRejectedValueOnce(new Error("transaction failed"));
    await expect(assignApprovedSignatureArtwork("EXP_TEST", input())).rejects.toThrow("transaction failed");
    expect(fake.cleanup).not.toHaveBeenCalled();
    expect(fake.release).toHaveBeenCalledOnce();
  });
  it("fences lost storage locks before publishing approval", async () => {
    fake.assertOwned.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("lock lost"));
    await expect(assignApprovedSignatureArtwork("EXP_TEST", input())).rejects.toThrow("lock lost");
    expect(fake.cleanup).toHaveBeenCalledOnce();
    expect(fake.update).not.toHaveBeenCalled();
  });
  it("does not allow source to equal destination", async () => {
    await expect(assignApprovedSignatureArtwork("SIG053", input())).rejects.toMatchObject({ status: 400 });
    expect(fake.acquire).not.toHaveBeenCalled();
  });
  it("lists only complete approved images, without exposing prompts", async () => {
    fake.rows = [source(), { ...source(), challengeId: "BAD", approved: false }];
    const result = await approvedSignatureArtworkLibrary();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ challengeId: "SIG053", imageVersion: 3,
      heroUrl: "/api/artwork/image/SIG053/hero?approved=1&v=3" });
    expect(result.items[0]).not.toHaveProperty("imagePrompt");
  });
});
