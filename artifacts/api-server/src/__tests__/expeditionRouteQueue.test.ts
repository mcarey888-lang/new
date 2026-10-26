import { describe, expect, it } from "vitest";
import { buildExpeditionRouteQueue } from "../services/expeditionRouteQueue";

describe("expedition source requirements", () => {
  const stage = { challenge_id: "first", route_key: "sample", route_name: "Named ridge",
    region: "Scotland", distance_km: "10", ascent_m: 900 };
  it("deduplicates shared requirements without doubling manual distances", () => {
    const result = buildExpeditionRouteQueue([stage, { ...stage, challenge_id: "second" }], []);
    expect(result.summary).toEqual({ expeditions: 2, stages: 2, distinctRoutes: 1 });
    expect(result.routes[0].stageUses).toBe(2);
    expect(result.routes[0].distanceKm).toEqual([10]);
    expect(result.routes[0].reviews).toEqual([]);
    expect(result.routes[0].blockers.join(" ")).toContain("approval is unavailable");
  });
  it("links explicit route keys only, never fuzzy names", () => {
    const reviews = [{ id: "one", routeKey: "sample", candidateKey: "Source fragment",
      revisionVersion: "v1", canonicalGeometryId: null },
    { id: "two", routeKey: "other", candidateKey: "Named ridge",
      revisionVersion: "v1", canonicalGeometryId: null }];
    const result = buildExpeditionRouteQueue([stage], reviews);
    expect(result.routes[0].reviews.map(r => r.id)).toEqual(["one"]);
    expect(result.routes[0].blockers.join(" ")).toContain("No current canonical");
  });
  it("does not merge reused keys across different regions", () => {
    expect(buildExpeditionRouteQueue([stage, { ...stage, region: "Wales" }], []).routes).toHaveLength(2);
  });
});
