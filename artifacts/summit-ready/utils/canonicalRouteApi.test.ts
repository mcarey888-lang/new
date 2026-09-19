import { describe, expect, it, vi } from "vitest";
import { fetchCanonicalRouteRecord } from "./canonicalRouteApi";

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
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("routeId=sde%3Aroute%3Anorth%402026-01"));
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
});