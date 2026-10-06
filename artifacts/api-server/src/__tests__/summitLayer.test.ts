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

describe("the card a tapped summit opens", () => {
  it("is built by the script, so the map file gains nothing for it", () => {
    /* route-map-web.ts carries the globe work and is edited on two branches,
       so the card creates its own element rather than needing markup there. */
    const s = script();
    expect(s).toContain('document.createElement("div")');
    expect(s).toContain("document.body.appendChild(summitCard)");
    expect(page()).not.toContain('id="summitCard"');
  });

  it("says nothing about ascent when it is not known", () => {
    /* Which is nearly always: a couple of dozen route ascents against
       twenty-one thousand hills. A dash or a zero reads as a flat walk, and
       somebody could plan a day on it. */
    const s = script();
    expect(s).toContain("Number(metres) <= 0) return \"\"");
    expect(s).toMatch(/metres === null \|\| metres === undefined/);
  });

  it("leaves out any part that is missing rather than filling it", () => {
    expect(script()).toContain("bits.join(\" · \")");
    expect(script()).toContain("if (p.classification) bits.push");
  });

  it("escapes what it puts on the page", () => {
    /* Names come from a catalogue, not from us. Hill names carry apostrophes
       and brackets, and one day something worse. */
    const s = script();
    expect(s).toContain("function escapeSummitText");
    expect(s).toContain('replace(/</g, "&lt;")');
    expect(s).toContain("escapeSummitText(p.name)");
  });

  it("offers planning a route from the summit", () => {
    const s = script();
    expect(s).toContain('type: "planRouteFrom"');
    expect(s).toContain("Plan a route from here");
  });

  it("closes the card when the pins are switched off", () => {
    // A card about a hill that is no longer drawn is a card about nothing.
    expect(script()).toContain("if (!summitsOn) hideSummitCard();");
  });

  it("carries ascent as flat values, not an object", () => {
    /* MapLibre feature properties are a flat bag; an object arrives as
       "[object Object]". */
    const s = script();
    expect(s).toContain("ascentM:");
    expect(s).toContain("ascentRoute:");
  });
});

describe("the card, rendered", () => {
  /** Runs the real script against a stub document and reads what it produced. */
  function render(summit: Record<string, unknown>): string {
    const card = { style: { cssText: "", display: "" }, setAttribute() {}, innerHTML: "", id: "" };
    const doc = {
      createElement: () => card,
      body: { appendChild() {} },
      getElementById: () => ({ onclick: null, textContent: "", style: {} }),
    };
    const api = new Function(
      "map", "post", "fetch", "document", "setTimeout", "clearTimeout", "AbortController",
      `${script()} return { showSummitCard: showSummitCard };`,
    )({ on() {}, getCanvas: () => ({ style: {} }) }, () => {}, () => {}, doc, () => 0, () => {}, undefined) as {
      showSummitCard(p: Record<string, unknown>, c: number[]): void;
    };
    api.showSummitCard(summit, [-5.0037, 56.7969]);
    return String(card.innerHTML);
  }

  it("reads as a walker would say it", () => {
    const html = render({
      id: "a", name: "Ben Nevis", alternativeName: "Beinn Nibheis",
      heightM: 1345, classification: "Munro", place: "Highland, Scotland", ascentM: null,
    });
    expect(html).toContain("Ben Nevis");
    expect(html).toContain("Beinn Nibheis");
    expect(html).toContain("Munro · 1345 m · Highland, Scotland");
  });

  it("shows no ascent line at all when there is no figure", () => {
    expect(render({ id: "a", name: "Ben Nevis", heightM: 1345, ascentM: null }))
      .not.toContain("climbing");
  });

  it("shows one when there is", () => {
    const html = render({ id: "a", name: "Ben Nevis", heightM: 1345, ascentM: 1352, ascentRoute: "Pony Track" });
    expect(html).toContain("1352 m of climbing via Pony Track");
  });

  it("drops a hill with no badge to height and place alone", () => {
    const html = render({ id: "a", name: "Snowdon", alternativeName: "Yr Wyddfa",
      heightM: 1085, classification: null, place: "Gwynedd, Wales", ascentM: null });
    expect(html).toContain("1085 m · Gwynedd, Wales");
    expect(html).not.toContain("·  ·");
  });

  it("does not let a catalogue name run as markup", () => {
    const html = render({ id: "a", name: 'Bad <script>alert("x")</script>', heightM: 100 });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("the card's route button says what it will do", () => {
  it("offers to start a route when there is none", () => {
    expect(script()).toContain("'Plan a route from here'");
  });

  it("offers to add to one when there is", () => {
    /* It appends either way. Appending is reasonable; calling it "plan a
       route from here" is not, because somebody would tap it expecting their
       existing line to be replaced. */
    const s = script();
    expect(s).toContain("summitRouteExists() ? 'Add to your route'");
    expect(s).toContain("function summitRouteExists()");
  });

  it("copes with the route state not existing at all", () => {
    // The summit layer can load on a page with no drawing on it.
    expect(script()).toContain('typeof anchors !== "undefined"');
  });
});
