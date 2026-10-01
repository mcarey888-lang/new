import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildPathNetwork,
  distanceM,
  drawSnappedRoute,
  drawnRouteToGeoJson,
  routeAlongNetwork,
  snapToNetwork,
  type LatLng,
  type PathNetwork,
  type PathWay,
  type SnapResult,
} from "../services/routing/pathSnapping";

/* A short north-south path and a short east-west path meeting at a junction,
   plus an island that touches neither. Coordinates are near Tryfan so the
   local projection is exercised at a realistic latitude. */
const BASE: LatLng = { latitude: 53.11, longitude: -3.99 };

const at = (dLat: number, dLon: number): LatLng => ({
  latitude: Number((BASE.latitude + dLat).toFixed(7)),
  longitude: Number((BASE.longitude + dLon).toFixed(7)),
});

const JUNCTION = at(0.002, 0);

const NORTH_SOUTH: PathWay = {
  wayId: 1,
  name: "North Path",
  points: [at(0, 0), at(0.001, 0), JUNCTION, at(0.003, 0), at(0.004, 0)],
};
const EAST_WEST: PathWay = {
  wayId: 2,
  name: "Cross Path",
  points: [JUNCTION, at(0.002, 0.001), at(0.002, 0.002)],
};
const ISLAND: PathWay = {
  wayId: 3,
  name: "Island Path",
  points: [at(0.02, 0.02), at(0.021, 0.02), at(0.022, 0.02)],
};

const network = (): PathNetwork => buildPathNetwork([NORTH_SOUTH, EAST_WEST, ISLAND]);

const mustSnap = (net: PathNetwork, point: LatLng, radius = 60): SnapResult => {
  const snapped = snapToNetwork(net, point, radius);
  if (!snapped) throw new Error("expected the point to snap");
  return snapped;
};

describe("distanceM", () => {
  it("is zero on itself and symmetric", () => {
    expect(distanceM(BASE, BASE)).toBe(0);
    expect(distanceM(BASE, at(0.01, 0.01))).toBeCloseTo(distanceM(at(0.01, 0.01), BASE), 6);
  });

  it("puts a degree of latitude at about 111 km", () => {
    expect(distanceM({ latitude: 53, longitude: 0 }, { latitude: 54, longitude: 0 })).toBeCloseTo(
      111_195,
      -3,
    );
  });
});

describe("buildPathNetwork", () => {
  it("shares a node where two ways meet, so a route can turn onto the other", () => {
    const net = network();
    const junction = net.nodes.findIndex(
      n => n.latitude === JUNCTION.latitude && n.longitude === JUNCTION.longitude,
    );
    expect(junction).toBeGreaterThanOrEqual(0);
    const wayIds = new Set(net.adjacency[junction].map(edge => net.edgeWayId[edge]));
    expect(wayIds).toEqual(new Set([1, 2]));
  });

  it("does not connect ways that merely come near each other", () => {
    /* The property the whole design rests on: proximity is not connection. */
    const net = network();
    const islandNode = net.nodes.findIndex(n => n.latitude === at(0.021, 0.02).latitude);
    const reachable = new Set<number>([islandNode]);
    const stack = [islandNode];
    while (stack.length > 0) {
      const node = stack.pop() as number;
      for (const edge of net.adjacency[node]) {
        const [a, b] = net.edges[edge];
        const next = a === node ? b : a;
        if (!reachable.has(next)) {
          reachable.add(next);
          stack.push(next);
        }
      }
    }
    expect(reachable.size).toBe(3); // the island alone
  });

  it("drops repeated positions rather than making zero-length edges", () => {
    const net = buildPathNetwork([
      { wayId: 9, name: null, points: [at(0, 0), at(0, 0), at(0.001, 0)] },
    ]);
    expect(net.edges).toHaveLength(1);
    expect(net.edgeLengthM[0]).toBeGreaterThan(0);
  });

  it("handles an empty network without throwing", () => {
    const net = buildPathNetwork([]);
    expect(net.nodes).toHaveLength(0);
    expect(snapToNetwork(net, BASE, 50)).toBeNull();
  });
});

describe("snapToNetwork", () => {
  it("returns a point on the path, not the query", () => {
    const net = network();
    const offPath = at(0.001, 0.0002); // a little east of the north-south path
    const snapped = mustSnap(net, offPath);
    /* Guard against shape drift: the snapped point lives under `position`, and
       a flat longitude appearing here would mean a caller could read the wrong
       one silently. Cast because the api-server tsconfig is stricter than the
       app's and rejects reading a property the type does not have — the
       runtime check this test exists for is unchanged. */
    expect((snapped as unknown as Record<string, unknown>)["longitude"]).toBeUndefined();
    expect(snapped.position.longitude).toBeCloseTo(BASE.longitude, 6);
    expect(snapped.distanceM).toBeGreaterThan(0);
    expect(snapped.distanceM).toBeLessThan(20);
  });

  it("names the path it snapped to, so the UI can show it", () => {
    const net = network();
    expect(mustSnap(net, at(0.002, 0.0015)).wayName).toBe("Cross Path");
  });

  it("refuses a tap beyond the radius instead of snapping across a valley", () => {
    const net = network();
    const wayOff = at(0.05, 0.05);
    expect(snapToNetwork(net, wayOff, 40)).toBeNull();
    // The same tap does snap once the radius genuinely covers it.
    expect(snapToNetwork(net, wayOff, 10_000)).not.toBeNull();
  });

  it("picks the nearer of two paths", () => {
    const net = network();
    const nearCross = at(0.00195, 0.0012);
    expect(mustSnap(net, nearCross).wayId).toBe(2);
  });

  it("clamps to an endpoint rather than running off the end of a segment", () => {
    const net = network();
    const beyondTheEnd = at(0.01, 0);
    const snapped = mustSnap(net, beyondTheEnd, 10_000);
    expect(snapped.position.latitude).toBeCloseTo(at(0.004, 0).latitude, 6);
  });
});

describe("routeAlongNetwork", () => {
  it("follows the path and turns at the junction", () => {
    const net = network();
    const from = mustSnap(net, at(0, 0));
    const to = mustSnap(net, at(0.002, 0.002));
    const leg = routeAlongNetwork(net, from, to);
    expect(leg.kind).toBe("routed");
    if (leg.kind !== "routed") return;
    // It must pass through the junction to get from one way to the other.
    expect(
      leg.coordinates.some(
        c => c.latitude === JUNCTION.latitude && c.longitude === JUNCTION.longitude,
      ),
    ).toBe(true);
    expect(leg.lengthM).toBeGreaterThan(leg.directM);
  });

  it("REFUSES to bridge a gap rather than straight-lining across it", () => {
    /* The single most important behaviour in this module. A straight line here
       would invent path that does not exist, which is the failure the data
       engine's candidate report was written to argue against. */
    const net = network();
    const onPath = mustSnap(net, at(0.002, 0));
    const onIsland = mustSnap(net, at(0.021, 0.02), 10_000);
    const leg = routeAlongNetwork(net, onPath, onIsland);
    expect(leg.kind).toBe("disconnected");
    if (leg.kind !== "disconnected") return;
    expect(leg.gapM).toBeGreaterThan(1000);
  });

  it("reports a span on a single segment without entering the graph", () => {
    const net = network();
    const a = mustSnap(net, at(0.0002, 0));
    const b = mustSnap(net, at(0.0008, 0));
    const leg = routeAlongNetwork(net, a, b);
    expect(leg.kind).toBe("routed");
    if (leg.kind !== "routed") return;
    expect(leg.coordinates).toHaveLength(2);
    expect(leg.detourFactor).toBe(1);
  });

  it("takes the shorter of two ways round", () => {
    /* A diamond: both arms reach the far node, one is clearly longer. */
    const net = buildPathNetwork([
      { wayId: 1, name: "Short", points: [at(0, 0), at(0.001, 0), at(0.002, 0)] },
      { wayId: 2, name: "Long", points: [at(0, 0), at(0.001, 0.004), at(0.002, 0)] },
    ]);
    const leg = routeAlongNetwork(net, mustSnap(net, at(0, 0)), mustSnap(net, at(0.002, 0)));
    expect(leg.kind).toBe("routed");
    if (leg.kind !== "routed") return;
    expect(leg.coordinates.every(c => Math.abs(c.longitude - BASE.longitude) < 1e-9)).toBe(true);
  });
});

describe("drawSnappedRoute", () => {
  it("joins legs without duplicating the shared vertex", () => {
    const net = network();
    const snaps = [
      mustSnap(net, at(0, 0)),
      mustSnap(net, JUNCTION),
      mustSnap(net, at(0.002, 0.002)),
    ];
    const drawn = drawSnappedRoute(net, snaps);
    expect(drawn.kind).toBe("drawn");
    if (drawn.kind !== "drawn") return;
    for (let i = 1; i < drawn.coordinates.length; i += 1) {
      const previous = drawn.coordinates[i - 1];
      const current = drawn.coordinates[i];
      expect(previous.latitude === current.latitude && previous.longitude === current.longitude)
        .toBe(false);
    }
  });

  it("refuses the whole draw and says which leg broke", () => {
    const net = network();
    const snaps = [
      mustSnap(net, at(0, 0)),
      mustSnap(net, JUNCTION),
      mustSnap(net, at(0.021, 0.02), 10_000),
    ];
    const drawn = drawSnappedRoute(net, snaps);
    expect(drawn.kind).toBe("gap");
    if (drawn.kind !== "gap") return;
    expect(drawn.atIndex).toBe(1);
  });

  it("is a single point for a single tap, and empty for none", () => {
    const net = network();
    const one = drawSnappedRoute(net, [mustSnap(net, at(0, 0))]);
    expect(one.kind === "drawn" && one.coordinates).toHaveLength(1);
    const none = drawSnappedRoute(net, []);
    expect(none.kind === "drawn" && none.coordinates).toHaveLength(0);
  });

  it("reports the leg that wandered most", () => {
    const net = buildPathNetwork([
      { wayId: 1, name: "Straight", points: [at(0, 0), at(0.001, 0), at(0.002, 0)] },
      { wayId: 2, name: "Dogleg", points: [at(0.002, 0), at(0.003, 0.003), at(0.004, 0)] },
    ]);
    const drawn = drawSnappedRoute(net, [
      mustSnap(net, at(0, 0)),
      mustSnap(net, at(0.002, 0)),
      mustSnap(net, at(0.004, 0)),
    ]);
    expect(drawn.kind).toBe("drawn");
    if (drawn.kind !== "drawn") return;
    expect(drawn.worstDetour?.atIndex).toBe(1);
    expect(drawn.worstDetour?.factor).toBeGreaterThan(1.5);
  });
});

describe("drawnRouteToGeoJson", () => {
  const drawn = drawnRouteToGeoJson({
    sourceId: "draft-1",
    name: "North Ridge",
    mountainName: "Tryfan",
    coordinates: [at(0, 0), at(0.001, 0)],
    author: "SummitReady editorial",
    drawnOn: "OSM path network, snapped",
    requiresScrambling: true,
  });

  it("is longitude-first, as GeoJSON requires", () => {
    const geometry = (drawn as { features: Array<{ geometry: { coordinates: number[][] } }> })
      .features[0].geometry;
    expect(geometry.coordinates[0][0]).toBeCloseTo(BASE.longitude, 6);
    expect(geometry.coordinates[0][1]).toBeCloseTo(BASE.latitude, 6);
  });

  it("carries the property names the engine's editorial importer reads", () => {
    const feature = (drawn as { features: Array<Record<string, any>> }).features[0];
    /* These keys are consumed by summit_data_engine.editorial.source; renaming
       one here silently drops it from the imported route. */
    expect(Object.keys(feature.properties).sort()).toEqual([
      "aliases",
      "author",
      "description",
      "drawn_on",
      "mountain",
      "name",
      "requires_scrambling",
      "version",
    ]);
    expect(feature.properties.requires_scrambling).toBe(true);
    expect(feature.properties.version).toBe("1");
  });
});

/* The committed OSM extract, which is what makes this feature testable at all.
   Skipped rather than failed when absent, because the app must build without
   the data engine checked out beside it. */
const EXTRACT =
  "../../summit-data-engine/data/processed/tryfan_candidate_path_network.geojson";

describe.skipIf(!existsSync(EXTRACT))("the committed Tryfan path network", () => {
  const loadWays = (): PathWay[] => {
    const doc = JSON.parse(readFileSync(EXTRACT, "utf8")) as {
      features: Array<{
        properties: { osm_id: number; name: string | null };
        geometry: { type: string; coordinates: unknown };
      }>;
    };
    const ways: PathWay[] = [];
    for (const feature of doc.features) {
      const geometry = feature.geometry;
      const parts = (
        geometry.type === "MultiLineString" ? geometry.coordinates : [geometry.coordinates]
      ) as number[][][];
      const points: LatLng[] = [];
      for (const part of parts) {
        for (const position of part) {
          if (!Array.isArray(position)) continue;
          const point = { latitude: position[1], longitude: position[0] };
          const last = points[points.length - 1];
          if (
            !last ||
            last.latitude !== point.latitude ||
            last.longitude !== point.longitude
          ) {
            points.push(point);
          }
        }
      }
      if (points.length >= 2) {
        ways.push({ wayId: feature.properties.osm_id, name: feature.properties.name, points });
      }
    }
    return ways;
  };

  const TRYFAN: LatLng = { latitude: 53.1149311, longitude: -3.997578 };

  it("builds fast enough to do on opening a map region", () => {
    const started = Date.now();
    const net = buildPathNetwork(loadWays());
    expect(net.edges.length).toBeGreaterThan(19_000);
    // Generous for CI; it measures around 75 ms locally on 19,341 edges.
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("snaps a tap near the summit onto a real path", () => {
    const net = buildPathNetwork(loadWays());
    const snapped = snapToNetwork(net, TRYFAN, 60);
    expect(snapped).not.toBeNull();
    expect(snapped?.distanceM).toBeLessThan(60);
  });

  it("is not one connected graph, so a draw can legitimately fail", () => {
    /* 73 components at the time of writing. A person can tap two points that
       genuinely cannot be joined, and the UI has to have an answer for it. */
    const net = buildPathNetwork(loadWays());
    const seen = new Uint8Array(net.nodes.length);
    let components = 0;
    for (let start = 0; start < net.nodes.length; start += 1) {
      if (seen[start]) continue;
      components += 1;
      const stack = [start];
      seen[start] = 1;
      while (stack.length > 0) {
        const node = stack.pop() as number;
        for (const edge of net.adjacency[node]) {
          const [a, b] = net.edges[edge];
          const next = a === node ? b : a;
          if (!seen[next]) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
    }
    expect(components).toBeGreaterThan(1);
  });

  it("routes up the North Ridge but wanders, which is why taps must be frequent", () => {
    /* Two taps 304 m apart — the gap data/processed/tryfan_review.md reports in
       the named Crib Ogwen chain — do route, over unnamed ways the engine's
       importer refused to use. The line is real path, but at 1.7x direct it is
       not necessarily the ridge the person meant. This test exists to keep that
       fact visible rather than letting it be discovered in the field. */
    const ways = loadWays();
    const net = buildPathNetwork(ways);
    const byId = new Map(ways.map(w => [w.wayId, w]));
    const base = byId.get(1136472277);
    const upper = byId.get(1111458062);
    expect(base && upper).toBeTruthy();
    if (!base || !upper) return;

    const from = snapToNetwork(net, base.points[base.points.length - 1], 60);
    const to = snapToNetwork(net, upper.points[0], 60);
    expect(from && to).toBeTruthy();
    if (!from || !to) return;

    const leg = routeAlongNetwork(net, from, to);
    expect(leg.kind).toBe("routed");
    if (leg.kind !== "routed") return;
    expect(leg.directM).toBeGreaterThan(290);
    expect(leg.directM).toBeLessThan(320);
    expect(leg.detourFactor).toBeGreaterThan(1.5);
  });
});
