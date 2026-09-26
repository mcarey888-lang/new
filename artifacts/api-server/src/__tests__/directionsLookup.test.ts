import { describe, expect, it } from "vitest";
import { directionsIdentity, distanceMetres, gpsConfirmsPlace } from "../services/directionsLookup.js";

describe("GPS-confirmed directions", () => {
  const summit = { lat: 53.1151, lng: -3.9983 };

  it("keeps route and summit coordinates in the destination identity", () => {
    const base = { hillName: "Tryfan", summitLat: summit.lat, summitLng: summit.lng };
    expect(directionsIdentity({ ...base, routeIdentityKey: "north-ridge" }))
      .not.toBe(directionsIdentity({ ...base, routeIdentityKey: "south-ridge" }));
    expect(directionsIdentity(base))
      .not.toBe(directionsIdentity({ ...base, summitLat: 50.1 }));
  });

  it("only confirms a fresh, accurate GPS arrival close to the provider pin", () => {
    const now = Date.now();
    const place = { lat: 53.12, lng: -4.01 };
    const fix = { ...place, accuracy: 12, timestamp: now - 1000 };
    expect(gpsConfirmsPlace(place, fix, now)).toBe(true);
    expect(gpsConfirmsPlace(place, { ...fix, lat: 53.125 }, now)).toBe(false);
    expect(gpsConfirmsPlace(place, { ...fix, accuracy: 60 }, now)).toBe(false);
    expect(gpsConfirmsPlace(place, { ...fix, timestamp: now - 120_000 }, now)).toBe(false);
    expect(distanceMetres(place, { lat: 53.125, lng: -4.01 })).toBeGreaterThan(80);
  });
});