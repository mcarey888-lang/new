import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { buildRouteMapHtml } from "../routes/route-map-web";

const html = buildRouteMapHtml(undefined, "none");
function source(name: string) {
  const result = html.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n\\}"));
  if (!result) throw new Error("Missing map function " + name);
  return result[0];
}
const points = [
  { lat: 53.1, lng: -4 },
  { lat: 53.1005, lng: -4.002 },
  { lat: 53.101, lng: -4.001 },
  { lat: 53.102, lng: -4.003 },
  { lat: 53.103, lng: -4.002 },
];
function runtime() {
  const map = { getContainer: () => ({ clientHeight: 800 }), fitBounds: vi.fn() };
  const nodes = {
    hud: { style: {}, hidden: false, getBoundingClientRect: () => ({ top: 700, height: 60 }) },
    routeActions: { style: {}, hidden: false, getBoundingClientRect: () => ({ top: 640, height: 50 }) },
  };
  const context: any = {
    map, mapLoaded: true, hostBottomInset: 24, profileToken: 1, flying: true,
    anchors: [], legs: [], routePts: [],
    clearSummitDestination: vi.fn(), hideSummitCard: vi.fn(), setDrawing: vi.fn(),
    post: vi.fn(), emit: vi.fn(), fetch: vi.fn(),
    metres: (a: typeof points[0], b: typeof points[0]) => Math.hypot(a.lat - b.lat, a.lng - b.lng),
    recBounds: (coordinates: number[][]) => coordinates,
    document: { getElementById: (id: keyof typeof nodes) => nodes[id] },
  };
  runInNewContext(["savedRouteLegs", "fitSavedRoute", "flatten", "handleMsg"].map(source).join("\n"), context);
  context.redraw = vi.fn(() => { context.routePts = context.flatten(); });
  return context;
}

describe("saved routes stay on the existing map", () => {
  it("restores the full multi-waypoint line and navigates the camera without routing it again", () => {
    const app = runtime();
    const route = {
      id: "private-plan", name: "Saved mountain route",
      anchors: [points[0], points[2], points[4]], geometry: points,
      legs: [{ kind: "routed", lengthM: 100 }, { kind: "straight", lengthM: 120 }],
    };
    app.handleMsg({ data: JSON.stringify({ type: "loadRoute", route }) });
    expect(app.routePts).toEqual(points);
    expect(app.legs.map((leg: any) => leg.kind)).toEqual(["routed", "straight"]);
    expect(app.legs[0].points).toEqual(points.slice(0, 3));
    expect(app.legs[1].points).toEqual(points.slice(2));
    expect(app.map.fitBounds).toHaveBeenCalledWith(points.map(p => [p.lng, p.lat]),
      expect.objectContaining({ maxZoom: 16, padding: { top: 64, right: 32, left: 32, bottom: 184 } }));
    expect(app.setDrawing).toHaveBeenCalledWith(false);
    expect(app.clearSummitDestination).toHaveBeenCalledOnce();
    expect(app.hideSummitCard).toHaveBeenCalledOnce();
    expect(app.post).toHaveBeenCalledWith({ type: "routeLoaded", name: route.name });
    expect(app.fetch).not.toHaveBeenCalled();
    expect(app.profileToken).toBe(2);
    expect(app.flying).toBe(false);
  });

  it("preserves a two-anchor route's bends rather than drawing its endpoint chord", () => {
    const app = runtime();
    const legs = app.savedRouteLegs([points[0], points[4]], points, [{ kind: "routed" }]);
    expect(legs[0].points).toEqual(points);
    expect(legs[0].kind).toBe("routed");
  });

  it("does not promote pending or missing leg evidence into confirmed paths", () => {
    const app = runtime();
    expect(app.savedRouteLegs([points[0], points[4]], points, [{ kind: "pending" }])[0].kind).toBe("straight");
    expect(app.savedRouteLegs([points[0], points[4]], points, [])[0].kind).toBe("straight");
    expect(app.savedRouteLegs([points[0], points[4]], [], [{ kind: "routed" }])[0].kind).toBe("straight");
  });

  it("replaces the old route and reframes when another saved route is selected", () => {
    const app = runtime();
    const route = { name: "First", anchors: [points[0], points[4]], geometry: points, legs: [] };
    app.handleMsg({ data: JSON.stringify({ type: "loadRoute", route }) });
    const reversed = points.slice().reverse();
    app.handleMsg({ data: JSON.stringify({ type: "loadRoute", route: {
      ...route, name: "Second", anchors: [points[4], points[0]], geometry: reversed,
    } }) });
    expect(app.routePts).toEqual(reversed);
    expect(app.map.fitBounds).toHaveBeenCalledTimes(2);
    expect(app.anchors).toEqual([points[4], points[0]]);
  });
});
