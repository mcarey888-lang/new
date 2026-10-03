import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PlannedRoute } from "./plannedRouteApi";
import {
  personalRouteHandoff, personalRouteTrackingParams,
  readPersonalRouteHandoff, savePersonalRouteHandoff, validPersonalRouteHandoff,
} from "./personalRouteHandoff";

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
  },
}));

const route: PlannedRoute = {
  id: "personal-route-one", name: "My Ogwen walk", hillSlug: null,
  anchors: [{ lat: 53.1228932, lng: -3.9985554 }, { lat: 53.1219, lng: -3.9989 }],
  geometry: [{ lat: 53.1228932, lng: -3.9985554 }, { lat: 53.1219, lng: -3.9989 }],
  legs: [{ kind: "straight", lengthM: 115 }],
  lengthM: 115, ascentM: null, descentM: null, fullySnapped: false,
};
beforeEach(() => { storage.clear(); vi.useRealTimers(); });

describe("personal saved route tracking handoff", () => {
  it("keeps the exact planned line, unknown ascent and off-path warning", () => {
    const context = personalRouteHandoff("owner-one", route);
    expect(context.route.geometry).toEqual(route.geometry);
    expect(context.route.ascentM).toBeNull();
    expect(context.route.fullySnapped).toBe(false);
  });
  it("launches independent GPS recording rather than a canonical expedition stage", () => {
    const params = personalRouteTrackingParams(personalRouteHandoff("owner-one", route));
    expect(params).toEqual({
      trackingMode: "freehike", plannedRouteId: route.id, plannedRouteName: route.name,
    });
    expect(params).not.toHaveProperty("expeditionId");
    expect(params).not.toHaveProperty("routeId");
    expect(params).not.toHaveProperty("canonicalRouteId");
  });
  it("stores a device handoff for the authenticated owner only", async () => {
    await savePersonalRouteHandoff(personalRouteHandoff("owner-one", route));
    expect(await readPersonalRouteHandoff("owner-one", route.id)).toMatchObject({ ownerUserId: "owner-one" });
    expect(await readPersonalRouteHandoff("owner-two", route.id)).toBeNull();
  });
  it("rejects foreign ownership and a different route identity", () => {
    const context = personalRouteHandoff("owner-one", route);
    expect(validPersonalRouteHandoff(context, "owner-two", route.id)).toBe(false);
    expect(validPersonalRouteHandoff(context, "owner-one", "another-route")).toBe(false);
    expect(validPersonalRouteHandoff(context, "", route.id)).toBe(false);
  });
  it.each([
    [], [{ lat: 53, lng: -4 }],
    [{ lat: 100, lng: -4 }, { lat: 53, lng: -4 }],
    [{ lat: 53, lng: Infinity }, { lat: 53, lng: -4 }],
  ])("refuses unusable geometry %j", geometry => {
    expect(() => personalRouteHandoff("owner-one", { ...route, geometry })).toThrow(/usable geometry/);
  });
  it("expires old navigation caches but allows an owner-validated resume snapshot", async () => {
    vi.useFakeTimers();
    const context = personalRouteHandoff("owner-one", route);
    await savePersonalRouteHandoff(context);
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(await readPersonalRouteHandoff("owner-one", route.id)).toBeNull();
    expect(validPersonalRouteHandoff(JSON.parse(JSON.stringify(context)), "owner-one", route.id)).toBe(true);
  });
});

describe("tracking integration invariants", () => {
  const read = (file: string) => readFileSync(join(__dirname, "..", file), "utf8");
  const tracker = read("app/hike-tracking.tsx");
  it("draws the planned line separately from actual GPS and preserves it in the checkpoint", () => {
    expect(tracker).toContain("personalRoute.context.route.geometry.map(point => [point.lat, point.lng])");
    expect(tracker).toContain('type: "referenceRoute"');
    expect(tracker).toContain("personalRoute: personalRoute.context ?? undefined");
    expect(tracker).toContain("personalRoute.restore(session.personalRoute, ownerUserId)");
    expect(tracker).toContain("routeIdRef.current = session.routeId");
  });
  it("does not silently start a blank hike when a chosen route cannot load", () => {
    expect(tracker).toContain("if (!personalRoute.ready) return");
    expect(tracker).toContain("disabled={!canStart || !personalRoute.ready}");
    expect(tracker).toContain("Could not load your saved route");
  });
  it("never inherits a pending expedition when following a personal route", () => {
    expect(tracker).toContain('params.restore === "1" || params.plannedRouteId');
    expect(tracker).toContain('params.referenceRouteName || params.plannedRouteId || params.restore === "1"');
  });
  it("protects an existing recording and exposes Follow route in both entry points", () => {
    const button = read("components/track/FollowRouteButton.tsx");
    expect(button).toContain("readActiveHike<HikeCheckpoint>(owner)");
    expect(button).toContain("Resume current hike");
    expect(button).toContain("currentOwner.current !== owner");
    expect(read("components/track/SavedRoutesSection.tsx")).toContain("<FollowRouteButton route={route}");
    expect(read("app/route-planner.tsx")).toContain("<FollowRouteButton route={selectedSavedRoute.route}");
    expect(read("app/route-planner.tsx")).toContain('if (msg.type === "routeChanged") setSelectedSavedRoute(null)');
  });
});