import { describe, it, expect, vi } from "vitest";
import { createHikingRouter, type HostedRoutingStore } from "../services/routing/openRouteService";

const a = { latitude: 53.12, longitude: -4 };
const b = { latitude: 53.121, longitude: -4 };
const response = () => ({
  type: "FeatureCollection",
  features: [{ geometry: { type: "LineString", coordinates: [[-4, 53.12], [-4, 53.1205], [-4, 53.121]] },
    properties: { summary: { distance: 111.2 } } }],
});
function memoryStore() {
  const values = new Map<string, unknown>();
  const store: HostedRoutingStore = {
    get: vi.fn(async key => values.get(key) ?? null),
    put: vi.fn(async (key, value) => { values.set(key, value); }),
    reserve: vi.fn(async () => true),
  };
  return { store, values };
}
function setup(body: unknown = response(), status = 200) {
  const { store, values } = memoryStore();
  const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
  return { router: createHikingRouter({ key: "test-credential", store, fetcher }), store, values, fetcher };
}

describe("hosted hiking routing", () => {
  it("requests foot-hiking, bounded radiuses and real GeoJSON, without a key in the URL", async () => {
    const { router, fetcher } = setup();
    const result = await router.snap(a, b, 45);
    expect(result.outcome).toBe("routed");
    expect(fetcher.mock.calls[0][0]).toBe("https://api.openrouteservice.org/v2/directions/foot-hiking/geojson");
    const init = fetcher.mock.calls[0][1]!;
    expect(JSON.parse(init.body as string)).toEqual({
      coordinates: [[-4, 53.12], [-4, 53.121]], radiuses: [45, 45], instructions: false, elevation: false,
    });
    expect((init.headers as Record<string, string>).Authorization).toBe("test-credential");
  });
  it("reuses persisted results across router instances without consuming allowance", async () => {
    const { router, store, fetcher } = setup();
    await router.snap(a, b, 45);
    const restarted = createHikingRouter({ key: "test-credential", store, fetcher });
    expect((await restarted.snap(a, b, 45)).outcome).toBe("routed");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.reserve).toHaveBeenCalledTimes(1);
    expect([...((store.put as any).mock.calls[0][0])].length).toBe(64);
  });
  it("keeps nearby but different taps out of the same cache key", async () => {
    const { router, fetcher } = setup();
    await router.snap(a, b, 45);
    await router.snap(a, { ...b, longitude: -4.000001 }, 45);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("deduplicates simultaneous identical legs", async () => {
    const { router, fetcher } = setup();
    const results = await Promise.all([router.snap(a, b, 45), router.snap(a, b, 45)]);
    expect(results.every(r => r.outcome === "routed")).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("uses the dedicated snap endpoint for the first point", async () => {
    const { router, fetcher } = setup({ locations: [{ location: [-4, 53.121], name: "Footpath" }] });
    expect(await router.snap(null, b, 45)).toMatchObject({
      outcome: "snapped", point: { lat: 53.121, lng: -4 }, wayName: "Footpath",
    });
    expect(String(fetcher.mock.calls[0][0])).toContain("/v2/snap/foot-hiking");
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({ locations: [[-4, 53.121]], radius: 45 });
  });
  it("distinguishes an explicitly unmapped first point from a malformed reply", async () => {
    expect(await setup({ locations: [null] }).router.snap(null, b, 45)).toEqual({ outcome: "off_path", which: "to" });
    expect((await setup({}).router.snap(null, b, 45)).outcome).toBe("unavailable");
  });
  it.each([401, 403, 500, 503])("does not fabricate a route on HTTP %s", async status => {
    const { router, store } = setup({}, status);
    expect((await router.snap(a, b, 45)).outcome).toBe("unavailable");
    expect(store.put).not.toHaveBeenCalled();
  });
  it("blocks requests after a provider rate limit without treating it as off-path", async () => {
    const { router, fetcher } = setup({}, 429);
    expect(await router.snap(a, b, 45)).toMatchObject({ outcome: "unavailable", status: 429 });
    expect(await router.snap(a, { ...b, longitude: -4.0001 }, 45)).toMatchObject({ outcome: "unavailable", status: 429 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not call the provider once the shared budget is exhausted", async () => {
    const { router, store, fetcher } = setup();
    vi.mocked(store.reserve).mockResolvedValue(false);
    expect(await router.snap(a, b, 45)).toMatchObject({ outcome: "unavailable", status: 429 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("fails closed when quota accounting is unavailable", async () => {
    const { router, store, fetcher } = setup();
    vi.mocked(store.reserve).mockRejectedValue(new Error("database failure"));
    expect((await router.snap(a, b, 45)).outcome).toBe("unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("returns a valid live route even when caching its result fails", async () => {
    const { router, store } = setup();
    vi.mocked(store.put).mockRejectedValue(new Error("database failure"));
    expect((await router.snap(a, b, 45)).outcome).toBe("routed");
  });
  it("rejects geometry snapped to a different mountain", async () => {
    const bad = response();
    bad.features[0].geometry.coordinates[0] = [-5, 54];
    const { router, store } = setup(bad);
    expect((await router.snap(a, b, 45)).outcome).toBe("unavailable");
    expect(store.put).not.toHaveBeenCalled();
  });
  it("rejects invalid, empty or inconsistent provider geometry", async () => {
    for (const body of [{}, { type: "FeatureCollection", features: [] },
      { ...response(), features: [{ ...response().features[0], properties: { summary: { distance: 20000 } } }] }]) {
      const { router, store } = setup(body);
      expect((await router.snap(a, b, 45)).outcome).toBe("unavailable");
      expect(store.put).not.toHaveBeenCalled();
    }
  });
  it("does not trust malformed persisted geometry", async () => {
    const { router, store, fetcher } = setup();
    vi.mocked(store.get).mockResolvedValue({ outcome: "routed", points: "bad cache", lengthM: 111 });
    expect((await router.snap(a, b, 45)).outcome).toBe("routed");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("bounds a provider or response body that never finishes", async () => {
    vi.useFakeTimers();
    try {
      const { store } = memoryStore();
      const fetcher = vi.fn<typeof fetch>(() => new Promise(() => {}));
      const router = createHikingRouter({ key: "test", store, fetcher });
      const result = router.snap(a, b, 45);
      await vi.advanceTimersByTimeAsync(8001);
      expect((await result).outcome).toBe("unavailable");
      expect(store.put).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
