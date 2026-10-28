import { describe, expect, it, vi } from "vitest";
vi.mock("@workspace/db", () => ({ executeEngineReadOnlyQuery: vi.fn() }));
import { canonicalTrainingHills } from "../services/mountain/canonicalTrainingHills";
import type { VerifiedCanonicalMountain } from "../services/mountain/canonicalMountainLookup";
import type { osmPeaksToHills } from "../routes/hills-unified";

const summit: VerifiedCanonicalMountain = {
  id: "catalogue-uuid", canonicalSourceKey: "dobih:123", sourceFeatureId: "123",
  name: "Real Fell", elevationM: 450, latitude: 53.7, longitude: -2.3,
  provenanceVersion: "reviewed", matchedBy: "canonical_name", routes: [],
};
describe("canonical training hill discovery", () => {
  it("uses verified catalogue identities without promoting estimated ascent to route verification", async () => {
    const lookup = vi.fn(async () => [summit]);
    const estimate = vi.fn(async () => [{
      summitIdentityKey: "osm:node:1", elevation: 170, summitElevationASL: 450,
      routeDataStatus: "terrain_calculated",
    }]) as unknown as typeof osmPeaksToHills;
    const hills = await canonicalTrainingHills(53.7, -2.3, 25, 0, estimate, lookup);
    expect(lookup).toHaveBeenCalledWith({ centerLat: 53.7, centerLng: -2.3, radiusKm: 25, limit: 50 });
    expect(hills![0]).toMatchObject({
      summitId: "dobih:123", summitIdentityKey: "canonical:catalogue-uuid",
      routeId: "route:terrain:dobih:123", routeIdentityKey: "route:terrain:dobih:123",
      elevation: 170, summitElevationASL: 450, dataSource: "canonical_verified",
      routeDataStatus: "terrain_calculated",
    });
    expect(estimate).toHaveBeenCalledWith(expect.any(Array), 53.7, -2.3, 25, 0, true, true);
  });
  it("allows mapped-provider fallback for catalogue gaps without estimating fabricated peaks", async () => {
    const estimate = vi.fn() as unknown as typeof osmPeaksToHills;
    expect(await canonicalTrainingHills(53, -2, 25, 0, estimate, async () => [])).toBeNull();
    expect(estimate).not.toHaveBeenCalled();
  });
  it("propagates catalogue and terrain outages instead of returning an empty success", async () => {
    const estimate = vi.fn().mockRejectedValue(new Error("terrain unavailable")) as unknown as typeof osmPeaksToHills;
    await expect(canonicalTrainingHills(53, -2, 25, 0, estimate, async () => [summit])).rejects.toThrow("terrain unavailable");
    await expect(canonicalTrainingHills(53, -2, 25, 0, estimate, async () => { throw new Error("catalogue unavailable"); })).rejects.toThrow("catalogue unavailable");
  });
});
