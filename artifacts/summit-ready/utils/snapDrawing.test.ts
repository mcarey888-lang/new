import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  boundingRegion,
  emptyPathNetworkSource,
  parsePathNetworkGeoJson,
  regionContains,
  regionFromBbox,
  regionsOverlap,
  staticPathNetworkSource,
} from "./pathNetworkSource";
import { buildPathNetwork, type LatLng, type PathNetwork } from "./pathSnapping";
import {
  canExport,
  DETOUR_WARNING_FACTOR,
  drawingReducer,
  emptyDrawing,
  snappedFraction,
  splitDrawnRuns,
  type DrawingAction,
  type DrawingState,
} from "./snapDrawing";

const BASE: LatLng = { latitude: 53.11, longitude: -3.99 };
const at = (dLat: number, dLon = 0): LatLng => ({
  latitude: Number((BASE.latitude + dLat).toFixed(7)),
  longitude: Number((BASE.longitude + dLon).toFixed(7)),
});

/* A straight path, and a second path far enough away that nothing joins them. */
const MAIN = {
  wayId: 1,
  name: "Main Path",
  points: [at(0), at(0.001), at(0.002), at(0.003)],
};
const ISLAND = {
  wayId: 2,
  name: "Island Path",
  points: [at(0.02), at(0.021), at(0.022)],
};

const network = (): PathNetwork => buildPathNetwork([MAIN, ISLAND]);

const run = (
  actions: DrawingAction[],
  net: PathNetwork | null = network(),
  snapRadiusM = 60,
): DrawingState =>
  actions.reduce(
    (state, action) => drawingReducer(state, action, { network: net, snapRadiusM }),
    emptyDrawing,
  );

describe("tapping", () => {
  it("snaps a tap onto the path and names it", () => {
    const state = run([{ type: "tap", at: at(0.0005, 0.0002) }]);
    expect(state.points).toHaveLength(1);
    expect(state.points[0].origin).toBe("snapped");
    expect(state.points[0].pathName).toBe("Main Path");
    expect(state.points[0].position.longitude).toBeCloseTo(BASE.longitude, 6);
  });

  it("keeps a tap with no path near it, and says so", () => {
    const state = run([{ type: "tap", at: at(0, 0.01) }]);
    expect(state.points[0].origin).toBe("freehand");
    expect(state.points[0].position).toEqual(at(0, 0.01));
    expect(state.warnings.map(w => w.kind)).toContain("off_path");
  });

  it("builds a line along the path between two taps", () => {
    const state = run([
      { type: "tap", at: at(0) },
      { type: "tap", at: at(0.003) },
    ]);
    expect(state.coordinates.length).toBeGreaterThan(2);
    expect(state.lengthM).toBeGreaterThan(300);
    expect(state.pendingGap).toBeNull();
    expect(canExport(state)).toBe(true);
  });

  it("never repeats a coordinate", () => {
    const state = run([
      { type: "tap", at: at(0) },
      { type: "tap", at: at(0.001) },
      { type: "tap", at: at(0.003) },
    ]);
    for (let i = 1; i < state.coordinates.length; i += 1) {
      const a = state.coordinates[i - 1];
      const b = state.coordinates[i];
      expect(a.latitude === b.latitude && a.longitude === b.longitude).toBe(false);
    }
  });
});

describe("a gap the network cannot join", () => {
  const reachAcross: DrawingAction[] = [
    { type: "tap", at: at(0) },
    { type: "tap", at: at(0.021) },
  ];

  it("is offered, not taken", () => {
    /* The rule the whole design rests on. Nothing is added to the route until
       the person decides, so a gap can never be crossed by accident. */
    const state = run(reachAcross);
    expect(state.pendingGap).not.toBeNull();
    expect(state.pendingGap?.gapM).toBeGreaterThan(1000);
    expect(state.points).toHaveLength(1);
    expect(canExport(state)).toBe(false);
  });

  it("blocks further drawing until it is resolved", () => {
    const state = run([...reachAcross, { type: "tap", at: at(0.002) }]);
    expect(state.points).toHaveLength(1);
    expect(state.pendingGap).not.toBeNull();
  });

  it("is recorded as freehand when accepted, not hidden", () => {
    const state = run([...reachAcross, { type: "acceptGap" }]);
    expect(state.points).toHaveLength(2);
    expect(state.pendingGap).toBeNull();
    expect(state.freehandSegments).toHaveLength(1);
    expect(state.warnings.map(w => w.kind)).toContain("freehand_crossing");
    expect(snappedFraction(state)).toBeLessThan(0.5);
  });

  it("leaves the route untouched when declined", () => {
    const before = run([{ type: "tap", at: at(0) }]);
    const after = run([...reachAcross, { type: "rejectGap" }]);
    expect(after.points).toEqual(before.points);
    expect(after.coordinates).toEqual(before.coordinates);
    expect(after.pendingGap).toBeNull();
  });

  it("is dismissed by undo rather than removing a visible point", () => {
    const state = run([...reachAcross, { type: "undo" }]);
    expect(state.pendingGap).toBeNull();
    expect(state.points).toHaveLength(1);
  });
});

describe("undo", () => {
  it("removes the last point and rebuilds the line", () => {
    const three = run([
      { type: "tap", at: at(0) },
      { type: "tap", at: at(0.002) },
      { type: "tap", at: at(0.003) },
    ]);
    const two = drawingReducer(three, { type: "undo" }, { network: network() });
    expect(two.points).toHaveLength(2);
    expect(two.lengthM).toBeLessThan(three.lengthM);
  });

  it("forgets a freehand crossing that undo removed", () => {
    /* If the crossing survived, the rebuilt line would claim a straight leg
       between points that no longer sit either side of a gap. */
    const crossed = run([
      { type: "tap", at: at(0) },
      { type: "tap", at: at(0.021) },
      { type: "acceptGap" },
    ]);
    expect(crossed.freehandSegments).toHaveLength(1);
    const undone = drawingReducer(crossed, { type: "undo" }, { network: network() });
    expect(undone.points).toHaveLength(1);
    expect(undone.freehandSegments).toHaveLength(0);
    expect(undone.warnings.filter(w => w.kind === "freehand_crossing")).toHaveLength(0);
  });

  it("is harmless on an empty drawing", () => {
    const state = run([{ type: "undo" }]);
    expect(state).toEqual(emptyDrawing);
  });

  it("returns to exactly the empty state when everything is undone", () => {
    const state = run([
      { type: "tap", at: at(0) },
      { type: "tap", at: at(0.002) },
      { type: "undo" },
      { type: "undo" },
    ]);
    expect(state.points).toHaveLength(0);
    expect(state.coordinates).toHaveLength(0);
    expect(state.lengthM).toBe(0);
    expect(state.warnings).toHaveLength(0);
  });
});

describe("clear", () => {
  it("resets everything, including an unresolved gap", () => {
    const state = run([
      { type: "tap", at: at(0) },
      { type: "tap", at: at(0.021) },
      { type: "clear" },
    ]);
    expect(state).toEqual(emptyDrawing);
  });
});

describe("with no network at all", () => {
  it("still draws, entirely freehand", () => {
    /* A person in a region with no extract must be able to plan something. */
    const state = run(
      [
        { type: "tap", at: at(0) },
        { type: "tap", at: at(0.002) },
      ],
      null,
    );
    expect(state.points.every(p => p.origin === "freehand")).toBe(true);
    expect(state.coordinates).toHaveLength(2);
    expect(state.lengthM).toBeGreaterThan(100);
    expect(snappedFraction(state)).toBe(0);
    expect(canExport(state)).toBe(true);
  });
});

describe("snappedFraction", () => {
  it("is 1 for a route entirely on path", () => {
    const state = run([
      { type: "tap", at: at(0) },
      { type: "tap", at: at(0.003) },
    ]);
    expect(snappedFraction(state)).toBe(1);
  });

  it("is 0 for an empty drawing", () => {
    expect(snappedFraction(emptyDrawing)).toBe(0);
  });
});

describe("the detour threshold", () => {
  it("sits below the 1.70 measured on the real North Ridge gap", () => {
    /* If this rises above 1.70 the warning stops firing on the case that
       motivated it. */
    expect(DETOUR_WARNING_FACTOR).toBeLessThan(1.7);
    expect(DETOUR_WARNING_FACTOR).toBeGreaterThan(1);
  });

  it("warns when a leg wanders and stays quiet when it does not", () => {
    const dogleg = buildPathNetwork([
      { wayId: 1, name: "Straight", points: [at(0), at(0.001), at(0.002)] },
      { wayId: 2, name: "Dogleg", points: [at(0.002), at(0.003, 0.004), at(0.004)] },
    ]);
    const quiet = run([{ type: "tap", at: at(0) }, { type: "tap", at: at(0.002) }], dogleg);
    expect(quiet.warnings.filter(w => w.kind === "detour")).toHaveLength(0);

    const noisy = run([{ type: "tap", at: at(0.002) }, { type: "tap", at: at(0.004) }], dogleg);
    expect(noisy.warnings.filter(w => w.kind === "detour")).toHaveLength(1);
  });
});

describe("parsePathNetworkGeoJson", () => {
  const feature = (properties: Record<string, unknown>, geometry: unknown) => ({
    type: "Feature",
    properties,
    geometry,
  });

  it("concatenates a MultiLineString back into one way", () => {
    const { ways } = parsePathNetworkGeoJson({
      type: "FeatureCollection",
      features: [
        feature(
          { osm_id: 5, name: "Ridge" },
          {
            type: "MultiLineString",
            coordinates: [
              [[-3.99, 53.11], [-3.99, 53.111]],
              [[-3.99, 53.111], [-3.99, 53.112]],
            ],
          },
        ),
      ],
    });
    expect(ways).toHaveLength(1);
    expect(ways[0].points).toHaveLength(3);
    expect(ways[0].name).toBe("Ridge");
  });

  it("skips one broken feature instead of losing the region", () => {
    const { ways, skipped } = parsePathNetworkGeoJson({
      type: "FeatureCollection",
      features: [
        feature({ osm_id: 1 }, { type: "Point", coordinates: [0, 0] }),
        feature({ osm_id: 2 }, { type: "LineString", coordinates: [["x", "y"], [1, 2]] }),
        feature({ name: "No id" }, { type: "LineString", coordinates: [[-3.99, 53.11], [-3.99, 53.12]] }),
        feature({ osm_id: 4 }, { type: "LineString", coordinates: [[-3.99, 53.11], [-3.99, 53.12]] }),
      ],
    });
    expect(ways.map(w => w.wayId)).toEqual([4]);
    expect(skipped).toBe(3);
  });

  it("treats a blank name as no name", () => {
    const { ways } = parsePathNetworkGeoJson({
      type: "FeatureCollection",
      features: [
        feature({ osm_id: 1, name: "   " }, {
          type: "LineString",
          coordinates: [[-3.99, 53.11], [-3.99, 53.12]],
        }),
      ],
    });
    expect(ways[0].name).toBeNull();
  });

  it("rejects a document that is not a FeatureCollection", () => {
    expect(() => parsePathNetworkGeoJson({ type: "LineString" })).toThrow();
    expect(() => parsePathNetworkGeoJson(null)).toThrow();
  });
});

describe("regions", () => {
  const region = regionFromBbox([-4.05, 53.06, -3.94, 53.17]);

  it("reads a GeoJSON bbox in its own order", () => {
    expect(region.minLongitude).toBe(-4.05);
    expect(region.maxLatitude).toBe(53.17);
  });

  it("knows what it contains and what it touches", () => {
    expect(regionContains(region, { latitude: 53.11, longitude: -3.99 })).toBe(true);
    expect(regionContains(region, { latitude: 51, longitude: -1 })).toBe(false);
    expect(regionsOverlap(region, regionFromBbox([-4.0, 53.1, -3.9, 53.2]))).toBe(true);
    expect(regionsOverlap(region, regionFromBbox([-1, 51, -0.9, 51.1]))).toBe(false);
  });

  it("has no bounds for no ways", () => {
    expect(boundingRegion([])).toBeNull();
  });
});

describe("a static network source", () => {
  const document = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { osm_id: 1, name: "Path" },
        geometry: { type: "LineString", coordinates: [[-3.99, 53.11], [-3.99, 53.12]] },
      },
    ],
  };

  it("serves a region it overlaps and refuses one it does not", async () => {
    const source = staticPathNetworkSource({
      document,
      attribution: "© OpenStreetMap contributors, ODbL",
      describe: "Test extract",
      retrievedAt: "2026-09-27",
    });
    const near = await source.load(regionFromBbox([-4.0, 53.1, -3.98, 53.13]));
    expect(near?.ways).toHaveLength(1);
    expect(near?.attribution).toContain("OpenStreetMap");
    expect(near?.retrievedAt).toBe("2026-09-27");

    /* Null is a real answer: "no paths loaded here", not "no paths exist". */
    expect(await source.load(regionFromBbox([-1, 51, -0.9, 51.1]))).toBeNull();
  });

  it("has an empty source for when nothing is configured", async () => {
    expect(await emptyPathNetworkSource.load(regionFromBbox([-4, 53, -3.9, 53.1]))).toBeNull();
  });
});

/* End to end on the committed extract: the source parses it, the reducer draws
   on it, and the North Ridge behaves as measured. */
const EXTRACT = "../../summit-data-engine/data/processed/tryfan_candidate_path_network.geojson";

describe.skipIf(!existsSync(EXTRACT))("drawing on the committed Tryfan extract", () => {
  const load = async () => {
    const source = staticPathNetworkSource({
      document: JSON.parse(readFileSync(EXTRACT, "utf8")),
      attribution: "© OpenStreetMap contributors, ODbL",
      describe: "Ogwen and Snowdon path extract",
    });
    const bundle = await source.load(regionFromBbox([-4.05, 53.06, -3.94, 53.17]));
    if (!bundle) throw new Error("expected the extract to cover Tryfan");
    return { bundle, net: buildPathNetwork(bundle.ways) };
  };

  it("parses the whole extract with nothing skipped", async () => {
    const { bundle } = await load();
    expect(bundle.ways).toHaveLength(650);
    expect(bundle.region).not.toBeNull();
  });

  it("warns about the detour when two taps straddle the North Ridge gap", async () => {
    /* The measured case, driven through the reducer rather than the primitives:
       the legs route over unnamed ways at about 1.7x direct, so the person is
       told to look at it before accepting. */
    const { bundle, net } = await load();
    const byId = new Map(bundle.ways.map(w => [w.wayId, w]));
    const base = byId.get(1136472277);
    const upper = byId.get(1111458062);
    expect(base && upper).toBeTruthy();
    if (!base || !upper) return;

    const state = run(
      [
        { type: "tap", at: base.points[base.points.length - 1] },
        { type: "tap", at: upper.points[0] },
      ],
      net,
    );
    expect(state.pendingGap).toBeNull();
    expect(state.warnings.filter(w => w.kind === "detour")).toHaveLength(1);
    expect(canExport(state)).toBe(true);
  });

  it("offers a freehand crossing between two disconnected components", async () => {
    const { net } = await load();
    /* Two points on the network that no chain of edges joins. Found by walking
       components rather than hardcoded, so the test survives a new extract. */
    const seen = new Uint8Array(net.nodes.length);
    const components: number[][] = [];
    for (let start = 0; start < net.nodes.length; start += 1) {
      if (seen[start]) continue;
      const stack = [start];
      seen[start] = 1;
      const members: number[] = [];
      while (stack.length > 0) {
        const node = stack.pop() as number;
        members.push(node);
        for (const edge of net.adjacency[node]) {
          const [a, b] = net.edges[edge];
          const next = a === node ? b : a;
          if (!seen[next]) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
      components.push(members);
    }
    components.sort((a, b) => b.length - a.length);
    expect(components.length).toBeGreaterThan(1);

    const state = run(
      [
        { type: "tap", at: net.nodes[components[0][0]] },
        { type: "tap", at: net.nodes[components[1][0]] },
      ],
      net,
      5,
    );
    expect(state.pendingGap).not.toBeNull();
    expect(canExport(state)).toBe(false);

    const crossed = drawingReducer(state, { type: "acceptGap" }, { network: net, snapRadiusM: 5 });
    expect(crossed.freehandSegments).toHaveLength(1);
    expect(snappedFraction(crossed)).toBeLessThan(1);
  });
});

describe("splitDrawnRuns", () => {
  it("is empty for a drawing with nothing in it", () => {
    expect(splitDrawnRuns(emptyDrawing)).toEqual({ followed: [], asserted: [] });
  });

  it("reports an entirely on-path route as followed", () => {
    const state = run([
      { type: "tap", at: at(0) },
      { type: "tap", at: at(0.003) },
    ]);
    const { followed, asserted } = splitDrawnRuns(state);
    expect(asserted).toHaveLength(0);
    expect(followed).toHaveLength(1);
    expect(followed[0].length).toBe(state.coordinates.length);
  });

  it("separates an asserted crossing from the path it joins", () => {
    /* The distinction the map depends on: a stretch nobody surveyed must not be
       drawn the same as one that follows a mapped path. */
    const state = run([
      { type: "tap", at: at(0) },
      { type: "tap", at: at(0.002) },
      { type: "tap", at: at(0.021) },
      { type: "acceptGap" },
    ]);
    const { followed, asserted } = splitDrawnRuns(state);
    expect(followed).toHaveLength(1);
    expect(asserted).toHaveLength(1);
    // The asserted run spans the gap: two points, far apart.
    expect(asserted[0]).toHaveLength(2);
  });

  it("covers every leg exactly once", () => {
    const state = run([
      { type: "tap", at: at(0) },
      { type: "tap", at: at(0.001) },
      { type: "tap", at: at(0.003) },
    ]);
    const { followed, asserted } = splitDrawnRuns(state);
    expect(followed.length + asserted.length).toBe(state.points.length - 1);
  });
});
