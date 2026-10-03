import { describe, expect, it } from "vitest";
import {
  BASE_THRESHOLD_M,
  FIXES_TO_ALERT,
  UNUSABLE_ACCURACY_M,
  assess,
  bearingBetween,
  distanceM,
  initialMemory,
  nearestOnRoute,
  thresholdFor,
  type Fix,
  type OffRouteMemory,
  type OffRouteReading,
  type RoutePoint,
} from "./offRoute";

/* A straight route running north for about 1.1 km, so offsets are easy to
   reason about: 0.001 degrees of latitude is ~111 m, and at this latitude
   0.001 of longitude is ~67 m. */
const ROUTE: RoutePoint[] = [
  { latitude: 53.1150, longitude: -3.9986 },
  { latitude: 53.1200, longitude: -3.9986 },
  { latitude: 53.1250, longitude: -3.9986 },
];

/** Metres east of the route's line, at a given point along it. */
function eastOfRoute(metres: number, latitude = 53.1200): Fix {
  const degPerM = 1 / (111_320 * Math.cos(53.12 * Math.PI / 180));
  return { latitude, longitude: -3.9986 + metres * degPerM, accuracyM: 8, at: 0 };
}

/** Feed a sequence of fixes through and collect every reading. */
function walk(fixes: Fix[], route = ROUTE): OffRouteReading[] {
  let memory: OffRouteMemory = initialMemory();
  const out: OffRouteReading[] = [];
  for (const f of fixes) {
    const r = assess(memory, route, f);
    memory = r.memory;
    out.push(r.reading);
  }
  return out;
}

const repeat = (f: Fix, n: number) => Array.from({ length: n }, (_, i) => ({ ...f, at: i * 5000 }));

describe("finding the route", () => {
  it("measures to the nearest point on the line, not to its corners", () => {
    /* A walker beside the middle of a segment is near the route even though
       both of its end points are far away. Measuring to vertices only would
       call most of a route "off". */
    const beside = eastOfRoute(50, 53.1175);
    const near = nearestOnRoute(ROUTE, beside)!;
    expect(near.distanceM).toBeCloseTo(50, -1);
    expect(distanceM(near.point, ROUTE[0]!)).toBeGreaterThan(200);
  });

  it("handles a route of one point without pretending it is a line", () => {
    const one = nearestOnRoute([ROUTE[0]!], eastOfRoute(50, 53.1150));
    expect(one?.distanceM).toBeCloseTo(50, -1);
  });

  it("returns nothing for an empty route", () => {
    expect(nearestOnRoute([], eastOfRoute(0))).toBeNull();
  });
});

describe("the direction it reports", () => {
  it("says where the walker is, as seen from the route", () => {
    expect(bearingBetween({ latitude: 53.12, longitude: -3.9986 },
                          { latitude: 53.12, longitude: -3.9900 })).toBe("east");
    expect(bearingBetween({ latitude: 53.12, longitude: -3.9986 },
                          { latitude: 53.13, longitude: -3.9986 })).toBe("north");
    expect(bearingBetween({ latitude: 53.12, longitude: -3.9986 },
                          { latitude: 53.11, longitude: -3.9986 })).toBe("south");
  });

  it("never phrases itself as an instruction", () => {
    /* The line this feature will not cross. "Head west" asserts that west is
       walkable; on a mountain the straight line back to a path can cross a
       crag. Stating a position is a fact, stating a direction is an order. */
    const readings = walk(repeat(eastOfRoute(300), 5));
    const message = readings[readings.length - 1]!.message!;
    expect(message).toContain("of your route");
    for (const word of ["head ", "go ", "turn ", "walk ", "bear "]) {
      expect(message.toLowerCase()).not.toContain(word);
    }
  });
});

describe("the threshold moves with GPS accuracy", () => {
  it("is generous by default", () => {
    expect(thresholdFor(5)).toBe(BASE_THRESHOLD_M);
  });

  it("widens when the phone is unsure", () => {
    /* A device reporting ±25 m cannot tell 60 m from 85 m. Alerting on that
       difference is alerting on noise. */
    expect(thresholdFor(25)).toBeGreaterThan(BASE_THRESHOLD_M);
    expect(thresholdFor(40)).toBeGreaterThan(thresholdFor(25));
  });

  it("assumes the worst when accuracy is not reported", () => {
    expect(thresholdFor(null)).toBeGreaterThan(BASE_THRESHOLD_M);
    expect(thresholdFor(undefined)).toBe(thresholdFor(null));
  });
});

describe("it is slow to speak", () => {
  /* The failure that matters is the false alarm. An alert that fires when
     nothing is wrong gets dismissed, and that habit survives into the moment
     it is right. */

  it("says nothing on one stray fix", () => {
    const readings = walk([
      eastOfRoute(10), eastOfRoute(10), eastOfRoute(400), eastOfRoute(10), eastOfRoute(10),
    ]);
    expect(readings.some(r => r.status === "off_route")).toBe(false);
    expect(readings.some(r => r.announce)).toBe(false);
  });

  it("speaks once several fixes agree", () => {
    const readings = walk(repeat(eastOfRoute(300), FIXES_TO_ALERT + 1));
    expect(readings[FIXES_TO_ALERT - 1]!.status).toBe("off_route");
    expect(readings[FIXES_TO_ALERT - 1]!.announce).toBe(true);
  });

  it("does not keep announcing while nothing changes", () => {
    /* Nagging is what teaches people to ignore this. */
    const readings = walk(repeat(eastOfRoute(300), 12));
    expect(readings.filter(r => r.announce).length).toBe(1);
    expect(readings[11]!.status).toBe("off_route");
  });

  it("speaks again when it is getting materially worse", () => {
    const readings = walk([
      ...repeat(eastOfRoute(150), 4),
      ...repeat(eastOfRoute(700), 2),
    ]);
    expect(readings.filter(r => r.announce).length).toBe(2);
  });
});

describe("it clears without flickering", () => {
  it("goes quiet once the walker is properly back", () => {
    const readings = walk([
      ...repeat(eastOfRoute(300), 4),
      ...repeat(eastOfRoute(5), 3),
    ]);
    expect(readings[readings.length - 1]!.status).toBe("on_route");
    expect(readings[readings.length - 1]!.message).toBeNull();
  });

  it("does not toggle for somebody walking the boundary", () => {
    /* Sitting right on the threshold must not alternate between on and off,
       which would be worse than either answer. */
    const atEdge = eastOfRoute(BASE_THRESHOLD_M + 2);
    const justIn = eastOfRoute(BASE_THRESHOLD_M - 2);
    const readings = walk([
      atEdge, atEdge, atEdge, justIn, atEdge, justIn, atEdge, justIn,
    ]);
    const changes = readings.filter((r, i) => i > 0 && r.status !== readings[i - 1]!.status);
    expect(changes.length).toBeLessThanOrEqual(1);
  });
});

describe("a fix too poor to judge", () => {
  it("draws no conclusion from it either way", () => {
    /* A useless fix must neither raise an alarm nor clear one. It is not
       evidence. */
    const noisy: Fix = { ...eastOfRoute(300), accuracyM: UNUSABLE_ACCURACY_M + 50 };
    const readings = walk([
      ...repeat(eastOfRoute(300), 4),   // off, and announced
      noisy, noisy,                      // garbage
      ...repeat(eastOfRoute(300), 1),
    ]);
    expect(readings[3]!.status).toBe("off_route");
    expect(readings[4]!.status).toBe("off_route");   // not cleared by noise
    expect(readings[4]!.distanceM).toBeNull();        // and claims nothing
    expect(readings[6]!.status).toBe("off_route");
  });

  it("cannot be alerted into existence by noise alone", () => {
    const noisy: Fix = { ...eastOfRoute(900), accuracyM: 400 };
    expect(walk(repeat(noisy, 8)).some(r => r.announce)).toBe(false);
  });
});

describe("a free hike", () => {
  it("never reports leaving a route that was never chosen", () => {
    /* Walking without a planned route is normal and supported. An alert here
       would be nonsense, and the kind that gets the whole feature switched
       off. */
    for (const route of [[], [ROUTE[0]!]]) {
      const readings = walk(repeat(eastOfRoute(5000), 10), route);
      expect(readings.every(r => r.status === "unknown")).toBe(true);
      expect(readings.every(r => r.message === null)).toBe(true);
    }
  });
});

describe("what it says", () => {
  it("rounds to a precision the data supports", () => {
    /* "80 m" claims what a GPS fix can support. "83 m" claims more than it
       can, and reads as a measurement rather than an estimate. */
    const readings = walk(repeat(eastOfRoute(283), 4));
    expect(readings[3]!.message).toMatch(/^\d+0 m /);
  });

  it("names the threshold it judged against, so the number can be questioned", () => {
    const readings = walk(repeat(eastOfRoute(300), 4));
    expect(readings[3]!.thresholdM).toBe(BASE_THRESHOLD_M);
  });
});

describe("staying on a route", () => {
  it("says nothing at all for a walk that follows it", () => {
    const along: Fix[] = [];
    for (let i = 0; i <= 20; i += 1) {
      along.push({
        latitude: 53.1150 + (i / 20) * 0.01,
        longitude: -3.9986 + (i % 2 ? 0.0002 : -0.0002), // ±13 m of wander
        accuracyM: 10,
        at: i * 5000,
      });
    }
    const readings = walk(along);
    expect(readings.every(r => r.status !== "off_route")).toBe(true);
    expect(readings.every(r => !r.announce)).toBe(true);
  });
});
