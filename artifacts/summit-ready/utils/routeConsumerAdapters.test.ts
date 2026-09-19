import { describe, expect, it } from "vitest";
import type { NearbyHill } from "../context/AppContext";
import {
  buildTrainingRouteIntelligence,
  routeReferenceFromNearbyHill,
} from "./routeConsumerAdapters";
import { buildExpeditionStageLaunchContext } from "./trackingLaunchContext";

const hill = (overrides: Partial<NearbyHill> = {}): NearbyHill => ({
  name: "Local ridge",
  routeIdentityKey: undefined,
  summitIdentityKey: undefined,
  elevation: 400,
  distance: 6,
  repeats: 1,
  totalElevation: 400,
  surface: "trail",
  grade: "moderate",
  emoji: "",
  ...overrides,
});

describe("route consumer adapters", () => {
  it("does not promote same-name legacy recommendations to canonical trust", () => {
    const result = routeReferenceFromNearbyHill(hill({ name: "Tryfan", routeDataStatus: "verified" }));
    expect(result.status).toBe("unavailable");
    expect(result.routeIdentityKey).toBeNull();
  });

  it("keeps same-name distinct route references separate", () => {
    const first = routeReferenceFromNearbyHill(hill({
      routeIdentityKey: "sde:route:north@1",
      summitIdentityKey: "sde:mountain:tryfan",
      routeDataStatus: "verified",
    }));
    const second = routeReferenceFromNearbyHill(hill({
      routeIdentityKey: "sde:route:south@1",
      summitIdentityKey: "sde:mountain:tryfan",
      routeDataStatus: "verified",
    }));
    expect(first.routeIdentityKey).not.toBe(second.routeIdentityKey);
    expect(first.status).toBe("verified");
  });

  it("returns honest unavailable DNA without canonical records", () => {
    const result = buildTrainingRouteIntelligence("sde:route:north@1", []);
    expect(result.matches.availability).toBe("unavailable");
    expect(result.matches.matches).toHaveLength(0);
  });

  it("does not imply geometry or GPS evidence from a degraded reference", () => {
    const result = routeReferenceFromNearbyHill(hill({
      routeIdentityKey: "route:legacy",
      routeDataStatus: "unverified",
      lat: 52,
      lng: -3,
    }));
    expect(result.status).toBe("degraded");
    expect(result.reason).toContain("verified provenance");
  });

  it("keeps tracker context stable without copying route geometry into activity data", () => {
    const context = buildExpeditionStageLaunchContext(
      hill({
        routeIdentityKey: "sde:route:north@1",
        summitIdentityKey: "sde:mountain:tryfan",
      }),
      "expedition-1",
      { simulatedElevation: 400 },
    );
    expect(context.trackingMode).toBe("expedition-route");
    expect(context.routeIdentityKey).toBe("sde:route:north@1");
    expect(context.summitIdentityKey).toBe("sde:mountain:tryfan");
    expect(JSON.parse(context.stageSnapshot)).not.toHaveProperty("geometry");
  });
});