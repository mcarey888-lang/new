import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hillDetailNavigation, isMappedTrainingHill, sessionHillTitle, resolveSessionHill } from "./hillDetailNavigation";
import type { NearbyHill, PlanSession, TrainingWeek } from "../context/AppContext";

describe("session hill identity", () => {
  const bull: NearbyHill = {
    name: "Bull Hill", elevation: 316, distance: 4, repeats: 1, totalElevation: 316,
    surface: "Moorland", grade: "Moderate", emoji: "⛰️",
    lat: 53.69, lng: -2.28, routeIdentityKey: "route:v1:osm_overpass:bull",
  };
  const slate = { ...bull, name: "Top o'Slate", elevation: 125 };
  const week = { hills: [slate, bull] } as TrainingWeek;
  const session: PlanSession = {
    type: "hill", label: "Hill Repeats — Bull Hill", description: "Bull Hill (316m per climb)",
    targetElevation: 316, duration: "60–90 min",
  };
  it("opens Bull Hill, not the first hill in the week", () => {
    expect(resolveSessionHill(session, week, undefined, [slate, bull])).toEqual(bull);
  });
  it("preserves complete mapped facts for existing plans", () => {
    const legacyWeek = { hills: [{ name: bull.name, elevation: 316, distance: 4, repeats: 1, totalElevation: 316 }] } as TrainingWeek;
    expect(resolveSessionHill(session, legacyWeek, undefined, [bull])?.routeIdentityKey).toBe(bull.routeIdentityKey);
  });
  it("respects an explicit changed hill over the original plan", () => {
    expect(resolveSessionHill(session, week, slate, [bull, slate])).toEqual(slate);
  });
  it("uses persisted hill identity rather than presentation wording", () => {
    expect(resolveSessionHill({ ...session, label: "Hill practice", hillName: "Bull Hill" }, week, undefined, [bull])).toEqual(bull);
  });
  it("does not guess for a generic or missing hill", () => {
    expect(resolveSessionHill({ ...session, label: "Hill Repeats", description: "Repeat climbs" }, week, undefined, [bull])).toBeNull();
    expect(resolveSessionHill({ ...session, hillName: "Missing Hill" }, week, undefined, [bull])).toBeNull();
  });
  it("does not guess between same-named hills", () => {
    expect(resolveSessionHill(session, week, undefined, [bull, { ...bull, lat: 54.5 }])).toBeNull();
  });
  it("does not attach a training hill to cardio sessions", () => {
    expect(resolveSessionHill({ ...session, type: "cardio" }, week, bull, [bull])).toBeNull();
  });
});

const hill: NearbyHill = {
  name: "Winter Hill", elevation: 456, distance: 2.8, repeats: 2,
  totalElevation: 912, surface: "Mixed", grade: "Moderate", emoji: "⛰️",
};

describe("session hill information and directions", () => {
  it("uses the assigned hill even when a saved session still has its original title", () => {
    expect(sessionHillTitle("hill", "Winter Hill Reps", "Pendle Hill")).toBe("Pendle Hill Reps");
    expect(sessionHillTitle("bigDay", "Winter Hill Big Day", "Rivington Pike")).toBe("Rivington Pike Big Day");
    expect(sessionHillTitle("cardio", "Incline Treadmill", "Winter Hill")).toBe("Incline Treadmill");
    expect(sessionHillTitle("hill", "Hill session")).toBe("Hill session");
  });
  it("opens the same detail page as Explore with local context for legacy hills", () => {
    expect(hillDetailNavigation(hill, "Haslingden")).toEqual({
      pathname: "/hill-detail",
      params: {
        name: "Winter Hill", elevation: "456", elevationEstimated: "false", distance: "2.8", location: "Haslingden",
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
    expect(source).toContain("router.push(hillDetailNavigation(mappedHill, summitGoal?.location ?? \"\"))");
    expect(source).toContain("onActionPress={assignedHill ? () => setHillPickerOpen(true) : undefined}");
    expect(source).toContain("View hill & parking directions");
  });
  it("does not send an empty picker back to the old Hills screen", () => {
    const source = readFileSync(join(__dirname, "../components/HillPickerModal.tsx"), "utf8");
    expect(source).toContain('router.push("/(tabs)/explore")');
    expect(source).not.toContain('router.push("/(tabs)/hills")');
  });
  it("refreshes the picker from the user's area and excludes old ungrounded suggestions", () => {
    const source = readFileSync(join(__dirname, "../components/HillPickerModal.tsx"), "utf8");
    expect(source).toContain('searchOnline("area", term)');
    expect(source).toContain('searchTrainingHills(kind, q, location, controller.signal)');
    expect(source).toContain("hills.filter(isMappedTrainingHill)");
  });
  it("pins mapped summit coordinates rather than asking a map app to guess a street", () => {
    const source = readFileSync(join(__dirname, "../app/hill-detail.tsx"), "utf8");
    expect(source).toContain('router.push(hillMapNavigation(mapTarget))');
    expect(source).toContain('hillMapTarget({ lat: hillLat, lng: hillLng, routeIdentityKey, detail })');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).not.toContain('openMapsForHill(null, null, name ?? "", false');
  });
  it("does not reuse old AI climb figures just because they have coordinates", () => {
    expect(isMappedTrainingHill({ ...hill, lat: 53.8, lng: -2.3 })).toBe(false);
    expect(isMappedTrainingHill({ ...hill, routeIdentityKey: "route:v1:legacy_cache:brooks-hill" })).toBe(false);
    expect(isMappedTrainingHill({ ...hill, routeIdentityKey: "route:v1:osm_overpass:node:123" })).toBe(true);
    expect(isMappedTrainingHill({ ...hill, routeIdentityKey: "route:v1:osm_nominatim:node:29798197" })).toBe(true);
    const source = readFileSync(join(__dirname, "../app/session-detail.tsx"), "utf8");
    expect(source).toContain("mappedHill?.elevation ?? 0");
    expect(source).toContain("Refresh this hill's location and climb data");
  });
});
