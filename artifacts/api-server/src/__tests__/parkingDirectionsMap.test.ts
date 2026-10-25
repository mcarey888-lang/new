import { describe, expect, it } from "vitest";
import { parkingDirectionsScript } from "../routes/parking-directions-script";
import { buildRouteMapHtml } from "../routes/route-map-web";

function harness(native = false, agent = "Android") {
  type Element = {
    children: Element[]; textContent?: string; href?: string; target?: string; rel?: string;
    onclick?: (e: unknown) => void;
    appendChild(e: Element): void; setAttribute(): void; addEventListener(): void;
  };
  const create = (): Element => ({
    children: [], appendChild(child) { this.children.push(child); },
    setAttribute() {}, addEventListener() {},
  });
  let body: Element | undefined;
  let removed = 0;
  const posts: Record<string, unknown>[] = [];
  const queries: unknown[][] = [];
  const feature = {
    geometry: { coordinates: [-3.28, 54.46] },
    properties: { name: "Wasdale Head", status: "internet_lookup" },
  };
  const map = {
    getLayer: () => true,
    queryRenderedFeatures(...args: unknown[]) { queries.push(args); return [feature]; },
  };
  class Popup {
    setLngLat() { return this; }
    setDOMContent(el: Element) { body = el; return this; }
    addTo() { return this; }
    remove() { removed++; }
  }
  const api = new Function("map", "document", "navigator", "window", "maplibregl", "post",
    `${parkingDirectionsScript()}; return { parkingAt, showParkingPopup, closeParkingPopup, parkingWebUrl };`,
  )(map, { createElement: create }, { userAgent: agent },
    native ? { ReactNativeWebView: {} } : {}, { Popup }, (msg: Record<string, unknown>) => posts.push(msg));
  return { api, feature, posts, queries, body: () => body!, removed: () => removed };
}

describe("parking marker directions", () => {
  it("offers a 44px marker hit area and only queries the parking layer", () => {
    const h = harness();
    expect(h.api.parkingAt({ point: { x: 100, y: 50 } })).toEqual(h.feature);
    expect(h.queries[0]).toEqual([[[78, 28], [122, 72]], { layers: ["parking-dot"] }]);
    expect(h.api.parkingAt({})).toBeNull();
  });

  it("shows uncertainty, real destination links and no auto-launch", () => {
    const h = harness();
    h.api.showParkingPopup(h.feature);
    const nodes = h.body().children;
    expect(nodes[0].textContent).toBe("Wasdale Head");
    expect(nodes[1].textContent).toContain("unconfirmed");
    expect(nodes[2].textContent).toBe("↗ Directions");
    expect(nodes[2].href).toContain("intent://");
    expect(nodes[2].href).toContain("browser_fallback_url=");
    expect(nodes[3].href).toContain("destination=54.46%2C-3.28");
    expect(nodes[4].href).toContain("waze.com/ul?ll=54.46%2C-3.28&navigate=yes");
    expect(nodes[4].target).toBe("_blank");
    expect(h.posts).toEqual([]);
  });

  it("hands native taps to the host with the parking point and provider, not a URL", () => {
    const h = harness(true);
    h.api.showParkingPopup(h.feature);
    let prevented = false;
    h.body().children[4].onclick!({
      stopPropagation() {}, preventDefault() { prevented = true; },
    });
    expect(prevented).toBe(true);
    expect(h.posts).toEqual([{
      type: "parkingDirections", lat: 54.46, lng: -3.28, name: "Wasdale Head", provider: "waze",
    }]);
  });

  it("lets browser links open directly on the user's tap", () => {
    const h = harness(false);
    h.api.showParkingPopup(h.feature);
    let prevented = false;
    h.body().children[3].onclick!({
      stopPropagation() {}, preventDefault() { prevented = true; },
    });
    expect(prevented).toBe(false);
    expect(h.posts).toEqual([]);
  });

  it("preserves confirmed wording without claiming legal access and closes replaced popups", () => {
    const h = harness();
    h.feature.properties.status = "gps_confirmed";
    h.api.showParkingPopup(h.feature);
    expect(h.body().children[1].textContent).toContain("Visited by a walker");
    expect(h.body().children[1].textContent).toContain("Check current access");
    h.api.showParkingPopup(h.feature);
    expect(h.removed()).toBe(1);
    h.api.closeParkingPopup();
    expect(h.removed()).toBe(2);
  });

  it("refuses invalid coordinates and uses text rather than HTML for parking names", () => {
    const h = harness();
    h.feature.geometry.coordinates = [-3, 100];
    h.api.showParkingPopup(h.feature);
    expect(h.body()).toBeUndefined();
    h.feature.geometry.coordinates = [-3, 54];
    h.feature.properties.name = '<img src=x onerror="alert(1)">';
    h.api.showParkingPopup(h.feature);
    expect(h.body().children[0].textContent).toBe(h.feature.properties.name);
  });

  it("selects Apple directions on iOS and a web fallback on desktop", () => {
    const h = harness();
    expect(h.api.parkingWebUrl("default", 54, -3, "Car park", "iPhone")).toContain("maps.apple.com");
    expect(h.api.parkingWebUrl("default", 54, -3, "Car park", "Firefox Linux")).toContain("google.com/maps/dir");
  });

  it("consumes parking taps before adding route points or emitting a tap", () => {
    const html = buildRouteMapHtml(undefined);
    const guard = html.indexOf("if (parking) { showParkingPopup(parking); return; }");
    expect(guard).toBeGreaterThan(-1);
    expect(html.indexOf('post({ type: "tap"', guard)).toBeGreaterThan(guard);
    expect(html.indexOf("if (drawing) addPoint(e.lngLat)", guard)).toBeGreaterThan(guard);
  });
});
