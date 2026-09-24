import { describe, expect, it, vi } from "vitest";
import { fetchCanonicalRouteRecord, hydrateCanonicalRouteRecords } from "./canonicalRouteApi";

describe("canonical route API adapter", () => {
  it("preserves a verified versioned record", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "available", reasons: [], record: { source: "canonical" } }),
    }));
    const result = await fetchCanonicalRouteRecord(
      "sde:route:north@2026-01",
      "sde:mountain:tryfan",
    );
    expect(result.status).toBe("available");
    expect(result.record).toEqual({ source: "canonical" });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("routeId=sde%3Aroute%3Anorth%402026-01"),
      expect.objectContaining({ headers: {} }),
    );
    vi.unstubAllGlobals();
  });

  it("uses the current Clerk token for the protected canonical record read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "degraded", reasons: ["missing_geometry"], record: null }),
    }));
    const result = await fetchCanonicalRouteRecord(
      "sde:route:north@4",
      "sde:mountain:tryfan",
      async () => "clerk-token",
    );
    expect(result.record).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      { headers: { Authorization: "Bearer clerk-token" } },
    );
    vi.unstubAllGlobals();
  });

  it("maps unavailable and network failures without inventing a record", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: "unavailable", reasons: ["version_not_found"], record: null }),
    }));
    expect((await fetchCanonicalRouteRecord("sde:route:missing@1", "sde:mountain:m")).record).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await fetchCanonicalRouteRecord("sde:route:missing@1", "sde:mountain:m")).status).toBe("unavailable");
    vi.unstubAllGlobals();
  });

  it("hydrates persisted target and candidate references after restart", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "available", reasons: [], record: { source: "canonical" } }),
    }));
    const records = await hydrateCanonicalRouteRecords([
      { routeId: "sde:route:target@1", mountainId: "sde:mountain:t" },
      { routeId: null, mountainId: null },
    ]);
    expect(records).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});