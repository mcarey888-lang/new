import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { legBBox, snapLeg } from "../routes/path-snap";
import {
  clearNetworkCache,
  parseOverpass,
} from "../services/routing/pathNetworkSource";
import { distanceM, type LatLng } from "../services/routing/pathSnapping";

const ogwen = () =>
  JSON.parse(readFileSync(`${__dirname}/fixtures/ogwen-overpass.json`, "utf8"));
const ways = () => parseOverpass(ogwen());

/* Real coordinates from the Ogwen fixture, found by walking the network's
   connected components rather than picked by eye. The data has 277 ways in 19
   separate components — the breaks are real, and they are the whole reason
   this endpoint reports gaps instead of papering over them. */

/** Two points on the same component. Known to route: 515 m at 1.52x direct. */
const CONNECTED_A: LatLng = { latitude: 53.1213614, longitude: -3.9986247 };
const CONNECTED_B: LatLng = { latitude: 53.1191998, longitude: -3.9950315 };

/** Two points on different components, 1503 m apart with no path joining them. */
const ISLAND: LatLng = { latitude: 53.1248388, longitude: -4.0203925 };

/** Open hillside, well away from anything mapped. */
const OFF_PATH: LatLng = { latitude: 53.1600000, longitude: -4.1000000 };

afterEach(() => clearNetworkCache());

describe("legBBox", () => {
  it("pads around the taps", () => {
    /* A box drawn tight to two taps misses the path that curves between them
       and would report a gap that is not there. */
    const b = legBBox([CONNECTED_A, CONNECTED_B]);
    expect(b.minLat).toBeLessThan(Math.min(CONNECTED_A.latitude, CONNECTED_B.latitude));
    expect(b.maxLng).toBeGreaterThan(Math.max(CONNECTED_A.longitude, CONNECTED_B.longitude));
  });

  it("handles a single tap", () => {
    const b = legBBox([CONNECTED_A]);
    expect(b.minLat).toBeLessThan(b.maxLat);
    expect(b.minLng).toBeLessThan(b.maxLng);
  });
});

describe("a first tap", () => {
  it("snaps onto a path and says which", async () => {
    const r = await snapLeg(null, CONNECTED_A, { ways: ways() });
    expect(r.outcome).toBe("snapped");
    if (r.outcome !== "snapped") return;
    expect(r.distanceM).toBeLessThanOrEqual(45);
    /* The returned point is on the path, not where the finger landed. */
    expect(distanceM({ latitude: r.point.lat, longitude: r.point.lng }, CONNECTED_A))
      .toBeLessThan(50);
  });

  it("says off_path for a tap on open ground", async () => {
    const r = await snapLeg(null, OFF_PATH, { ways: ways() });
    expect(r.outcome).toBe("off_path");
    /* The truthful answer for ground with no path on it. Grabbing the nearest
       path from half a valley away would put the route somewhere nobody asked
       for and look deliberate. */
  });
});

describe("a leg between two taps", () => {
  it("follows real paths and reports how far it wandered", async () => {
    const r = await snapLeg(CONNECTED_A, CONNECTED_B, { ways: ways() });
    expect(r.outcome).toBe("routed");
    if (r.outcome !== "routed") return;
    expect(r.points.length).toBeGreaterThan(2);
    expect(r.lengthM).toBeGreaterThan(r.directM);
    /* Measured on this data: 515 m over a 339 m direct line. The factor is the
       number that says how much the routing decided for itself, and it is
       surfaced so a person can question a leg rather than trust it blindly. */
    expect(r.detourFactor).toBeGreaterThan(1);
    expect(r.detourFactor).toBeCloseTo(1.52, 1);
  });

  it("starts and ends where it was asked to", async () => {
    const r = await snapLeg(CONNECTED_A, CONNECTED_B, { ways: ways() });
    if (r.outcome !== "routed") throw new Error("expected routed");
    const first = r.points[0]!, last = r.points[r.points.length - 1]!;
    expect(distanceM({ latitude: first.lat, longitude: first.lng }, CONNECTED_A)).toBeLessThan(50);
    expect(distanceM({ latitude: last.lat, longitude: last.lng }, CONNECTED_B)).toBeLessThan(50);
  });
});

describe("a gap is reported, never crossed", () => {
  /* The rule the whole feature stands on. Two taps on different components of
     the network have no path between them. Drawing a straight line and calling
     it routed would turn a hole in the map into invented ground on a mountain,
     which is the one failure that could get somebody hurt. */

  it("says disconnected rather than inventing a line", async () => {
    const r = await snapLeg(CONNECTED_A, ISLAND, { ways: ways() });
    expect(r.outcome).toBe("disconnected");
    if (r.outcome !== "disconnected") return;
    expect(r.gapM).toBeGreaterThan(1000);
  });

  it("returns no coordinates at all for a gap", async () => {
    /* Not an empty line, not a two-point line — nothing the page could mistake
       for geometry and draw as a route. */
    const r = await snapLeg(CONNECTED_A, ISLAND, { ways: ways() });
    expect(r).not.toHaveProperty("points");
  });

  it("still says where both ends snapped, so the page can show the gap", async () => {
    const r = await snapLeg(CONNECTED_A, ISLAND, { ways: ways() });
    if (r.outcome !== "disconnected") throw new Error("expected disconnected");
    expect(r.from.lat).toBeCloseTo(CONNECTED_A.latitude, 2);
    expect(r.to.lat).toBeCloseTo(ISLAND.latitude, 2);
  });
});

describe("when a tap is off the network", () => {
  it("names which end failed", async () => {
    const a = await snapLeg(CONNECTED_A, OFF_PATH, { ways: ways() });
    expect(a.outcome === "off_path" && a.which).toBe("to");
    const b = await snapLeg(OFF_PATH, CONNECTED_A, { ways: ways() });
    expect(b.outcome === "off_path" && b.which).toBe("from");
    const c = await snapLeg(OFF_PATH, { latitude: 53.17, longitude: -4.11 }, { ways: ways() });
    expect(c.outcome === "off_path" && c.which).toBe("both");
  });
});

describe("when there is no network to snap against", () => {
  it("separates empty ground from a service that would not answer", async () => {
    /* These must not collapse into one message. "No paths are mapped here" is
       a fact about the mountain and the person can draw freehand with that in
       mind. "We could not ask" means waiting might fix it. */
    const empty = await snapLeg(null, CONNECTED_A, { ways: [] });
    expect(empty.outcome).toBe("no_paths");

    const down = await snapLeg(null, CONNECTED_A, {
      fetcher: async () => ({ ok: false, status: 429 }) as unknown as Response,
    });
    expect(down.outcome).toBe("unavailable");
  });

  it("never reports a route when the network could not be fetched", async () => {
    const down = await snapLeg(CONNECTED_A, CONNECTED_B, {
      fetcher: async () => { throw new Error("offline"); },
    });
    expect(down.outcome).toBe("unavailable");
    expect(down).not.toHaveProperty("points");
  });
});
