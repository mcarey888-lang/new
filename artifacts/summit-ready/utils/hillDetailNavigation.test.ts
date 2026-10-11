import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hillDetailNavigation } from "./hillDetailNavigation";
import type { NearbyHill } from "../context/AppContext";

const hill: NearbyHill = {
  name: "Winter Hill", elevation: 456, distance: 2.8, repeats: 2,
  totalElevation: 912, surface: "Mixed", grade: "Moderate", emoji: "⛰️",
};

describe("session hill information and directions", () => {
  it("opens the same detail page as Explore with local context for legacy hills", () => {
    expect(hillDetailNavigation(hill, "Haslingden")).toEqual({
      pathname: "/hill-detail",
      params: {
        name: "Winter Hill", elevation: "456", distance: "2.8", location: "Haslingden",
        routeIdentityKey: "", summitIdentityKey: "", lat: "", lng: "",
        routeDistance: "", estimatedTime: "", routeType: "",
        grade: "Moderate", surface: "Mixed", emoji: "⛰️",
      },
    });
  });
  it("preserves exact canonical identities and coordinates, including zero", () => {
    const result = hillDetailNavigation({
      ...hill, routeIdentityKey: "route:1", summitIdentityKey: "summit:1",
      lat: 0, lng: -2.514, routeDistance: 6.4, estimatedTime: "2 hours", routeType: "circular",
    }, "Lancashire");
    expect(result.params).toMatchObject({
      routeIdentityKey: "route:1", summitIdentityKey: "summit:1",
      lat: "0", lng: "-2.514", routeDistance: "6.4",
      estimatedTime: "2 hours", routeType: "circular",
    });
  });
  it("keeps changing the hill separate from opening hill details", () => {
    const source = readFileSync(join(__dirname, "../app/session-detail.tsx"), "utf8");
    expect(source).toContain("router.push(hillDetailNavigation(assignedHill, summitGoal?.location ?? \"\"))");
    expect(source).toContain("onActionPress={assignedHill ? () => setHillPickerOpen(true) : undefined}");
    expect(source).toContain("View hill & parking directions");
  });
  it("does not send an empty picker back to the old Hills screen", () => {
    const source = readFileSync(join(__dirname, "../components/HillPickerModal.tsx"), "utf8");
    expect(source).toContain('router.push("/(tabs)/explore")');
    expect(source).not.toContain('router.push("/(tabs)/hills")');
  });
});
