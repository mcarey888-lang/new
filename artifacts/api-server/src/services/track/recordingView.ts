/**
 * What the map should do while a hike is being recorded.
 *
 * Kept out of the browser script so the decisions can be tested: whether to
 * follow the walker, when to stop following, and how a recorded track is told
 * apart from a planned one.
 */

/** The recorded track: the line the walker actually made. */
export const TRACK_COLOR = "#3ECF75";
/** A planned or reference route: where they meant to go. Dashed, and a
 *  different hue, because showing both in one colour makes the comparison —
 *  the only reason to draw both — impossible. */
export const PLANNED_COLOR = "#E9B949";

/** How close to the walker the map sits while following. */
export const FOLLOW_ZOOM = 16;

export interface FollowState {
  /** False once the person has moved the map themselves. */
  following: boolean;
  /** True when the map is somewhere other than the walker. */
  offCentre: boolean;
}

/**
 * Whether a map movement was the person's doing.
 *
 * MapLibre reports programmatic and human movement through the same events.
 * Following re-centres the map constantly, so treating every move as human
 * would switch following off on the first GPS point — and a map that stops
 * following the moment it starts is worse than one that never followed.
 */
export function isUserGesture(event: { originalEvent?: unknown } | null | undefined): boolean {
  return Boolean(event && event.originalEvent);
}

/** Following stops when the person takes hold of the map, and only then. */
export function nextFollowState(
  current: FollowState,
  event: { kind: "gesture" } | { kind: "point" } | { kind: "recenter" },
): FollowState {
  switch (event.kind) {
    case "gesture":
      /* They have moved the map. Leave it where they put it, and offer the
         way back rather than yanking it from under them. */
      return { following: false, offCentre: true };
    case "recenter":
      return { following: true, offCentre: false };
    case "point":
      return current.following ? { following: true, offCentre: false } : current;
  }
}

/**
 * Whether a new fix is worth moving the map for.
 *
 * Every fix re-centring makes the map jitter while somebody stands still, and
 * an easeTo per second is the single most expensive thing this page does.
 */
export function shouldRecentre(
  state: FollowState,
  movedMetres: number,
  minMetres = 8,
): boolean {
  return state.following && movedMetres >= minMetres;
}

/** Which controls a recording map may show. */
export interface RecordingChrome {
  search: boolean;
  planning: boolean;
  layers: boolean;
  recenter: boolean;
}

/**
 * Collapse what gets in the way, keep what is needed on a hill.
 *
 * Searching for another hill or drawing a new route mid-walk is not something
 * anybody does, and both occupy the top of the screen where the track is. The
 * basemap and the way back to your own position are the opposite: switching to
 * satellite to read the ground, and recentring after a pan, are exactly what
 * gets used while walking.
 */
export function chromeFor(recording: boolean): RecordingChrome {
  return recording
    ? { search: false, planning: false, layers: true, recenter: true }
    : { search: true, planning: true, layers: true, recenter: true };
}
