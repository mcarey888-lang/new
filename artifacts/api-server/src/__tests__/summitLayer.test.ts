import { describe, expect, it } from "vitest";
import { buildRouteMapHtml } from "../routes/route-map-web";
import { summitLayerScript } from "../routes/summit-layer-script";
import { ALL_SUMMITS_ZOOM, zoomBandKey, zoomBandTable } from "../services/summits/summitPins";

const script = () => summitLayerScript("/api/summits");
const page = () => buildRouteMapHtml("K", "full", "/api/map-tiles", true, "/api/path-snap", "/api/route-profile", "/api/route-gpx", "/api/summits");

describe("the script is valid JavaScript", () => {
  it("parses", () => {
    /* A stray backtick inside the page's template literal has broken this
       file before, and the symptom is a blank map rather than an error. */
    expect(() => new Function(`var map, post; ${script()}`)).not.toThrow();
  });

  it("carries no backtick that would close the page template", () => {
    expect(script()).not.toContain("`");
  });
});

describe("the bands the map reads", () => {
  it("come from the server's ladder, not a second copy", () => {
    expect(script()).toContain(JSON.stringify(zoomBandTable()));
  });

  it("agree with the server at every zoom", () => {
    /* The map and the query disagreeing about which hills belong at a zoom
       would show as pins that flicker in and out while panning. */
    const table = zoomBandTable();
    const bandFor = (z: number): string => {
      for (const [minZoom, key] of table) if (z >= minZoom) return key;
      return "none";
    };
    for (let zoom = 0; zoom <= 20; zoom += 1) {
      expect(bandFor(zoom)).toBe(zoomBandKey(zoom));
    }
  });
});

describe("not asking the server more than it must", () => {
  it("waits before asking, so a drag is one request not forty", () => {
    expect(script()).toMatch(/setTimeout\(requestSummits, \d+\)/);
  });

  it("carries the refetch rule serialised from the tested module", () => {
    expect(script()).toContain("loaded.band !== next.band");
    expect(script()).toContain("loaded.truncated");
  });

  it("drops an answer for a view the map has left", () => {
    /* Without this a slow reply lands after a newer one and the pins jump
       back to where they used to be. */
    const s = script();
    expect(s).toContain("var token = ++summitRequest;");
    expect(s).toContain("if (token !== summitRequest) return;");
  });

  it("aborts the request in flight when a newer one starts", () => {
    expect(script()).toContain("summitAbort.abort()");
    expect(script()).toContain('err.name === "AbortError"');
  });
});

describe("clustering", () => {
  it("stops clustering where the map starts showing every hill", () => {
    // Past that zoom, two pins close together are two real hills and merging
    // them hides one.
    expect(script()).toContain("clusterMaxZoom: SUMMIT_ALL_ZOOM");
    expect(script()).toContain(`var SUMMIT_ALL_ZOOM = ${ALL_SUMMITS_ZOOM};`);
  });

  it("grows a cluster in steps rather than with its count", () => {
    /* Area reads as quantity. A radius straight off the count makes fifty
       hills look ten times five. */
    expect(script()).toContain('["step", ["get", "point_count"]');
  });

  it("opens a cluster rather than selecting it", () => {
    expect(script()).toContain("getClusterExpansionZoom");
  });

  it("separates clusters from single summits in both directions", () => {
    const s = script();
    expect(s).toContain('filter: ["has", "point_count"]');
    expect(s).toContain('filter: ["!", ["has", "point_count"]]');
  });

  it("holds names back until there is room for them", () => {
    expect(script()).toMatch(/id: "summit-label"[^]*minzoom: \d+/);
  });
});

describe("what it tells the person", () => {
  it("admits when the list came back cut short", () => {
    // A map quietly showing the biggest few hundred, with no hint there are
    // more, lies by omission.
    expect(script()).toContain("zoom in for the rest");
  });

  it("names a failure rather than leaving an empty map", () => {
    // An empty map and a map that failed to load look identical otherwise.
    expect(script()).toContain("Could not load summits");
  });

  it("says nothing at a zoom where there is nothing to draw", () => {
    const s = script();
    expect(s).toContain('if (band === "none")');
    expect(s).toContain("summitNotice(null)");
  });

  it("sends the summit to the app when one is tapped", () => {
    const s = script();
    expect(s).toContain('type: "summitSelected"');
    expect(s).toContain("id: p.id");
  });
});

describe("the page it goes into", () => {
  it("includes the layer and drives it from map movement", () => {
    const html = page();
    expect(html).toContain("addSummitLayers()");
    expect(html).toContain('map.on("moveend", scheduleSummits);');
    expect(html).toContain('id="summitNote"');
  });

  it("leaves the map working when no summit URL is configured", () => {
    /* Route drawing does not depend on pins, so a missing endpoint makes a
       quieter map, not a broken one. */
    const html = buildRouteMapHtml("K", "full", "/api/map-tiles", true, "/api/path-snap");
    expect(html).not.toContain("addSummitLayers = ");
    expect(html).not.toContain('map.on("moveend", scheduleSummits);');
    expect(html).toContain('id="map"');
  });

  it("guards the call, so the page cannot die if the script is absent", () => {
    expect(page()).toContain('if (typeof addSummitLayers === "function")');
  });
});
