/**
 * The state of a route being drawn, as a reducer.
 *
 * Headless on purpose. Every decision a person can make while drawing — add a
 * point, undo, pick up freehand across a gap, finish — is a transition here,
 * with no map and no React involved. That means the behaviour can be tested
 * exhaustively without rendering anything, and that the screen on top is only
 * responsible for looking right.
 *
 * WHAT THE STATE HAS TO GET RIGHT
 * -------------------------------
 * Three things, all of them consequences of measuring the real network:
 *
 * 1. **A gap is offered, never taken.** Two taps the network cannot join
 *    produce a `pendingGap`, and nothing is added to the route until the person
 *    either moves the point or accepts a freehand crossing. The engine's
 *    candidate report exists because auto-bridging Tryfan's 304 m gap would
 *    invent a third of a kilometre of ridge; the same rule has to survive
 *    contact with a finger.
 *
 * 2. **A freehand crossing is recorded, not hidden.** Accepting one sets
 *    `freehandSegments`, which the screen draws differently and which becomes a
 *    QA flag on export. A route that is half-surveyed and half-asserted must not
 *    look like one that is wholly on-path.
 *
 * 3. **Wandering is surfaced.** A leg routed far further than its direct line
 *    took a decision the person did not make. `warnings` carries it so the
 *    screen can show the leg before it is accepted.
 *
 * An off-path tap is not an error either — much of a mountain has no mapped
 * path. It is kept as drawn and marked, so the route says which parts follow a
 * path and which do not.
 */

import {
  distanceM,
  routeAlongNetwork,
  snapToNetwork,
  type LatLng,
  type PathNetwork,
  type SnapResult,
} from "./pathSnapping";

/**
 * Above this, a leg wandered enough that the person should look at it.
 *
 * 1.45 sits below the 1.70 measured across Tryfan's North Ridge gap — the case
 * that motivated the warning — and above the mild overshoot of following a path
 * round a contour, which is ordinary and should not nag.
 */
export const DETOUR_WARNING_FACTOR = 1.45;

/** Default tap radius. Beyond it a tap is off-path rather than snapped. */
export const DEFAULT_SNAP_RADIUS_M = 40;

export type PointOrigin =
  /** Snapped onto a mapped path. */
  | "snapped"
  /** Kept where the person put it, because no path was within the radius. */
  | "freehand";

export interface DrawnPoint {
  position: LatLng;
  origin: PointOrigin;
  /** Present only for a snapped point. */
  snap: SnapResult | null;
  /** The path's name, when it had one. */
  pathName: string | null;
}

export interface DrawWarning {
  kind: "detour" | "off_path" | "freehand_crossing";
  /** Index of the point or leg the warning is about. */
  atIndex: number;
  message: string;
}

/** A stretch of the line the person asserted rather than followed. */
export interface FreehandSegment {
  fromIndex: number;
  lengthM: number;
}

/** Two taps the network cannot join. Held until the person decides. */
export interface PendingGap {
  fromIndex: number;
  candidate: DrawnPoint;
  gapM: number;
}

export interface DrawingState {
  points: DrawnPoint[];
  /** The rendered line: every leg's geometry, joined. */
  coordinates: LatLng[];
  lengthM: number;
  warnings: DrawWarning[];
  freehandSegments: FreehandSegment[];
  /** Non-null when the last tap could not be joined. Blocks further drawing. */
  pendingGap: PendingGap | null;
}

export const emptyDrawing: DrawingState = {
  points: [],
  coordinates: [],
  lengthM: 0,
  warnings: [],
  freehandSegments: [],
  pendingGap: null,
};

export type DrawingAction =
  | { type: "tap"; at: LatLng }
  /** Take the freehand crossing that `pendingGap` offered. */
  | { type: "acceptGap" }
  /** Decline it. The candidate point is discarded, the route is unchanged. */
  | { type: "rejectGap" }
  | { type: "undo" }
  | { type: "clear" };

export interface DrawingConfig {
  network: PathNetwork | null;
  snapRadiusM?: number;
}

function describePoint(network: PathNetwork | null, at: LatLng, radiusM: number): DrawnPoint {
  const snap = network ? snapToNetwork(network, at, radiusM) : null;
  if (!snap) {
    return { position: at, origin: "freehand", snap: null, pathName: null };
  }
  return {
    position: snap.position,
    origin: "snapped",
    snap,
    pathName: snap.wayName,
  };
}

/**
 * Rebuild the line from the points.
 *
 * Recomputed from scratch on every change rather than patched incrementally.
 * An undo after a freehand crossing changes which legs exist and how they join,
 * and a patch that got that wrong would leave a line that does not match its
 * own points — a bug that only shows up in exported geometry. Routing a leg
 * costs about 1.5 ms, so a full rebuild is affordable at the rate a person taps.
 */
function rebuild(
  points: DrawnPoint[],
  network: PathNetwork | null,
  freehandAfter: ReadonlySet<number>,
): Omit<DrawingState, "points" | "pendingGap"> {
  const coordinates: LatLng[] = [];
  const warnings: DrawWarning[] = [];
  const freehandSegments: FreehandSegment[] = [];
  let lengthM = 0;

  points.forEach((point, index) => {
    if (point.origin === "freehand") {
      warnings.push({
        kind: "off_path",
        atIndex: index,
        message: "No mapped path here — this point is where you put it.",
      });
    }
  });

  const push = (positions: readonly LatLng[]) => {
    for (const position of positions) {
      const last = coordinates[coordinates.length - 1];
      if (!last || last.latitude !== position.latitude || last.longitude !== position.longitude) {
        coordinates.push(position);
      }
    }
  };

  if (points.length > 0) push([points[0].position]);

  for (let i = 0; i + 1 < points.length; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    const straight = () => {
      const span = distanceM(from.position, to.position);
      lengthM += span;
      freehandSegments.push({ fromIndex: i, lengthM: span });
      push([to.position]);
    };

    // A crossing the person accepted, or a leg with an unsnapped end: there is
    // no network path to follow, so the line is their assertion.
    if (freehandAfter.has(i) || !network || !from.snap || !to.snap) {
      straight();
      if (freehandAfter.has(i)) {
        warnings.push({
          kind: "freehand_crossing",
          atIndex: i,
          message: "Drawn across a gap in the path network, not followed.",
        });
      }
      continue;
    }

    const leg = routeAlongNetwork(network, from.snap, to.snap);
    if (leg.kind === "disconnected") {
      // Reachable when a later undo leaves two points the network cannot join.
      straight();
      warnings.push({
        kind: "freehand_crossing",
        atIndex: i,
        message: "Drawn across a gap in the path network, not followed.",
      });
      continue;
    }

    lengthM += leg.lengthM;
    push(leg.coordinates);
    if (leg.detourFactor > DETOUR_WARNING_FACTOR) {
      warnings.push({
        kind: "detour",
        atIndex: i,
        message:
          `This leg follows ${Math.round(leg.lengthM)} m of path to cover ` +
          `${Math.round(leg.directM)} m. Check it goes the way you meant.`,
      });
    }
  }

  return { coordinates, lengthM, warnings, freehandSegments };
}

/** Which legs were crossed freehand, recovered from the state. */
function freehandIndices(state: DrawingState): Set<number> {
  return new Set(state.freehandSegments.map(segment => segment.fromIndex));
}

export function drawingReducer(
  state: DrawingState,
  action: DrawingAction,
  config: DrawingConfig,
): DrawingState {
  const network = config.network;
  const radiusM = config.snapRadiusM ?? DEFAULT_SNAP_RADIUS_M;

  switch (action.type) {
    case "clear":
      return emptyDrawing;

    case "tap": {
      // While a gap is unresolved, nothing else may be added: the route would
      // otherwise grow past a decision the person has not made.
      if (state.pendingGap) return state;

      const candidate = describePoint(network, action.at, radiusM);
      const previous = state.points[state.points.length - 1];

      if (previous && network && previous.snap && candidate.snap) {
        const leg = routeAlongNetwork(network, previous.snap, candidate.snap);
        if (leg.kind === "disconnected") {
          return {
            ...state,
            pendingGap: {
              fromIndex: state.points.length - 1,
              candidate,
              gapM: leg.gapM,
            },
          };
        }
      }

      const points = [...state.points, candidate];
      return {
        ...state,
        points,
        pendingGap: null,
        ...rebuild(points, network, freehandIndices(state)),
      };
    }

    case "acceptGap": {
      const gap = state.pendingGap;
      if (!gap) return state;
      const points = [...state.points, gap.candidate];
      const freehand = freehandIndices(state);
      freehand.add(gap.fromIndex);
      return {
        ...state,
        points,
        pendingGap: null,
        ...rebuild(points, network, freehand),
      };
    }

    case "rejectGap":
      return state.pendingGap ? { ...state, pendingGap: null } : state;

    case "undo": {
      // An unresolved gap is the most recent thing that happened, so undo
      // dismisses it rather than removing a point the person can still see.
      if (state.pendingGap) return { ...state, pendingGap: null };
      if (state.points.length === 0) return state;

      const points = state.points.slice(0, -1);
      const freehand = freehandIndices(state);
      // The leg that led into the removed point no longer exists.
      freehand.delete(points.length - 1);
      return {
        ...state,
        points,
        pendingGap: null,
        ...rebuild(points, network, freehand),
      };
    }

    default:
      return state;
  }
}

/**
 * Split the drawn line into runs that follow mapped path and runs that do not.
 *
 * Here rather than in the map component because it is logic, not presentation:
 * getting it wrong mislabels an asserted stretch as surveyed, which is the one
 * mistake this whole feature is built to avoid. A component cannot be tested as
 * cheaply as a function.
 *
 * Legs are named by point index in `freehandSegments`, so the split locates each
 * drawn point's position within the line and cuts there. It matches on position
 * rather than counting vertices, because a routed leg contributes many
 * intermediate points and a count would drift.
 *
 * If a point's position cannot be found in the line the two have diverged, and
 * the whole line is returned as `followed` — over-reporting "surveyed" would be
 * the dangerous failure, so this reports nothing as asserted and the caller's
 * warnings still stand.
 */
export function splitDrawnRuns(state: DrawingState): {
  followed: LatLng[][];
  asserted: LatLng[][];
} {
  const followed: LatLng[][] = [];
  const asserted: LatLng[][] = [];
  if (state.coordinates.length < 2) return { followed, asserted };

  const freehand = new Set(state.freehandSegments.map(segment => segment.fromIndex));
  const marks: number[] = [];
  let cursor = 0;
  for (const point of state.points) {
    while (
      cursor < state.coordinates.length &&
      (state.coordinates[cursor].latitude !== point.position.latitude ||
        state.coordinates[cursor].longitude !== point.position.longitude)
    ) {
      cursor += 1;
    }
    if (cursor >= state.coordinates.length) {
      return { followed: [state.coordinates], asserted: [] };
    }
    marks.push(cursor);
  }

  for (let leg = 0; leg + 1 < marks.length; leg += 1) {
    const run = state.coordinates.slice(marks[leg], marks[leg + 1] + 1);
    if (run.length < 2) continue;
    (freehand.has(leg) ? asserted : followed).push(run);
  }
  return { followed, asserted };
}

/** Whether the drawing is complete enough to export. */
export function canExport(state: DrawingState): boolean {
  return state.pendingGap === null && state.coordinates.length >= 2;
}

/**
 * How much of the line follows a mapped path, 0–1.
 *
 * Shown so a person can see what they have before naming it, and carried into
 * the export note. A route that is mostly asserted is a legitimate thing to
 * plan and a different thing to publish.
 */
export function snappedFraction(state: DrawingState): number {
  if (state.lengthM <= 0) return 0;
  const freehandM = state.freehandSegments.reduce((total, s) => total + s.lengthM, 0);
  return Math.max(0, Math.min(1, (state.lengthM - freehandM) / state.lengthM));
}
