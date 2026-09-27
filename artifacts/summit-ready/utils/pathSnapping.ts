/**
 * Snap-to-path drawing over a vector path network.
 *
 * The feature this exists for: a person planning a route taps roughly along a
 * path on the map, and the line that results follows the real path instead of
 * their finger. Hiiker and Komoot both do this, and it is the difference
 * between a planned route you can navigate and a sketch.
 *
 * WHY THIS IS SAFE WHEN AUTO-GENERATION WAS NOT
 * ---------------------------------------------
 * `summit-osm-candidate-report` in the data engine argues against generating
 * routes automatically: the Tryfan North Ridge is split by a 304 m gap, and any
 * rule loose enough to bridge it invents a third of a kilometre of ridge.
 *
 * Snapping does not have that problem, because a person makes every decision
 * about where the route goes. Snapping only removes finger jitter, and
 * `routeAlongNetwork` follows edges that exist. The one thing it must never do
 * is quietly straight-line across a gap — so it returns null instead, and
 * crossing a gap has to be something the person does knowingly. That is the
 * whole safety argument, and `disconnected` is the test that pins it.
 *
 * NO DEPENDENCIES
 * ---------------
 * No turf, no MapLibre, no native module. The network is plain arrays and the
 * queries are arithmetic, because this has to run inside a gesture handler at
 * 60 fps on a phone, and because a mapping dependency is a large commitment to
 * take on for point-to-segment distance.
 *
 * COORDINATES
 * -----------
 * `{ latitude, longitude }` throughout, matching react-native-maps. GeoJSON is
 * longitude-first; that flip happens only in `drawnRouteToGeoJson`.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** One way from a path network, e.g. an OSM `highway=path`. */
export interface PathWay {
  wayId: number;
  name: string | null;
  points: LatLng[];
}

/**
 * A network prepared for querying.
 *
 * Built once per map region and then queried on every tap, so the shape is
 * chosen for query speed rather than for readability: flat typed arrays, and
 * adjacency as an index into a single edge list.
 */
export interface PathNetwork {
  /** Deduplicated positions. Segment endpoints that coincide become one node. */
  nodes: LatLng[];
  /** `[nodeA, nodeB]` index pairs, one per segment. */
  edges: Array<[number, number]>;
  /** Metres per edge, precomputed because routing needs it on every relaxation. */
  edgeLengthM: number[];
  /** Which way each edge came from, so a snap can report the path's name. */
  edgeWayId: number[];
  /** `adjacency[node]` is a list of edge indices touching that node. */
  adjacency: number[][];
  wayNames: Map<number, string | null>;
}

export interface SnapResult {
  /** The point on the network nearest the query, not the query itself. */
  position: LatLng;
  /** How far the person's tap was from the path, in metres. */
  distanceM: number;
  edgeIndex: number;
  wayId: number;
  wayName: string | null;
  /** 0–1 along the edge, so routing can split it. */
  t: number;
}

const EARTH_RADIUS_M = 6371008.8;
const DEG = Math.PI / 180;

/** Great-circle metres. Used for lengths and for anything user-facing. */
export function distanceM(a: LatLng, b: LatLng): number {
  const lat1 = a.latitude * DEG;
  const lat2 = b.latitude * DEG;
  const dLat = lat2 - lat1;
  const dLon = (b.longitude - a.longitude) * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, h)));
}

/**
 * Local planar projection about a reference latitude.
 *
 * Point-to-segment distance has no closed form on a sphere, and iterating for
 * one is far too slow to run per segment per tap. Over the span of a path
 * segment — tens to hundreds of metres — scaling longitude by cos(latitude) is
 * accurate to well under a metre, which is finer than the tap it is
 * interpreting and finer than the GPS that will follow the result.
 */
function project(point: LatLng, cosRefLat: number): { x: number; y: number } {
  return {
    x: point.longitude * DEG * EARTH_RADIUS_M * cosRefLat,
    y: point.latitude * DEG * EARTH_RADIUS_M,
  };
}

/** Where along `a`→`b` the nearest point to `p` falls, clamped to the segment. */
function segmentT(p: LatLng, a: LatLng, b: LatLng, cosRefLat: number): number {
  const pp = project(p, cosRefLat);
  const pa = project(a, cosRefLat);
  const pb = project(b, cosRefLat);
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const lengthSquared = dx * dx + dy * dy;
  // A zero-length segment has no direction to project onto; its start is the
  // only candidate. Consecutive duplicates are removed at build time, so this
  // is a guard rather than an expected case.
  if (lengthSquared === 0) return 0;
  const t = ((pp.x - pa.x) * dx + (pp.y - pa.y) * dy) / lengthSquared;
  return Math.max(0, Math.min(1, t));
}

/** Linear interpolation along a segment. Fine at segment scale. */
function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

/** Seven decimal places is OSM's own precision (~11 mm), so keying on it is lossless. */
function nodeKey(point: LatLng): string {
  return `${point.latitude.toFixed(7)},${point.longitude.toFixed(7)}`;
}

function samePoint(a: LatLng, b: LatLng): boolean {
  return a.latitude === b.latitude && a.longitude === b.longitude;
}

/**
 * Append positions, skipping any that repeats the one before it.
 *
 * A snapped point that landed exactly on a node is both the leg's start and its
 * first graph node, so assembling naively emits it twice. A repeated position
 * carries no length and draws nothing, but it makes the line's point count a
 * lie and would be copied into published geometry.
 */
function appendWithoutRepeats(into: LatLng[], points: readonly LatLng[]): void {
  for (const point of points) {
    const last = into[into.length - 1];
    if (last === undefined || !samePoint(last, point)) into.push(point);
  }
}

/**
 * Build a queryable network from ways.
 *
 * Positions that coincide become one node, which is what makes the network
 * routable: two ways meeting at a junction share that node, so a route can turn
 * from one onto the other. Ways that only come *near* each other stay
 * unconnected — that is the 304 m gap, preserved rather than closed.
 */
export function buildPathNetwork(ways: PathWay[]): PathNetwork {
  const nodes: LatLng[] = [];
  const nodeIndex = new Map<string, number>();
  const edges: Array<[number, number]> = [];
  const edgeLengthM: number[] = [];
  const edgeWayId: number[] = [];
  const adjacency: number[][] = [];
  const wayNames = new Map<number, string | null>();

  const nodeFor = (point: LatLng): number => {
    const key = nodeKey(point);
    const existing = nodeIndex.get(key);
    if (existing !== undefined) return existing;
    const index = nodes.length;
    nodes.push(point);
    nodeIndex.set(key, index);
    adjacency.push([]);
    return index;
  };

  for (const way of ways) {
    wayNames.set(way.wayId, way.name);
    for (let i = 0; i + 1 < way.points.length; i += 1) {
      const a = nodeFor(way.points[i]);
      const b = nodeFor(way.points[i + 1]);
      if (a === b) continue; // a repeated position, carrying no length
      const edgeIndex = edges.length;
      edges.push([a, b]);
      edgeLengthM.push(distanceM(nodes[a], nodes[b]));
      edgeWayId.push(way.wayId);
      adjacency[a].push(edgeIndex);
      adjacency[b].push(edgeIndex);
    }
  }

  return { nodes, edges, edgeLengthM, edgeWayId, adjacency, wayNames };
}

/**
 * The nearest point on the network to `query`, or null beyond `maxDistanceM`.
 *
 * The radius matters as much as the result: without it, a tap in open country
 * snaps to whatever path happens to be closest, possibly the far side of a
 * valley. Returning null lets the caller keep the tap as drawn and say that it
 * is off-path, which is honest about ground that has no path on it.
 */
export function snapToNetwork(
  network: PathNetwork,
  query: LatLng,
  maxDistanceM = 40,
): SnapResult | null {
  const cosRefLat = Math.cos(query.latitude * DEG);
  let best: SnapResult | null = null;

  /* Reject on latitude before projecting, because most edges in a region are
     nowhere near the tap and this keeps a full scan viable without an index.
     The window must come from the radius: a fixed one silently caps how far the
     function can ever look, so a caller asking for 10 km would get nothing. One
     degree of latitude is ~111.32 km anywhere, and the tenth is slack for the
     case where both endpoints sit just outside the window while the segment
     between them passes through it. */
  const latWindow = (maxDistanceM / 111_320) * 1.1;

  for (let edgeIndex = 0; edgeIndex < network.edges.length; edgeIndex += 1) {
    const [a, b] = network.edges[edgeIndex];
    const start = network.nodes[a];
    const end = network.nodes[b];

    if (
      Math.abs(start.latitude - query.latitude) > latWindow &&
      Math.abs(end.latitude - query.latitude) > latWindow
    ) {
      continue;
    }

    const t = segmentT(query, start, end, cosRefLat);
    const position = interpolate(start, end, t);
    const d = distanceM(query, position);
    if (d <= maxDistanceM && (best === null || d < best.distanceM)) {
      const wayId = network.edgeWayId[edgeIndex];
      best = {
        position,
        distanceM: d,
        edgeIndex,
        wayId,
        wayName: network.wayNames.get(wayId) ?? null,
        t,
      };
    }
  }
  return best;
}

export type RouteOutcome =
  | {
      kind: "routed";
      coordinates: LatLng[];
      lengthM: number;
      /** Straight-line distance between the two snapped points. */
      directM: number;
      /**
       * `lengthM / directM`. The number that says how much freedom the routing
       * took. Measured on the Tryfan North Ridge, two taps 304 m apart route
       * 518 m over three unnamed ways — a factor of 1.70, wandering 141 m off
       * the direct line. That is a real path, but it is not necessarily the
       * ridge the person meant, and only they can tell. A high factor is the
       * signal to show them the leg before accepting it; frequent taps keep it
       * near 1 and leave the routing almost nothing to decide.
       */
      detourFactor: number;
    }
  /** No chain of edges joins the two points. Never straight-lined over. */
  | { kind: "disconnected"; gapM: number };

/** A minimal binary heap. Faster than re-sorting, and small enough to keep here. */
class MinHeap {
  private heap: Array<{ node: number; cost: number }> = [];

  push(item: { node: number; cost: number }): void {
    this.heap.push(item);
    let i = this.heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].cost <= this.heap[i].cost) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  pop(): { node: number; cost: number } | undefined {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last !== undefined) {
      this.heap[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.heap.length && this.heap[left].cost < this.heap[smallest].cost) {
          smallest = left;
        }
        if (right < this.heap.length && this.heap[right].cost < this.heap[smallest].cost) {
          smallest = right;
        }
        if (smallest === i) break;
        [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
        i = smallest;
      }
    }
    return top;
  }

  get size(): number {
    return this.heap.length;
  }
}

/**
 * Follow the network from one snapped point to another.
 *
 * Shortest path by distance over the edges that exist. When no chain of edges
 * joins the two, the result is `disconnected` with the straight-line distance —
 * it does not fall back to a straight line, because that is exactly how a 304 m
 * gap becomes an invented 304 m of ridge. The caller decides what to offer the
 * person, and a deliberate freehand crossing is their assertion to make.
 */
export function routeAlongNetwork(
  network: PathNetwork,
  from: SnapResult,
  to: SnapResult,
): RouteOutcome {
  // Both ends sit mid-edge, so the ends of those edges are the real entry
  // points into the graph; the mid-edge stubs are added as fixed costs.
  const [fromA, fromB] = network.edges[from.edgeIndex];
  const [toA, toB] = network.edges[to.edgeIndex];

  // Both taps landed on the same segment, so the leg is just the span between
  // them; entering the graph at all would be a detour to a node and back.
  if (from.edgeIndex === to.edgeIndex) {
    const span = distanceM(from.position, to.position);
    return {
      kind: "routed",
      coordinates: [from.position, to.position],
      lengthM: span,
      directM: span,
      detourFactor: 1,
    };
  }

  const fromLength = network.edgeLengthM[from.edgeIndex];
  const toLength = network.edgeLengthM[to.edgeIndex];
  const startCost = new Map<number, number>([
    [fromA, from.t * fromLength],
    [fromB, (1 - from.t) * fromLength],
  ]);
  const endCost = new Map<number, number>([
    [toA, to.t * toLength],
    [toB, (1 - to.t) * toLength],
  ]);

  const best = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const queue = new MinHeap();
  for (const [node, cost] of startCost) {
    best.set(node, cost);
    queue.push({ node, cost });
  }

  let reached: number | null = null;
  let reachedTotal = Infinity;

  while (queue.size > 0) {
    const current = queue.pop();
    if (current === undefined) break;
    // A stale heap entry: a cheaper route to this node was already settled.
    if (current.cost > (best.get(current.node) ?? Infinity)) continue;
    // Stop once nothing left in the queue could beat the best finish found.
    if (current.cost >= reachedTotal) break;

    const finish = endCost.get(current.node);
    if (finish !== undefined && current.cost + finish < reachedTotal) {
      reachedTotal = current.cost + finish;
      reached = current.node;
    }

    for (const edgeIndex of network.adjacency[current.node]) {
      const [a, b] = network.edges[edgeIndex];
      const next = a === current.node ? b : a;
      const cost = current.cost + network.edgeLengthM[edgeIndex];
      if (cost < (best.get(next) ?? Infinity)) {
        best.set(next, cost);
        cameFrom.set(next, current.node);
        queue.push({ node: next, cost });
      }
    }
  }

  if (reached === null) {
    return { kind: "disconnected", gapM: distanceM(from.position, to.position) };
  }

  const backwards: number[] = [];
  for (let node: number | undefined = reached; node !== undefined; node = cameFrom.get(node)) {
    backwards.push(node);
    if (startCost.has(node)) break;
  }
  const coordinates: LatLng[] = [];
  appendWithoutRepeats(coordinates, [
    from.position,
    ...backwards.reverse().map(node => network.nodes[node]),
    to.position,
  ]);
  const directM = distanceM(from.position, to.position);
  return {
    kind: "routed",
    coordinates,
    lengthM: reachedTotal,
    directM,
    // Two taps on the same spot would divide by zero; they also took no detour.
    detourFactor: directM > 0 ? reachedTotal / directM : 1,
  };
}

/**
 * Join snapped taps into one line.
 *
 * Every consecutive pair is routed, and a pair that cannot be routed is
 * reported rather than bridged. A route with any unresolved gap is not a route,
 * so the whole draw is refused and the caller is told where the break is — the
 * person can then move a point, or cross the gap deliberately.
 */
export type DrawOutcome =
  | {
      kind: "drawn";
      coordinates: LatLng[];
      lengthM: number;
      /** Index of the leg that wandered most, and by how much. */
      worstDetour: { atIndex: number; factor: number } | null;
    }
  | { kind: "gap"; atIndex: number; gapM: number };

export function drawSnappedRoute(network: PathNetwork, snaps: SnapResult[]): DrawOutcome {
  if (snaps.length < 2) {
    return {
      kind: "drawn",
      coordinates: snaps.map(s => s.position),
      lengthM: 0,
      worstDetour: null,
    };
  }
  const coordinates: LatLng[] = [];
  let lengthM = 0;
  let worstDetour: { atIndex: number; factor: number } | null = null;
  for (let i = 0; i + 1 < snaps.length; i += 1) {
    const leg = routeAlongNetwork(network, snaps[i], snaps[i + 1]);
    if (leg.kind === "disconnected") {
      return { kind: "gap", atIndex: i, gapM: leg.gapM };
    }
    lengthM += leg.lengthM;
    if (worstDetour === null || leg.detourFactor > worstDetour.factor) {
      worstDetour = { atIndex: i, factor: leg.detourFactor };
    }
    // Drops the join shared with the previous leg as well as any repeat inside it.
    appendWithoutRepeats(coordinates, leg.coordinates);
  }
  return { kind: "drawn", coordinates, lengthM, worstDetour };
}

/**
 * The GeoJSON the data engine's editorial importer already reads.
 *
 * Shaped to `summit_data_engine.editorial.source.parse_drawn_routes` exactly, so
 * a route drawn in the app needs no new ingest path. `drawnOn` is provenance
 * the engine keeps: a line snapped to OSM path geometry is derived from OSM,
 * which is a different rights position from one merely traced over a basemap
 * for reference, and the record has to be able to answer that later.
 */
export function drawnRouteToGeoJson(input: {
  sourceId: string;
  name: string;
  mountainName: string;
  coordinates: LatLng[];
  aliases?: string[];
  description?: string;
  requiresScrambling?: boolean;
  author: string;
  drawnOn: string;
  version?: string;
}): Record<string, unknown> {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: input.sourceId,
        properties: {
          name: input.name,
          mountain: input.mountainName,
          aliases: input.aliases ?? [],
          description: input.description ?? "",
          requires_scrambling: input.requiresScrambling ?? false,
          author: input.author,
          drawn_on: input.drawnOn,
          version: input.version ?? "1",
        },
        geometry: {
          type: "LineString",
          // The one place latitude-first becomes longitude-first.
          coordinates: input.coordinates.map(p => [p.longitude, p.latitude]),
        },
      },
    ],
  };
}
