import { describe, expect, it } from "vitest";
import { buildHillDetail, locationCompatible, type RouteFacts } from "../services/hillDetail.js";

const noDatabase = async (): Promise<RouteFacts | null> => null;

describe("deterministic hill detail", () => {
  it("keeps selected identity and facts when optional narration fails", async () => {
    const result = await buildHillDetail({
      hillName: "Local Fell",
      location: "Cumbria",
      summitLat: 54.5,
      summitLng: -3.1,
      elevation: 420,
      routeDistance: 8.2,
      estimatedTime: "3 hours",
      difficulty: "Moderate",
      surface: "Rocky path",
    }, {
      findRouteFacts: noDatabase,
      narrate: async () => { throw new Error("offline"); },
      development: true,
    });

    expect(result).toMatchObject({
      description: expect.stringContaining("Local Fell"),
      summitLat: 54.5,
      summitLng: -3.1,
      startPoint: expect.objectContaining({
        name: "Start point not verified",
        lat: null,
        lng: null,
      }),
      routes: [expect.objectContaining({
        distance: 8.2,
        elevationGain: 420,
        difficulty: "Moderate",
        estimatedTime: "3 hours",
      })],
    });
    expect(result.warnings).toContain(
      "Optional narration was unavailable; deterministic wording was used.",
    );
  });

  it("keeps every selected route fact when a nearby same-name database route differs", async () => {
    const result = await buildHillDetail({
      hillName: "Same Name",
      summitLat: 51,
      summitLng: -3,
      elevation: 100,
      routeDistance: 2,
      estimatedTime: "1 hour",
      grade: "Easy",
      surface: "Grass",
    }, {
      findRouteFacts: async () => ({
        ascent: 650,
        distance: 12,
        duration: "4 hours",
        difficulty: "Hard",
        terrain: "Rock",
        lat: 51.001,
        lng: -3.001,
        source: "seeded_trails",
      }),
    });

    expect(result.summitLat).toBe(51);
    expect(result.summitLng).toBe(-3);
    expect(result.routes).toEqual([expect.objectContaining({
      elevationGain: 100,
      distance: 2,
      estimatedTime: "1 hour",
      difficulty: "Easy",
    })]);
    expect(result.provenance).toMatchObject({
      metrics: {
        ascent: "selected_hill",
        distance: "selected_hill",
        duration: "selected_hill",
        difficulty: "selected_hill",
        terrain: "selected_hill",
      },
    });
  });

  it("keeps route lookup coordinates as unverified metadata and uses the seeded area for map searches", async () => {
    const result = await buildHillDetail({
      hillName: "Ladybrook Valley Interest Trail",
      location: "Manchester",
      summitLat: 53.377728,
      summitLng: -2.1408849,
    }, {
      findRouteFacts: async () => ({
        lat: 53.377728,
        lng: -2.1408849,
        location: "Peak District, Derbyshire",
        source: "seeded_trails",
      }),
    });

    expect(result.startPoint).toMatchObject({ lat: null, lng: null });
    expect(result.summitLat).toBe(53.377728);
    expect(result.summitLng).toBe(-2.1408849);
    expect(result.mapSearchContext).toBe("Peak District, Derbyshire");
    expect(result.mapCoordinates).toEqual({
      lat: 53.377728,
      lng: -2.1408849,
      provenance: "unverified_route_location",
    });
    expect(result.provenance).toMatchObject({
      mapCoordinates: "unverified_route_location",
      startPoint: "unverified",
    });
  });

  it("rejects a nearby same-name database route with a different public identity", async () => {
    const requestedIdentity =
      "route:v1:seeded_osm:same-name:51.00000,-3.00000";
    const result = await buildHillDetail({
      hillName: "Same Name",
      routeIdentityKey: requestedIdentity,
      summitLat: 51,
      summitLng: -3,
      routeDistance: 2,
      estimatedTime: "1 hour",
      grade: "Easy",
    }, {
      findRouteFacts: async (_name, _coordinates, _location, suppliedIdentity) => {
        expect(suppliedIdentity).toBe(requestedIdentity);
        return {
          routeIdentityKey: "route:v1:seeded_osm:same-name:51.00100,-3.00100",
          ascent: 650,
          distance: 12,
          duration: "4 hours",
          difficulty: "Hard",
          lat: 51.001,
          lng: -3.001,
          source: "seeded_trails",
        };
      },
    });

    expect(result.summitLat).toBe(51);
    expect(result.routes).toEqual([]);
    expect(result.provenance).toMatchObject({
      identity: "selected_hill",
      metrics: { ascent: "unknown", distance: "selected_hill" },
    });
  });

  it("passes location to lookup and lets the database fill only missing facts", async () => {
    let lookupLocation: string | undefined;
    let lookupIdentity: string | undefined;
    const result = await buildHillDetail({
      hillName: "Shared Hill",
      location: "Northshire",
      routeIdentityKey: "route:v1:seeded_osm:shared-hill:54.00000,-2.00000",
      elevation: 250,
      grade: "Moderate",
    }, {
      findRouteFacts: async (_name, _coordinates, location, routeIdentityKey) => {
        lookupLocation = location;
        lookupIdentity = routeIdentityKey;
        return {
          routeIdentityKey,
          ascent: 900,
          distance: 7.5,
          duration: "2 hours",
          difficulty: "Hard",
          terrain: "Rock",
          source: "seeded_trails",
        };
      },
    });

    expect(lookupLocation).toBe("Northshire");
    expect(lookupIdentity).toBe("route:v1:seeded_osm:shared-hill:54.00000,-2.00000");
    expect(result.routes).toEqual([expect.objectContaining({
      elevationGain: 250,
      distance: 7.5,
      estimatedTime: "2 hours",
      difficulty: "Moderate",
    })]);
  });

  it("requires a location-compatible seeded record when coordinates are absent", () => {
    expect(locationCompatible(undefined, "Peak District, Derbyshire")).toBe(false);
    expect(locationCompatible("Cumbria", "Peak District, Derbyshire")).toBe(false);
    expect(locationCompatible("Cumbria, England", "Peak District, Derbyshire, England")).toBe(false);
    expect(locationCompatible("England", "Peak District, Derbyshire, England")).toBe(false);
    expect(locationCompatible("Derbyshire", "Peak District, Derbyshire")).toBe(true);
    expect(locationCompatible("Peak District", "Peak District, Derbyshire")).toBe(true);
    expect(locationCompatible("North York Moors", "North Wales")).toBe(false);
    expect(locationCompatible("South Wales", "North Wales")).toBe(false);
    expect(locationCompatible("North York Moors", "York, North Yorkshire")).toBe(true);
  });

  it("allows narration wording only and ignores extra invented fields", async () => {
    const result = await buildHillDetail({
      hillName: "Trusted Hill",
      summitLat: 53,
      summitLng: -2,
      elevation: 300,
      routeDistance: 6,
      estimatedTime: "2 hours",
      difficulty: "Moderate",
      surface: "Moorland",
    }, {
      findRouteFacts: noDatabase,
      narrate: async () => ({
        description: "Optional coaching.",
        elevation: 9999,
        routes: [{ distance: 999 }],
        summitLat: 0,
      } as never),
    });

    expect(result.description).toBe("Optional coaching.");
    expect(result.summitLat).toBe(53);
    expect(result.routes).toEqual([expect.objectContaining({
      elevationGain: 300,
      distance: 6,
    })]);
  });

  it("leaves unknown numerical route gaps explicit and preserves legacy fields", async () => {
    const result = await buildHillDetail({
      hillName: "Unknown Hill",
      location: "Unknownshire",
    }, {
      findRouteFacts: noDatabase,
    });

    expect(result).toHaveProperty("description");
    expect(result).toHaveProperty("startPoint", expect.objectContaining({
      lat: null,
      lng: null,
    }));
    expect(result).toHaveProperty("routes");
    expect(result).toHaveProperty("summitLat", null);
    expect(result).toHaveProperty("summitLng", null);
    expect(result).toHaveProperty("provenance");
    expect(result.routes).toEqual([]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      "Route ascent is unknown; summit altitude has not been substituted.",
      "Route distance is unknown.",
      "Route duration is unknown.",
    ]));
  });

  it("never replaces a selected Snowdon approach with a name-only ascent correction", async () => {
    const snowdon = await buildHillDetail({
      hillName: "Snowdon",
      elevation: 726,
      routeDistance: 14.5,
      estimatedTime: "6 hours",
      difficulty: "Hard",
    }, { findRouteFacts: noDatabase });
    expect(snowdon.routes).toEqual([expect.objectContaining({ elevationGain: 726 })]);
    expect(snowdon.provenance).toMatchObject({
      metrics: { ascent: "selected_hill", distance: "selected_hill" },
    });
  });

  it("only fills a researched ascent for an explicit recognized approach identity", async () => {
    const routeIdentityKey =
      "route:v1:legacy_cache:snowdon-llanberis-path:53.06850,-4.07630";
    const snowdon = await buildHillDetail({
      hillName: "Snowdon Llanberis Path",
      routeIdentityKey,
      summitLat: 53.0685,
      summitLng: -4.0763,
      routeDistance: 14.5,
      estimatedTime: "6 hours",
      difficulty: "Hard",
    }, {
      findRouteFacts: async (_name, _coordinates, _location, suppliedIdentity) => ({
        routeIdentityKey: suppliedIdentity,
        lat: 53.0685,
        lng: -4.0763,
        source: "cached_hills",
      }),
    });
    expect(snowdon.routes).toEqual([expect.objectContaining({ elevationGain: 980 })]);
    expect(snowdon.provenance).toMatchObject({
      metrics: { ascent: "verified_correction" },
    });

    const ambiguous = await buildHillDetail({
      hillName: "Snowdon",
      routeDistance: 12,
      estimatedTime: "5 hours",
      difficulty: "Hard",
    }, { findRouteFacts: noDatabase });
    expect(ambiguous.routes).toEqual([]);
    expect(ambiguous.warnings).toContain(
      "A researched ascent exists for this hill, but its route identity is ambiguous; no ascent correction was applied.",
    );
  });

  it("does not authorize a researched correction from an arbitrary identity", async () => {
    const arbitrary = await buildHillDetail({
      hillName: "Snowdon Llanberis Path",
      routeIdentityKey: "route:v1:legacy_cache:not-this-route:0.00000,0.00000",
      summitLat: 53.0685,
      summitLng: -4.0763,
      routeDistance: 14.5,
      estimatedTime: "6 hours",
      difficulty: "Hard",
    }, { findRouteFacts: noDatabase });

    expect(arbitrary.routes).toEqual([]);
    expect(arbitrary.provenance).toMatchObject({
      metrics: { ascent: "unknown" },
    });
    expect(arbitrary.warnings).toContain(
      "A researched ascent exists for this hill, but its route identity is ambiguous; no ascent correction was applied.",
    );
  });

  it("keeps objective hazards authoritative", async () => {
    const crib = await buildHillDetail({
      hillName: "Crib Goch",
      elevation: 500,
      routeDistance: 8,
      estimatedTime: "5 hours",
      difficulty: "Hard",
    }, { findRouteFacts: noDatabase });
    expect(crib).toMatchObject({
      hazardLevel: "severe",
      safetyWarning: expect.stringContaining("SEVERE EXPOSURE WARNING"),
    });
  });
});