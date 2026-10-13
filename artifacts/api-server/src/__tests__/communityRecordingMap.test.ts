import { describe, it, expect } from "vitest";
import vm from "node:vm";
import { buildRouteMapHtml } from "../routes/route-map-web";

function harness() {
  const html = buildRouteMapHtml("K", "none", "/api/map-tiles", true, "/api/path-snap");
  const code = html.slice(html.indexOf("var communityPins = [];"), html.indexOf("function handleMsg(ev)"));
  const markers: any[] = [], messages: unknown[] = [];
  const context = {
    map: { fitBounds: () => undefined }, post: (value: unknown) => messages.push(value),
    document: { createElement: () => ({ setAttribute: () => undefined, style: {} }) },
    maplibregl: {
      LngLatBounds: class { extend() { return this; } },
      Marker: class {
        removed = false; point: unknown;
        constructor(public options: any) { markers.push(this); }
        setLngLat(point: unknown) { this.point = point; return this; }
        addTo() { return this; }
        remove() { this.removed = true; }
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return { markers, messages, show: (routes: unknown[]) => vm.runInContext(`showCommunityPins(${JSON.stringify(routes)})`, context) };
}
describe("member recording discovery overlay", () => {
  it("opens an exact owner-scoped reference without treating it as a summit", () => {
    const h = harness();
    h.show([{ owner: "a", hikeId: "one", name: "Walk", startPoint: { lat: 53, lon: -2 } }]);
    expect(h.markers[0].point).toEqual([-2, 53]);
    h.markers[0].options.element.onclick({ stopPropagation() {} });
    expect(h.messages).toEqual([{ type: "communityRouteSelected", owner: "a", hikeId: "one" }]);
  });
  it("clears pins on withdrawal/account reset and refuses bad positions", () => {
    const h = harness();
    h.show([{ owner: "a", hikeId: "one", startPoint: { lat: 53, lon: -2 } }]);
    h.show([{ owner: "a", hikeId: "bad", startPoint: { lat: 100, lon: -2 } }]);
    expect(h.markers[0].removed).toBe(true);
    expect(h.markers).toHaveLength(1);
    h.show([]);
  });
});
