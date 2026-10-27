import { beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({
  copies: [] as { source: string; destination: string; generation: unknown; condition: unknown }[],
  deleted: [] as string[], missingMaster: false, failAt: 0,
}));
vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    bucket() {
      const file = (name: string, options?: { generation?: unknown }) => ({
        name,
        exists: async () => [!(storage.missingMaster && name.endsWith("/master.jpg"))],
        getMetadata: async () => [{ generation: "101" }],
        copy: async (dest: { name: string }, copyOptions: { preconditionOpts: unknown }) => {
          if (storage.failAt && storage.copies.length + 1 === storage.failAt) throw new Error("copy failed");
          storage.copies.push({ source: name, destination: dest.name, generation: options?.generation,
            condition: copyOptions.preconditionOpts });
          return [dest];
        },
        delete: async () => { storage.deleted.push(name); },
      });
      return { file };
    }
  },
}));
import { copyApprovedSignatureArtwork } from "../services/artwork/artworkStorage";
describe("approved artwork byte copying (mock GCS)", () => {
  beforeEach(() => {
    vi.stubEnv("DEFAULT_OBJECT_STORAGE_BUCKET_ID", "test-bucket");
    storage.copies = []; storage.deleted = []; storage.missingMaster = false; storage.failAt = 0;
  });
  it("pins source object generations and creates target-owned non-overwriting files", async () => {
    const copied = await copyApprovedSignatureArtwork("SIG053", 3, "EXP_TEST", 1);
    expect(storage.copies).toHaveLength(4);
    expect(storage.copies[0]).toEqual({
      source: "expedition-artwork/SIG053/v3/hero.jpg",
      destination: "expedition-artwork/EXP_TEST/v1/hero.jpg",
      generation: "101", condition: { ifGenerationMatch: 0 },
    });
    expect(storage.deleted).toHaveLength(0);
    await copied.cleanup();
    expect(storage.deleted).toHaveLength(4);
    expect(storage.deleted.every(path => path.startsWith("expedition-artwork/EXP_TEST/v1/"))).toBe(true);
  });
  it("supports approved sources with three derivatives but no original master", async () => {
    storage.missingMaster = true;
    await copyApprovedSignatureArtwork("SIG053", 3, "EXP_TEST", 1);
    expect(storage.copies).toHaveLength(3);
  });
  it("cleans only copies created by this request when a later derivative fails", async () => {
    storage.failAt = 2;
    await expect(copyApprovedSignatureArtwork("SIG053", 3, "EXP_TEST", 1)).rejects.toThrow("copy failed");
    expect(storage.deleted).toEqual(["expedition-artwork/EXP_TEST/v1/hero.jpg"]);
  });
  it("rejects arbitrary paths and invalid versions", async () => {
    await expect(copyApprovedSignatureArtwork("../private", 3, "EXP_TEST", 1)).rejects.toThrow("Invalid artwork");
    await expect(copyApprovedSignatureArtwork("SIG053", 1.5, "EXP_TEST", 1)).rejects.toThrow("Invalid artwork");
    expect(storage.copies).toHaveLength(0);
  });
});
