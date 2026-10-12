import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchExpeditionResponse } from "./expeditionRequest";

afterEach(() => vi.useRealTimers());
const payload = { targetMountain: "Everest", userLocation: "lake district", daysOverride: 3 };

describe("bounded expedition requests", () => {
  it("preserves the full payload and decoded result", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ targetProfile: { name: "Everest" }, recommendedHills: [] })));
    const result = await fetchExpeditionResponse("/api/virtual-expedition", payload, new AbortController().signal, 1000, fetcher);
    expect(result.ok).toBe(true);
    expect(result.body.targetProfile).toEqual({ name: "Everest" });
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual(payload);
  });
  it("preserves route-choice conflicts rather than swallowing them", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ code: "TARGET_ROUTE_SELECTION_REQUIRED", routes: [{ identityKey: "verified-route" }] }), { status: 409 }));
    const result = await fetchExpeditionResponse("/api/virtual-expedition", payload, new AbortController().signal, 1000, fetcher);
    expect(result.status).toBe(409);
    expect(result.body.routes).toHaveLength(1);
  });
  it("ends a stalled fetch with an actionable timeout and aborts the network request", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const promise = fetchExpeditionResponse("/api/virtual-expedition", payload, new AbortController().signal, 50, fetcher);
    const assertion = expect(promise).rejects.toThrow("Your choices are unchanged");
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
    expect(fetcher.mock.calls[0][1]!.signal!.aborted).toBe(true);
  });
  it("also bounds a stalled response body", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(async () => ({ status: 200, ok: true, json: () => new Promise(() => {}) }) as Response);
    const promise = fetchExpeditionResponse("/api/virtual-expedition", payload, new AbortController().signal, 50, fetcher);
    const assertion = expect(promise).rejects.toThrow("taking too long");
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
  });
  it("cancels explicitly even if a transport ignores abort", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const promise = fetchExpeditionResponse("/api/virtual-expedition", payload, controller.signal, 1000, fetcher);
    const assertion = expect(promise).rejects.toThrow("cancelled");
    controller.abort();
    await assertion;
    expect(fetcher.mock.calls[0][1]!.signal!.aborted).toBe(true);
  });
  it("reports HTML or empty responses without exposing their contents", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("<html>private server diagnostic</html>", { status: 503 }));
    await expect(fetchExpeditionResponse("/api/virtual-expedition", payload, new AbortController().signal, 1000, fetcher))
      .rejects.toThrow("unreadable response (503)");
  });
});

describe("custom expedition recovery screen", () => {
  const screen = readFileSync(join(__dirname, "../components/ExpeditionMountainsScreen.tsx"), "utf8");
  it("keeps the resolved target during summit discovery and gives errors their own screen", () => {
    expect(screen).toContain("if (resolveOnly) setResults(null)");
    expect(screen).toContain("if (fetchError && failedRequest)");
    expect(screen.indexOf("if (fetchError && failedRequest)")).toBeLessThan(screen.indexOf('if (view === "results"'));
    expect(screen).toContain('testID="retry-custom-expedition"');
    for (const field of ["targetRouteIdentityKey", "targetCountry", "targetRegion", "selectedRouteIdentityKeys", "daysOverride", "resolveOnly"]) {
      expect(screen).toContain(`failedRequest.${field}`);
    }
  });
  it("ignores stale and intentionally cancelled responses", () => {
    expect(screen.match(/expeditionRequestRef.current !== controller \|\| controller.signal.aborted/g)).toHaveLength(2);
    expect(screen).toContain('accessibilityLabel="Cancel expedition search"');
  });
});
