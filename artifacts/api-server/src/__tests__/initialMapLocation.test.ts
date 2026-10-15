import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { initialMapLocationScript } from "../routes/initial-map-location-script";
import { buildRouteMapHtml } from "../routes/route-map-web";

function setup(available = true) {
  const handlers = new Map<string, () => void>();
  let success: (value: unknown) => void = () => {};
  let failure: (value: unknown) => void = () => {};
  const getPosition = vi.fn((yes, no) => { success = yes; failure = no; });
  const context = {
    map: {
      on: vi.fn((event, handler) => handlers.set(event, handler)),
      once: vi.fn((event, handler) => handlers.set(event, handler)),
      easeTo: vi.fn(),
    },
    navigator: { geolocation: available ? { getCurrentPosition: getPosition } : undefined },
    document: { querySelector: () => null },
    post: vi.fn(), showMyLocation: vi.fn(),
    recording: false, drawing: false, anchors: [] as unknown[],
    recPts: [] as unknown[], summitDestination: null as unknown,
  };
  runInNewContext(initialMapLocationScript(), context);
  return {
    context, handlers, getPosition,
    fix: (lat = 53.7, lng = -2.3) => success({ coords: { latitude: lat, longitude: lng, accuracy: 15 } }),
    fail: () => failure({ code: 1 }),
    load: () => handlers.get("load")!(),
  };
}

describe("map opens at the user's location, not Tryfan", () => {
  it("requests one bounded GPS fix after map load and centres longitude/latitude correctly", () => {
    const s = setup();
    expect(s.getPosition).not.toHaveBeenCalled();
    s.load();
    expect(s.getPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    s.fix();
    expect(s.context.map.easeTo).toHaveBeenCalledWith({ center: [-2.3, 53.7], zoom: 13, duration: 600 });
    expect(s.context.showMyLocation).toHaveBeenCalledWith(-2.3, 53.7, 15);
    expect(s.context.recPts).toEqual([]);
    expect(s.context.map.once).toHaveBeenCalledWith("load", expect.any(Function));
  });

  it.each(["movestart", "mousedown", "touchstart", "wheel"])("does not steal the camera after %s", event => {
    const s = setup();
    s.load(); s.handlers.get(event)!(); s.fix();
    expect(s.context.map.easeTo).not.toHaveBeenCalled();
  });

  it("does not start an initial-location lookup during recording", () => {
    const s = setup(); s.context.recording = true; s.load();
    expect(s.getPosition).not.toHaveBeenCalled();
  });

  it.each(["drawing", "route", "track", "summit"])("preserves a late %s selection", kind => {
    const s = setup(); s.load();
    if (kind === "drawing") s.context.drawing = true;
    if (kind === "route") s.context.anchors.push([-4, 53]);
    if (kind === "track") s.context.recPts.push([-4, 53]);
    if (kind === "summit") s.context.summitDestination = { lat: 53, lng: -4 };
    s.fix();
    expect(s.context.map.easeTo).not.toHaveBeenCalled();
  });

  it("reports denied permissions without pretending Tryfan is the user's position", () => {
    const s = setup(); s.load(); s.fail();
    expect(s.context.post).toHaveBeenCalledWith({ type: "initialLocationUnavailable", reason: "permission" });
    expect(s.context.map.easeTo).not.toHaveBeenCalled();
  });

  it("handles browsers without geolocation", () => {
    const s = setup(false); s.load();
    expect(s.context.post).toHaveBeenCalledWith({ type: "initialLocationUnavailable", reason: "unavailable" });
  });

  it("accepts zero coordinates but rejects invalid coordinates", () => {
    const valid = setup(); valid.load(); valid.fix(0, 0);
    expect(valid.context.map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [0, 0] }));
    const invalid = setup(); invalid.load(); invalid.fix(NaN, 200);
    expect(invalid.context.map.easeTo).not.toHaveBeenCalled();
  });

  it("removes the fixed Tryfan camera and does not add auto-location to recording pages", () => {
    const normal = buildRouteMapHtml("K", "full", "/api/map-tiles", true, "/api/path-snap");
    const recording = buildRouteMapHtml("K", "full", "/api/map-tiles", true, "/api/path-snap",
      undefined, undefined, undefined, undefined, true);
    expect(normal).not.toContain("center: [-3.9976, 53.1149]");
    expect(normal).toContain('map.once("load", locateInitialView)');
    expect(recording).not.toContain('map.once("load", locateInitialView)');
  });
});
