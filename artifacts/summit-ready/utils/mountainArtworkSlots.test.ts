import { afterEach, describe, expect, it, vi } from "vitest";
import { mountainArtworkSlot, refreshedMountainArtworkUri, watchMountainArtwork } from "./mountainArtworkSlots";
import { fetchMountainHeroStatus, MountainHeroRequestError } from "./mountainHero";

vi.mock("./mountainHero", async importOriginal => ({
  ...await importOriginal<typeof import("./mountainHero")>(),
  fetchMountainHeroStatus: vi.fn(),
}));
const id = "82a88089-490b-5fb1-be6d-bf21e173dc15";
const uri = `/api/mountain-image?name=Matterhorn&mountainId=${id}&width=240`;
const stops: (() => void)[] = [];
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
afterEach(() => { stops.splice(0).forEach(stop => stop()); vi.restoreAllMocks(); vi.clearAllMocks(); vi.useRealTimers(); });

describe("mountain artwork slots", () => {
  it("ignores unrelated images, malformed identities and route-specific imagery", () => {
    expect(mountainArtworkSlot("/api/photos/a")).toBeNull();
    expect(mountainArtworkSlot("/api/mountain-image?name=Hill&mountainId=bad")).toBeNull();
    expect(mountainArtworkSlot("/api/mountain-image?name=Tour%20du%20Mont%20Blanc")).toBeNull();
    expect(mountainArtworkSlot(`${uri}&routeIdentityKey=route-1`)).toBeNull();
    expect(mountainArtworkSlot(`https://untrusted.invalid${uri}`)).toBeNull();
    expect(mountainArtworkSlot(`//untrusted.invalid${uri}`)).toBeNull();
  });
  it("reuses existing approved artwork without requesting generation", async () => {
    vi.mocked(fetchMountainHeroStatus).mockResolvedValue({ status: "ready" });
    const listener = vi.fn();
    stops.push(watchMountainArtwork(uri, "owner", async () => "token", listener));
    await tick();
    expect(listener).toHaveBeenCalledWith("ready", id);
    expect(fetchMountainHeroStatus).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchMountainHeroStatus).mock.calls[0]![3]).toBe(false);
  });
  it("deduplicates visible slots and polls until the shared image is ready", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchMountainHeroStatus)
      .mockResolvedValueOnce({ status: "unavailable" })
      .mockResolvedValueOnce({ status: "generating" })
      .mockResolvedValueOnce({ status: "ready", jobId: "job-1" });
    const a = vi.fn(), b = vi.fn();
    stops.push(watchMountainArtwork(uri, "owner", async () => "token", a));
    stops.push(watchMountainArtwork(uri.replace("240", "800"), "owner", async () => "token", b));
    await tick();
    expect(fetchMountainHeroStatus).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchMountainHeroStatus).mock.calls.map(call => call[3])).toEqual([false, true]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(a).toHaveBeenCalledWith("job-1", id);
    expect(b).toHaveBeenCalledWith("job-1", id);
  });
  it("only resolves unambiguous verified catalogue matches for legacy named cards", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true, json: async () => ({ items: [{ id, name: "Matterhorn", source: "catalogue", verificationStatus: "verified" }], hasMore: false }),
    } as Response);
    vi.mocked(fetchMountainHeroStatus).mockResolvedValue({ status: "ready" });
    stops.push(watchMountainArtwork("/api/mountain-image?name=Matterhorn", "owner", async () => "token", vi.fn()));
    await tick();
    expect(fetchMountainHeroStatus).toHaveBeenCalledWith(id, "/api", expect.any(Function), false);
  });
  it.each([
    [{ id, name: "Matterhorn", source: "ai", verificationStatus: "ai_unverified" }],
    [{ id, name: "Matterhorn", source: "catalogue", verificationStatus: "imported" }],
    [{ id, name: "Matterhorn", source: "catalogue", verificationStatus: "verified" },
      { id, name: "Matterhorn", source: "catalogue", verificationStatus: "verified" }],
    [],
  ])("never generates for noncanonical or ambiguous named cards: %j", async (...items) => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ items, hasMore: false }) } as Response);
    stops.push(watchMountainArtwork("/api/mountain-image?name=Matterhorn", "owner", async () => "token", vi.fn()));
    await tick();
    expect(fetchMountainHeroStatus).not.toHaveBeenCalled();
  });
  it("honours Retry-After without changing server limits and cancels polling on unmount", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchMountainHeroStatus)
      .mockRejectedValueOnce(new MountainHeroRequestError("limit", 429, 20000))
      .mockResolvedValue({ status: "generating" });
    const stop = watchMountainArtwork(uri, "owner", async () => "token", vi.fn());
    stops.push(stop);
    await tick();
    await vi.advanceTimersByTimeAsync(19000);
    expect(fetchMountainHeroStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMountainHeroStatus).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(15000);
    expect(fetchMountainHeroStatus).toHaveBeenCalledTimes(2);
  });
  it("preserves dimensions while refreshing an image after generation", () => {
    expect(refreshedMountainArtworkUri(uri, "job-1")).toContain("width=240&heroSlotRevision=job-1");
  });
});
