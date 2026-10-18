import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  manifest: vi.fn(),
  canonical: vi.fn(),
  query: vi.fn(),
  stream: vi.fn(),
}));

vi.mock("../services/artwork/reviewBatchService.js", () => ({
  getBatch01Manifest: mocks.manifest,
}));
vi.mock("../services/mountain/canonicalMountainIdentity.js", () => ({
  getCanonicalMountainById: mocks.canonical,
  resolveCanonicalMountainIdentity: mocks.canonical,
}));
vi.mock("@workspace/db", async (importOriginal) => ({
  ...await importOriginal<typeof import("@workspace/db")>(),
  pool: { query: mocks.query },
}));
vi.mock("../services/artwork/artworkStorage.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../services/artwork/artworkStorage.js")>(),
  streamReviewCandidate: mocks.stream,
}));

import router, { getImageData } from "../routes/mountain-image.js";
import { approvedBatchHero } from "../services/artwork/approvedMountainBatch.js";

const assetId = "SR-MTN-MONTBLANC-001";
const mountain = { id: "montblanc-id", name: "Mont Blanc" };
function manifest(status = "APPROVED", approved = true, version = 1) {
  return { versions: [{
    assetId, version, status, approved,
    heroPath: `/api/artwork/batches/batch-01/${assetId}/v${version}/hero`,
  }] };
}

let server: Server | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.canonical.mockResolvedValue(mountain);
  mocks.query.mockResolvedValue({ rows: [] });
  mocks.manifest.mockResolvedValue(manifest());
  mocks.stream.mockImplementation(async (_batch, _id, _version, _crop, res, cache) => {
    res.set("Cache-Control", cache);
    res.type("image/jpeg").send(Buffer.from("approved-image-bytes"));
  });
});
afterEach(async () => {
  if (server) {
    const closing = new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closing;
    server = undefined;
  }
});

describe("shared approved mountain library", () => {
  it("uses approved Batch artwork before the placeholder and automatic images", async () => {
    const result = await getImageData({ name: "Mont Blanc" });
    expect(result.placeholder).toBe(false);
    expect(result.approvedBatch?.assetId).toBe(assetId);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("hero-auto"))).toBe(false);
  });

  it("preserves an existing identity-bound mountain approval ahead of Batch artwork", async () => {
    mocks.query.mockImplementation(async (_sql, keys) => ({
      rows: String(keys[0]).startsWith("hero-approved:")
        ? [{ data: JSON.stringify({ mountainId: mountain.id, imageUrl: "https://approved.example/montblanc.jpg" }) }]
        : [],
    }));
    const result = await getImageData({ name: "Mont Blanc" });
    expect(result.thumbUrl).toBe("https://approved.example/montblanc.jpg");
    expect(result.approvedBatch).toBeUndefined();
    expect(mocks.manifest).not.toHaveBeenCalled();
  });

  it("serves exact named approved objectives even without a hill catalogue entry", async () => {
    mocks.canonical.mockResolvedValue(null);
    expect((await getImageData({ name: "Mont Blanc" })).approvedBatch?.assetId).toBe(assetId);
  });

  it("does not override an unresolved explicit mountain ID with name-only artwork", async () => {
    mocks.canonical.mockResolvedValue(null);
    const result = await getImageData({ name: "Mont Blanc", mountainId: "different-id" });
    expect(result.placeholder).toBe(true);
    expect(result.approvedBatch).toBeUndefined();
    expect(mocks.manifest).not.toHaveBeenCalled();
  });

  it("checks current approval every time and never revives a superseded approval", async () => {
    expect(await approvedBatchHero("Mont Blanc")).not.toBeNull();
    mocks.manifest.mockResolvedValue({ versions: [
      ...manifest().versions, ...manifest("REVIEW REQUIRED", false, 2).versions,
    ] });
    expect(await approvedBatchHero("Mont Blanc")).toBeNull();
    mocks.manifest.mockResolvedValue(manifest("REJECTED", false));
    expect(await approvedBatchHero("Mont Blanc")).toBeNull();
  });

  it("does not load the library for unrelated or ambiguous subjects", async () => {
    expect(await approvedBatchHero("Mont Blanc du Tacul")).toBeNull();
    expect(await approvedBatchHero("Tour du Mont Blanc")).toBeNull();
    expect(mocks.manifest).not.toHaveBeenCalled();
  });

  it("streams the approved derivative through the public mountain-image endpoint", async () => {
    const app = express();
    app.use("/api", router);
    server = createServer(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/api/mountain-image?name=Mont%20Blanc&width=240&height=160`);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-mountain-artwork")).toBe("approved-library");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("approved-image-bytes");
    expect(mocks.stream).toHaveBeenCalledWith(
      "batch-01", assetId, 1, "hero", expect.anything(), "no-store",
    );
  });

  it("uses approved library artwork if an existing external approval cannot be fetched", async () => {
    mocks.query.mockImplementation(async (_sql, keys) => ({
      rows: String(keys[0]).startsWith("hero-approved:")
        ? [{ data: JSON.stringify({ mountainId: mountain.id, imageUrl: "https://untrusted.invalid/broken.jpg" }) }]
        : [],
    }));
    const app = express();
    app.use("/api", router);
    server = createServer(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/api/mountain-image?name=Mont%20Blanc`);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-mountain-artwork")).toBe("approved-library");
    expect(await response.text()).toBe("approved-image-bytes");
  });
});
