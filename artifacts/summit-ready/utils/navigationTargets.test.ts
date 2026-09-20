import { describe, expect, it } from "vitest";
import { activePrimaryTabForSegments, primaryTabTarget } from "./navigationTargets";

describe("approved five-tab navigation", () => {
  it("keeps Training destinations in the Training shell", () => {
    expect(primaryTabTarget("home", "training", null)).toBe("/(tabs)/dashboard");
    expect(primaryTabTarget("track", "training", null)).toBe("/(tabs)/trails");
    expect(primaryTabTarget("you", "training", null)).toBe("/(tabs)/account");
  });

  it("keeps Expedition Basecamp, Track and You in the Expedition shell", () => {
    expect(primaryTabTarget("home", "expedition", "expedition-1")).toBe("/(expedition)/base-camp");
    expect(primaryTabTarget("track", "expedition", "expedition-1")).toBe("/(expedition)/track");
    expect(primaryTabTarget("you", "expedition", "expedition-1")).toBe("/(expedition)/profile");
  });

  it("uses discovery as Expedition Basecamp when no expedition is active", () => {
    expect(primaryTabTarget("home", "expedition", null)).toBe("/(expedition)/mountains");
  });

  it("keeps Explore shared and Expeditions first-class", () => {
    expect(primaryTabTarget("explore", "training", null)).toBe("/(tabs)/explore");
    expect(primaryTabTarget("explore", "expedition", "expedition-1")).toBe("/(tabs)/explore");
    expect(primaryTabTarget("expeditions", "training", null)).toBe("/(expedition)/mountains");
  });

  it("derives active tabs from the full route group", () => {
    expect(activePrimaryTabForSegments(["(expedition)", "route"])).toBe("expeditions");
    expect(activePrimaryTabForSegments(["(expedition)", "progress"])).toBe("expeditions");
    expect(activePrimaryTabForSegments(["(expedition)", "track"])).toBe("track");
    expect(activePrimaryTabForSegments(["(tabs)", "account"])).toBe("you");
    expect(activePrimaryTabForSegments(["(tabs)", "challenges"])).toBeNull();
  });
});