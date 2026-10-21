import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { hillMapTarget, hillMapNavigation } from "./hillMapTarget";

describe("hill detail map actions", () => {
  it("opens our map at the selected hill without drawing or recording", () => {
    const target = hillMapTarget({ lat: 54.635, lng: -3.0442 });
    expect(target).toEqual({ lat: 54.635, lng: -3.0442, verified: false });
    expect(hillMapNavigation(target!)).toEqual({
      pathname: "/route-planner", params: { focusLat: "54.635", focusLng: "-3.0442" },
    });
  });
  it.each(["osm_overpass", "osm_nominatim", "seeded_osm"])("accepts %s mapped locations", source => {
    expect(hillMapTarget({ lat: 54.6, lng: -3, routeIdentityKey: `route:v1:${source}:123` })?.verified).toBe(true);
  });
  it("prefers verified server coordinates and can use them without URL coordinates", () => {
    expect(hillMapTarget({
      lat: null, lng: null,
      detail: { summitLat: 54.635, summitLng: -3.0442, provenance: { mapCoordinates: "verified" } },
    })).toEqual({ lat: 54.635, lng: -3.0442, verified: true });
  });
  it.each([[null, null], [NaN, -3], [54, Infinity], [91, -3], [54, -181]])(
    "does not invent coordinates for %s,%s", (lat, lng) => {
      expect(hillMapTarget({ lat, lng })).toBeNull();
    },
  );
  it("does not promote unverified generated detail coordinates into map targets", () => {
    expect(hillMapTarget({
      lat: null, lng: null,
      detail: { summitLat: 54, summitLng: -3, provenance: { mapCoordinates: "unverified_route_location" } },
    })).toBeNull();
  });
  it("keeps lookup failures visible on web and offers a user-initiated directions link", () => {
    const source = readFileSync(new URL("../app/hill-detail.tsx", import.meta.url), "utf8");
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('Open parking directions');
    expect(source).toContain('signal: controller.signal');
    expect(source).toContain('clearTimeout(timeout)');
    expect(source).toContain('if (Platform.OS !== "web")');
  });
});
