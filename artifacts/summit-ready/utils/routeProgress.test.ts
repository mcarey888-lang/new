import { describe, expect, it } from "vitest";
import {
  PROGRESS_MAX_OFF_ROUTE_M,
  ascentProgress,
  cumulativeLengths,
  routeProgress,
  type ProfileSample,
} from "./routeProgress";
import type { RoutePoint } from "./offRoute";

/* A straight route running north, about 1.1 km end to end. */
const ROUTE: RoutePoint[] = [
  { latitude: 53.1150, longitude: -3.9986 },
  { latitude: 53.1200, longitude: -3.9986 },
  { latitude: 53.1250, longitude: -3.9986 },
];

const at = (latitude: number, metresEast = 0): RoutePoint => ({
  latitude,
  longitude: -3.9986 + metresEast / (111_320 * Math.cos(53.12 * Math.PI / 180)),
});

const PROFILE: ProfileSample[] = [
  { distanceM: 0,    elevationM: 300, cumulativeAscentM: 0 },
  { distanceM: 300,  elevationM: 420, cumulativeAscentM: 120 },
  { distanceM: 600,  elevationM: 560, cumulativeAscentM: 260 },
  { distanceM: 900,  elevationM: 700, cumulativeAscentM: 400 },
  { distanceM: 1110, elevationM: 800, cumulativeAscentM: 500 },
];

describe("measuring along the route", () => {
  it("is zero at the start and the whole length at the end", () => {
    expect(routeProgress(ROUTE, ROUTE[0]!)!.alongM).toBeCloseTo(0, 0);
    const end = routeProgress(ROUTE, ROUTE[2]!)!;
    expect(end.alongM).toBeCloseTo(end.routeLengthM, 0);
    expect(end.fraction).toBe(1);
  });

  it("is halfway at the middle", () => {
    const mid = routeProgress(ROUTE, ROUTE[1]!)!;
    expect(mid.fraction).toBeCloseTo(0.5, 1);
  });

  it("measures along the route, not the distance walked", () => {
    /* THE REASON THIS EXISTS. Somebody who walks up, back for a dropped glove,
       and up again has covered more ground than the route has. Progress driven
       by distance walked would put them further along than they are, and would
       never fall — so a wrong turn would read as progress. */
    const outward = routeProgress(ROUTE, at(53.1200))!;
    const backForGlove = routeProgress(ROUTE, at(53.1175))!;
    const onAgain = routeProgress(ROUTE, at(53.1200))!;
    expect(backForGlove.alongM).toBeLessThan(outward.alongM);
    expect(onAgain.alongM).toBeCloseTo(outward.alongM, 0);
  });

  it("ignores a small wander off the line", () => {
    const beside = routeProgress(ROUTE, at(53.1200, 40))!;
    const on = routeProgress(ROUTE, at(53.1200))!;
    expect(beside.alongM).toBeCloseTo(on.alongM, -1);
    expect(beside.offRouteM).toBeCloseTo(40, -1);
  });

  it("declines to answer once the walker has properly left", () => {
    /* Far enough away and "along the route" means nothing: the nearest point
       could be a kilometre of walking from anywhere they can rejoin. A
       confident number there is worse than none. */
    expect(routeProgress(ROUTE, at(53.1200, PROGRESS_MAX_OFF_ROUTE_M + 200))).toBeNull();
  });

  it("has nothing to say about a route that is not one", () => {
    expect(routeProgress([], at(53.12))).toBeNull();
    expect(routeProgress([ROUTE[0]!], at(53.12))).toBeNull();
    expect(routeProgress([ROUTE[0]!, ROUTE[0]!], at(53.12))).toBeNull();
  });

  it("builds cumulative lengths that start at zero and only grow", () => {
    const lengths = cumulativeLengths(ROUTE);
    expect(lengths[0]).toBe(0);
    expect(lengths[1]).toBeGreaterThan(0);
    expect(lengths[2]).toBeGreaterThan(lengths[1]!);
  });
});

describe("climbing done and left", () => {
  it("reads both from the route's own profile", () => {
    const p = ascentProgress(PROFILE, 600)!;
    expect(p.climbedM).toBe(260);
    expect(p.totalM).toBe(500);
    expect(p.remainingM).toBe(240);
  });

  it("reconciles: climbed plus remaining is the total", () => {
    for (const along of [0, 150, 600, 900, 1110, 5000]) {
      const p = ascentProgress(PROFILE, along)!;
      expect(p.climbedM + p.remainingM).toBe(p.totalM);
    }
  });

  it("never reports a negative amount left", () => {
    expect(ascentProgress(PROFILE, 99999)!.remainingM).toBe(0);
  });

  it("does not invent a climb rate between samples", () => {
    /* Interpolating inside a thirty-metre step claims detail the data does not
       hold. The figure steps, because the measurement does. */
    expect(ascentProgress(PROFILE, 450)!.climbedM).toBe(120);
    expect(ascentProgress(PROFILE, 599)!.climbedM).toBe(120);
    expect(ascentProgress(PROFILE, 600)!.climbedM).toBe(260);
  });

  it("says nothing rather than zero when the profile cannot answer", () => {
    /* "0 m remaining" at the foot of a mountain is the worst available wrong
       answer. Unknown has to stay unknown. */
    expect(ascentProgress(null, 100)).toBeNull();
    expect(ascentProgress([], 100)).toBeNull();
    expect(ascentProgress(
      [{ distanceM: 0, elevationM: null, cumulativeAscentM: null },
       { distanceM: 300, elevationM: null, cumulativeAscentM: null }], 100,
    )).toBeNull();
  });

  it("is zero at the start, which is a real zero", () => {
    const p = ascentProgress(PROFILE, 0)!;
    expect(p.climbedM).toBe(0);
    expect(p.remainingM).toBe(500);
  });
});
