import { afterEach, describe, expect, it, vi } from "vitest";
import { expeditionStageArtwork } from "./expeditionStageArtwork";

const mountain = {
  id: "82a88089-490b-5fb1-be6d-bf21e173dc15", name: "Helvellyn",
  source: "catalogue", verificationStatus: "verified",
  latitude: 54.527, longitude: -3.017, region: "Lake District", country: "England",
};
const stage = { name: "Helvellyn via Striding Edge and Swirral Edge", latitude: 54.527, longitude: -3.017 };
function mock(items = [mountain], hasMore = false) {
  return vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true, json: async () => ({ items, hasMore }),
  } as Response);
}
afterEach(() => vi.restoreAllMocks());

describe("expedition stage artwork identity", () => {
  it("resolves the mountain behind a via route to the existing shared image flow", async () => {
    const fetcher = mock();
    const uri = await expeditionStageArtwork(stage, "/api");
    expect(fetcher).toHaveBeenCalledWith("/api/mountain-discovery?q=Helvellyn&limit=50", { signal: undefined });
    expect(uri).toContain(`mountainId=${mountain.id}`);
    expect(uri).not.toContain("Striding");
    expect(uri).not.toContain("routeIdentityKey");
  });
  it.each([
    [[{ ...mountain, latitude: 56 }], false],
    [[{ ...mountain, name: "Helvellyn Lower Man" }], false],
    [[{ ...mountain, source: "ai" }], false],
    [[{ ...mountain, verificationStatus: "ai_unverified" }], false],
    [[mountain, mountain], false],
    [[mountain], true],
    [[], false],
  ] as [typeof mountain[], boolean][])("refuses ambiguous, nearby or unverified matches", async (items, more) => {
    mock(items, more);
    expect(await expeditionStageArtwork(stage, "/api")).toBeNull();
  });
  it("does not guess identities for missing coordinates or multi-mountain stages", async () => {
    const fetcher = mock();
    expect(await expeditionStageArtwork({ ...stage, latitude: NaN }, "/api")).toBeNull();
    expect(await expeditionStageArtwork({ ...stage, name: "Helvellyn and Skiddaw" }, "/api")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("lets the existing server source-evidence gate decide imported catalogue candidates", async () => {
    mock([{ ...mountain, verificationStatus: "imported" }]);
    expect(await expeditionStageArtwork(stage, "/api")).toContain(`mountainId=${mountain.id}`);
  });
  it("propagates lookup failures rather than starting generation with a guessed identity", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(expeditionStageArtwork(stage, "/api")).rejects.toThrow("503");
  });
});
