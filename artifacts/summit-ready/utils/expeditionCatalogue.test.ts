import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchActiveExpeditionCatalogue } from "./expeditionCatalogue";

afterEach(() => vi.unstubAllGlobals());
describe("active expedition discovery", () => {
  it("includes newly active, non-featured expeditions without requiring a region", async () => {
    const item = { challengeId: "EXP_NEW", challengeName: "New expedition", featured: false, regions: "" };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ challenges: [item] })));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    expect(await fetchActiveExpeditionCatalogue("https://example.test/api/", signal)).toEqual([item]);
    expect(fetcher).toHaveBeenCalledWith("https://example.test/api/sx/challenges", { signal });
  });
  it("keeps existing featured entries alongside new expeditions", async () => {
    const items = [{ challengeId: "SIG001", challengeName: "Existing", featured: true },
      { challengeId: "EXP_NEW", challengeName: "New", featured: false }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ challenges: items }))));
    expect(await fetchActiveExpeditionCatalogue("/api")).toEqual(items);
  });
  it("accepts an empty catalogue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"challenges":[]}')));
    expect(await fetchActiveExpeditionCatalogue("/api")).toEqual([]);
  });
  it("reports service failures instead of silently hiding the catalogue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(fetchActiveExpeditionCatalogue("/api")).rejects.toThrow("Could not load expeditions");
  });
  it("rejects malformed catalogue responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"challenges":[null]}')));
    await expect(fetchActiveExpeditionCatalogue("/api")).rejects.toThrow("could not be read");
  });
});
