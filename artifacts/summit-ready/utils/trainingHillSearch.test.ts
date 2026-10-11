import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const hill = {
  name: "Cribden Hill", elevation: 180, distance: 2.1,
  routeIdentityKey: "route:v1:osm_overpass:node:123",
  routeDataStatus: "terrain_calculated",
};

describe("shared Explore and session hill search", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("normalizes the postcode and uses Explore's 25 km radius", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ hills: [hill] })));
    vi.stubGlobal("fetch", fetchMock);
    const { searchTrainingHills } = await import("./trainingHillSearch");
    expect(await searchTrainingHills("area", "bb44bh")).toEqual([hill]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ location: "BB4 4BH", radius: 25 });
  });

  it("reuses successful Explore results when Change hill searches the same postcode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ hills: [hill] })));
    vi.stubGlobal("fetch", fetchMock);
    const { searchTrainingHills } = await import("./trainingHillSearch");
    await searchTrainingHills("area", "BB4 4BH");
    expect(await searchTrainingHills("area", "bb44bh", "Haslingden")).toEqual([hill]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight search without one screen cancelling the other's results", async () => {
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const { searchTrainingHills } = await import("./trainingHillSearch");
    const controller = new AbortController();
    const first = searchTrainingHills("area", "bb44bh", "", controller.signal);
    const cancelled = expect(first).rejects.toMatchObject({ name: "AbortError" });
    const second = searchTrainingHills("area", "BB4 4BH");
    controller.abort();
    await cancelled;
    finish(new Response(JSON.stringify({ hills: [hill] })));
    expect(await second).toEqual([hill]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache a provider failure, so retry can recover", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ hills: [hill] })));
    vi.stubGlobal("fetch", fetchMock);
    const { searchTrainingHills } = await import("./trainingHillSearch");
    await expect(searchTrainingHills("area", "bb44bh")).rejects.toThrow("temporarily unavailable");
    expect(await searchTrainingHills("area", "bb44bh")).toEqual([hill]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache empty or malformed responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ hills: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "invalid" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ hills: [hill] })));
    vi.stubGlobal("fetch", fetchMock);
    const { searchTrainingHills } = await import("./trainingHillSearch");
    expect(await searchTrainingHills("area", "bb44bh")).toEqual([]);
    await expect(searchTrainingHills("area", "bb44bh")).rejects.toThrow("unavailable");
    expect(await searchTrainingHills("area", "bb44bh")).toEqual([hill]);
  });

  it("expires successful results after five minutes", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ hills: [hill] })));
    vi.stubGlobal("fetch", fetchMock);
    const { searchTrainingHills } = await import("./trainingHillSearch");
    await searchTrainingHills("area", "bb44bh");
    clock.mockReturnValue(1000 + 5 * 60 * 1000);
    await searchTrainingHills("area", "bb44bh");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("preserves name lookup's location and exact hill identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ hill })));
    vi.stubGlobal("fetch", fetchMock);
    const { searchTrainingHills } = await import("./trainingHillSearch");
    expect(await searchTrainingHills("name", "Cribden Hill", "bb44bh")).toEqual([hill]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ hillName: "Cribden Hill", location: "BB4 4BH" });
  });

  it("both screens use the shared search, with automatic postcode lookup in the picker", () => {
    const explore = readFileSync(join(__dirname, "../app/(tabs)/explore.tsx"), "utf8");
    const picker = readFileSync(join(__dirname, "../components/HillPickerModal.tsx"), "utf8");
    expect(explore).toContain('searchTrainingHills("area", term, "", controller.signal)');
    expect(picker).toContain("searchTrainingHills(kind, q, location, controller.signal)");
    expect(picker).toContain("normalizeUkPostcode(query)");
    expect(picker).toContain("postcode ? 450 : 0");
    expect(picker).not.toContain("radius: 50");
  });
});
