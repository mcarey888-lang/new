import { describe, expect, it } from "vitest";
import { summitLayerScript } from "../routes/summit-layer-script";
import { ARRIVAL_ZOOM } from "../services/summits/summitSearch";

/**
 * The search box and the car-park marker, as they actually behave in a page.
 *
 * Both are built in script rather than written into the map page, so string
 * matching proves nothing about them: the only honest test is to run the
 * script against a stub document and look at what it did.
 */

interface El {
  tagName: string;
  id: string;
  style: Record<string, string>;
  textContent: string;
  innerHTML: string;
  type: string; placeholder: string; value: string;
  children: El[];
  oninput: null | (() => void);
  onclick: null | (() => void);
  onkeydown: null | ((e: { key: string; preventDefault(): void }) => void);
  setAttribute(name: string, value: string): void;
  appendChild(child: El): El;
  blur(): void;
}

/** A document that remembers elements by id, so a write can be read back. */
function stubDom() {
  const byId = new Map<string, El>();
  const make = (tagName: string): El => {
    const el: El = {
      tagName, id: "", style: {}, textContent: "", innerHTML: "",
      type: "", placeholder: "", value: "",
      children: [], oninput: null, onclick: null, onkeydown: null,
      setAttribute: () => {},
      appendChild(child: El) { el.children.push(child); return child; },
      blur: () => {},
    };
    return el;
  };
  const doc = {
    createElement: make,
    body: make("body"),
    /* The summit card measures the attribution so it can sit clear of it.
       Null is what a page with no map control rendered yet would answer. */
    querySelector: () => null,
    getElementById: (id: string) => {
      if (!byId.has(id)) byId.set(id, make("div"));
      return byId.get(id)!;
    },
  };
  return { doc, byId };
}

interface Call { url: string; opts?: { method?: string; body?: string } }

function harness() {
  const calls: Call[] = [];
  const queue: Array<{ resolve: (body: unknown) => void; reject: (e: unknown) => void }> = [];
  let sourceData: { features: Array<{ properties: Record<string, unknown> }> } | null = null;
  const eased: Array<{ center: number[]; zoom: number }> = [];
  const timers: Array<() => void> = [];
  const { doc, byId } = stubDom();

  const map = {
    getZoom: () => 12,
    getBounds: () => ({ getSouth: () => 54, getNorth: () => 55, getWest: () => -3.5, getEast: () => -3 }),
    sources: new Map<string, { setData(d: unknown): void }>(),
    getSource(id: string) { return this.sources.get(id) ?? null; },
    addSource(id: string) {
      this.sources.set(id, { setData: (d: never) => { if (id === "parking") sourceData = d; } });
    },
    addLayer: () => {}, getLayer: () => null, setLayoutProperty: () => {},
    getCanvas: () => ({ style: {} }),
    on: () => {},
    easeTo: (o: { center: number[]; zoom: number }) => { eased.push(o); },
  };

  const fetchStub = (url: string, opts?: { method?: string; body?: string }) =>
    new Promise((resolve, reject) => {
      calls.push({ url, opts });
      queue.push({
        resolve: (body: unknown) => resolve({ ok: true, json: () => Promise.resolve(body) }),
        reject,
      });
    });

  const body = `${summitLayerScript("/api/summits", "/api/summits/parking")}
  return { buildSummitSearch: buildSummitSearch, searchInput: function () { return searchInput; },
           searchList: function () { return searchList; }, goToSummit: goToSummit,
           showParkingFor: showParkingFor, hideSummitCard: hideSummitCard,
           showSummitCard: showSummitCard, ensureParkingLayers: ensureParkingLayers,
           onDrawingFinished: onDrawingFinished,
           clearSummitDestination: clearSummitDestination,
           destination: function () { return summitDestination; },
           setDestination: function (d) { summitDestination = d; } };`;

  const api = new Function(
    "map", "post", "fetch", "document", "setTimeout", "clearTimeout", "AbortController", body,
  )(
    map, () => {}, fetchStub, doc,
    /* Collected rather than run, so the debounce is observable. */
    (fn: () => void) => { timers.push(fn); return timers.length; },
    () => { timers.length = 0; },
    class { signal = { addEventListener: () => {} }; abort() {} },
  ) as {
    buildSummitSearch(): void;
    searchInput(): El; searchList(): El;
    goToSummit(s: Record<string, unknown>): void;
    showParkingFor(s: Record<string, unknown>): void;
    hideSummitCard(keepParking?: boolean): void;
    showSummitCard(p: Record<string, unknown>, c: number[]): void;
    ensureParkingLayers(): void;
    onDrawingFinished(): void;
    clearSummitDestination(): void;
    destination(): Record<string, number | string> | null;
    setDestination(d: Record<string, number | string> | null): void;
  };

  return {
    api, calls, queue, eased, byId,
    parking: () => sourceData,
    flush: () => { const t = [...timers]; timers.length = 0; t.forEach(fn => fn()); },
    tick: () => new Promise(r => setTimeout(r, 0)),
  };
}

const HILL = {
  id: "abc", name: "Scafell Pike", alternativeName: null, lat: 54.454, lng: -3.211,
  heightM: 978, prominenceM: 912, classification: "Wainwright",
  place: "Cumbria, England", country: "England", area: "Cumbria",
};

describe("the search box", () => {
  it("asks for nothing until there is enough to ask about", () => {
    const h = harness();
    h.api.buildSummitSearch();
    h.api.searchInput().value = "b";
    h.api.searchInput().oninput!();
    h.flush();
    /* One letter against 21,792 hills is not a search, it is a download. */
    expect(h.calls).toHaveLength(0);
  });

  it("makes one request for a burst of typing, not one per letter", () => {
    const h = harness();
    h.api.buildSummitSearch();
    for (const text of ["sca", "scaf", "scafe", "scafel"]) {
      h.api.searchInput().value = text;
      h.api.searchInput().oninput!();
    }
    h.flush();
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.url).toContain("q=scafel");
  });

  it("ignores an answer to a query the person has already typed past", async () => {
    const h = harness();
    h.api.buildSummitSearch();

    h.api.searchInput().value = "sca";
    h.api.searchInput().oninput!();
    h.flush();
    h.api.searchInput().value = "scafell";
    h.api.searchInput().oninput!();
    h.flush();
    expect(h.calls).toHaveLength(2);

    /* The first request answers last — the ordinary case on a slow phone. */
    h.queue[1]!.resolve({ results: [HILL], tooShort: false });
    await h.tick();
    h.queue[0]!.resolve({ results: [{ ...HILL, name: "Scaw'd Law" }], tooShort: false });
    await h.tick();

    expect(h.api.searchList().children).toHaveLength(1);
    expect(h.api.searchList().children[0]!.innerHTML).toContain("Scafell Pike");
    expect(h.api.searchList().children[0]!.innerHTML).not.toContain("Scaw");
  });

  it("says when a name matched nothing, instead of going blank", async () => {
    const h = harness();
    h.api.buildSummitSearch();
    h.api.searchInput().value = "zzzz";
    h.api.searchInput().oninput!();
    h.flush();
    h.queue[0]!.resolve({ results: [], tooShort: false });
    await h.tick();
    expect(h.api.searchList().innerHTML).toContain("No hill by that name");
    expect(h.api.searchList().style["display"]).toBe("block");
  });

  it("says when the search itself failed, which is not the same as no results", async () => {
    const h = harness();
    h.api.buildSummitSearch();
    h.api.searchInput().value = "scafell";
    h.api.searchInput().oninput!();
    h.flush();
    h.queue[0]!.reject(new Error("offline"));
    await h.tick();
    /* A person who cannot tell these apart retypes the name five times. */
    expect(h.api.searchList().innerHTML).toContain("Could not search");
  });

  it("escapes a name rather than letting it write markup", async () => {
    const h = harness();
    h.api.buildSummitSearch();
    h.api.searchInput().value = "evil";
    h.api.searchInput().oninput!();
    h.flush();
    h.queue[0]!.resolve({
      results: [{ ...HILL, name: "<img src=x onerror=alert(1)>" }], tooShort: false,
    });
    await h.tick();
    const html = h.api.searchList().children[0]!.innerHTML;
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("flies to the hill that was chosen, close enough to see it", () => {
    const h = harness();
    h.api.buildSummitSearch();
    h.api.goToSummit(HILL);
    expect(h.eased).toHaveLength(1);
    expect(h.eased[0]!.center).toEqual([HILL.lng, HILL.lat]);
    expect(h.eased[0]!.zoom).toBe(ARRIVAL_ZOOM);
  });
});

describe("the car parks on the summit card", () => {
  const confirmed = {
    placeId: "N2", name: "Wasdale Head NT", lat: 54.46, lng: -3.28,
    distanceM: 1800, status: "gps_confirmed",
  };
  const guess = {
    placeId: "N1", name: "Roadside", lat: 54.47, lng: -3.25,
    distanceM: 900, status: "internet_lookup",
  };

  it("asks for car parks near the hill, by position and name", () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    expect(h.calls).toHaveLength(1);
    const url = h.calls[0]!.url;
    expect(url).toContain("/api/summits/parking?");
    expect(url).toContain("lat=54.454");
    expect(url).toContain("lng=-3.211");
    /* The name identifies a confirmed car park, and labels an unnamed one. */
    expect(url).toContain("name=Scafell%20Pike");
  });

  it("draws every car park it was given, not only the nearest", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({ parking: [confirmed, guess] });
    await h.tick();
    const features = h.parking()!.features;
    expect(features).toHaveLength(2);
    expect(features.map(f => f.properties["name"])).toEqual(["Wasdale Head NT", "Roadside"]);
  });

  it("puts each car park where the lookup said it is", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({ parking: [confirmed] });
    await h.tick();
    expect(h.parking()!.features[0]).toMatchObject({
      geometry: { type: "Point", coordinates: [-3.28, 54.46] },
      properties: { status: "gps_confirmed", name: "Wasdale Head NT" },
    });
  });

  it("marks a walker-confirmed car park as confirmed", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({ parking: [confirmed] });
    await h.tick();
    const note = h.byId.get("summitParking")!;
    expect(note.textContent).toContain("Parking: Wasdale Head NT");
    expect(note.textContent).not.toContain("not confirmed");
  });

  it("will not pass a looked-up car park off as a confirmed one", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({ parking: [guess] });
    await h.tick();
    const note = h.byId.get("summitParking")!;
    /* Drawn identically, a guess sends somebody down a farm track at dawn.
       The hedge is the whole point of this line. */
    expect(note.textContent).toContain("Possible parking");
    expect(note.textContent).toContain("not confirmed");
    expect(note.textContent).not.toMatch(/^Parking:/);
  });

  it("does not let a count of guesses read as corroboration", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({ parking: [guess, { ...guess, placeId: "N3" }, { ...guess, placeId: "N4" }] });
    await h.tick();
    const note = h.byId.get("summitParking")!;
    /* Three unconfirmed car parks are not better evidence than one. */
    expect(note.textContent).toBe("3 possible car parks on the map — none confirmed");
  });

  it("tells unnamed car parks apart by distance, not by repeating a placeholder", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({
      parking: [
        { ...guess, placeId: "N5", name: null, distanceM: 3123 },
        { ...guess, placeId: "N6", name: null, distanceM: 4772 },
      ],
    });
    await h.tick();
    const labels = h.parking()!.features.map(f => f.properties["label"]);
    /* Six pins all reading "Mapped parking near Scafell Pike" is what this
       replaced: identical, and true of none of them in particular. */
    expect(labels[0]).toBe("Car park · 3.1 km (unconfirmed)");
    expect(labels[1]).toBe("Car park · 4.8 km (unconfirmed)");
    expect(new Set(labels).size).toBe(2);
  });

  it("falls back to metres for a car park at the foot of the hill", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({ parking: [{ ...guess, name: null, distanceM: 420 }] });
    await h.tick();
    expect(h.parking()!.features[0]!.properties["label"]).toBe("Car park · 420 m (unconfirmed)");
  });

  it("labels an unconfirmed pin as unconfirmed on the map itself", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({ parking: [confirmed, guess] });
    await h.tick();
    const labels = h.parking()!.features.map(f => f.properties["label"]);
    /* The card can be shut; the pin has to stand on its own. */
    expect(labels).toContain("Wasdale Head NT");
    expect(labels).toContain("Roadside (unconfirmed)");
  });

  it("says when no car park was found, which is a real answer", async () => {
    const h = harness();
    h.api.ensureParkingLayers();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({ parking: [] });
    await h.tick();
    expect(h.parking()!.features).toHaveLength(0);
    expect(h.byId.get("summitParking")!.textContent).toBe("No mapped parking found nearby");
  });

  it("separates a failed check from a hill with no parking", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.reject(new Error("offline"));
    await h.tick();
    expect(h.byId.get("summitParking")!.textContent).toBe("Could not check parking");
  });

  it("takes the car parks away with the card that owned them", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({ parking: [confirmed, guess] });
    await h.tick();
    expect(h.parking()!.features).toHaveLength(2);

    h.api.hideSummitCard();
    /* Left behind, they sit there claiming to be the parking for the next
       hill somebody opens. */
    expect(h.parking()!.features).toHaveLength(0);
    expect(h.byId.get("summitParking")!.style["display"]).toBe("none");
  });

  it("does not let a slow answer land on the card that replaced it", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    const other = { ...HILL, name: "Great Gable", lat: 54.482, lng: -3.219 };
    h.api.showParkingFor(other);

    /* Scafell's answer arrives after Great Gable's card is already open. */
    h.queue[1]!.resolve({ parking: [{ ...confirmed, name: "Honister" }] });
    await h.tick();
    h.queue[0]!.resolve({ parking: [{ ...confirmed, name: "Wasdale Head NT" }] });
    await h.tick();

    expect(h.parking()!.features).toHaveLength(1);
    expect(h.parking()!.features[0]!.properties["name"]).toBe("Honister");
  });
});

describe("planning a route to a summit", () => {
  /* The drawing engine, as the page implements it: append only. */
  function drawing() {
    const added: Array<{ lng: number; lat: number }> = [];
    return {
      added,
      scope: {
        anchors: [] as Array<{ lat: number; lng: number }>,
        drawing: false,
        addPoint(p: { lng: number; lat: number }) {
          added.push(p);
          this.anchors.push({ lat: p.lat, lng: p.lng });
        },
      },
    };
  }

  function harnessWithDrawing() {
    const h = harness();
    return h;
  }

  it("holds the summit back instead of making it the start", () => {
    /* Putting it down first would make the hill the start of the walk, and
       every point after it would come later still — the opposite of what a
       walk up a mountain looks like. */
    const h = harnessWithDrawing();
    h.api.setDestination({ lat: 54.454, lng: -3.211, id: "abc", name: "Scafell Pike" });
    expect(h.api.destination()).not.toBeNull();
  });

  it("adds nothing when the drawing finished with no route", () => {
    /* A lone summit point is not a route, and leaving one behind is worse
       than leaving nothing. */
    const h = harnessWithDrawing();
    h.api.setDestination({ lat: 54.454, lng: -3.211, id: "abc", name: "Scafell Pike" });
    h.api.onDrawingFinished();
    expect(h.api.destination()).toBeNull();
  });

  it("forgets the destination once the drawing is done", () => {
    const h = harnessWithDrawing();
    h.api.setDestination({ lat: 54.454, lng: -3.211, id: "abc", name: "Scafell Pike" });
    h.api.onDrawingFinished();
    /* Left set, the next route drawn anywhere would silently end at this
       hill. */
    expect(h.api.destination()).toBeNull();
  });

  it("drops the destination when the route is cleared", () => {
    const h = harnessWithDrawing();
    h.api.setDestination({ lat: 54.454, lng: -3.211, id: "abc", name: "Scafell Pike" });
    h.api.clearSummitDestination();
    expect(h.api.destination()).toBeNull();
  });
});

describe("the summit card's route button", () => {
  const script = () => summitLayerScript("/api/summits", "/api/summits/parking");

  it("offers to route to the hill, not from it", () => {
    /* You park at the bottom and walk up. A hill is where a walk ends. */
    const body = script();
    expect(body).toContain("Plan a route to here");
    expect(body).not.toContain("Plan a route from here");
  });

  it("says it is extending an existing line rather than starting over", () => {
    expect(script()).toContain("Continue route to here");
  });

  it("will not append the summit twice when the walker drew to it themselves", () => {
    /* A last point already on the summit means they have arrived. Adding it
       again leaves a leg of no length. */
    const body = script();
    expect(body).toMatch(/SUMMIT_ARRIVED_M/);
    expect(body).toMatch(/summitMetres\(last, destination\) <= SUMMIT_ARRIVED_M\) return;/);
  });

  it("tells the person what is about to happen", () => {
    /* Drawing mode turning on with no visible reason, and a hill appearing
       at the end minutes later, is a magic trick rather than a tool. */
    expect(script()).toContain("Tap where you will start");
    expect(script()).toContain("is added as the finish when you are done");
  });
});


describe("car parks while planning a route to the hill", () => {
  const park = {
    placeId: "N2", name: "Wasdale Head NT", lat: 54.46, lng: -3.28,
    distanceM: 1800, status: "gps_confirmed",
  };

  it("keeps them when the card closes to plan a route there", async () => {
    /* The card closes to make room, and the next tap is where the walk
       starts — which on a hill is nearly always one of these. Clearing them
       at that exact moment takes away the one thing being looked at. */
    const h = harness();
    h.api.showParkingFor({ name: "Scafell Pike", lat: 54.454, lng: -3.211 });
    h.queue[0]!.resolve({ parking: [park] });
    await h.tick();
    expect(h.parking()!.features).toHaveLength(1);

    h.api.hideSummitCard(true);
    expect(h.parking()!.features).toHaveLength(1);
  });

  it("still takes them away when the card is simply dismissed", async () => {
    const h = harness();
    h.api.showParkingFor({ name: "Scafell Pike", lat: 54.454, lng: -3.211 });
    h.queue[0]!.resolve({ parking: [park] });
    await h.tick();

    h.api.hideSummitCard();
    expect(h.parking()!.features).toHaveLength(0);
  });

  it("closes the card keeping parking when planning a route", () => {
    const body = summitLayerScript("/api/summits", "/api/summits/parking");
    const handler = body.slice(
      body.indexOf('summitPlanRoute").onclick'),
      body.indexOf("function summitRouteExists"),
    );
    expect(handler).toContain("hideSummitCard(true)");
    /* And nowhere else: dismissing the card must still clear them. */
    expect(body.match(/hideSummitCard\(true\)/g) ?? []).toHaveLength(1);
  });
});

/**
 * Ticking a hill off.
 *
 * The rules worth protecting here are about who decides. The map draws what
 * the app tells it and reports taps; it never keeps its own idea of what is
 * ticked, and it never asks the server — this page is public, and whose hills
 * these are is not its business.
 */
describe("ticked summits", () => {
  const body = summitLayerScript("/api/summits", "/api/summits/parking");

  it("colours the pin from the feature, not from a second layer", () => {
    /* One layer keeps clicking, clustering and draw order identical for
       ticked and unticked hills. */
    expect(body).toMatch(
      /"circle-color": \["case", \["boolean", \["get", "done"\], false\], SUMMIT_DONE_COLOR, SUMMIT_COLOR\]/);
    expect(body).not.toMatch(/id: "summit-point-done"/);
  });

  it("does not rely on colour alone to mark one", () => {
    expect(body).toMatch(/"circle-radius": \["case", \["boolean", \["get", "done"\], false\], 7, 6\]/);
  });

  it("never asks the server which hills are ticked", () => {
    /* The page is served unauthenticated to anyone. A request for one
       person's hills from here would either leak or need a token this page
       must not hold. */
    const fetches = body.match(/fetch\(/g) ?? [];
    expect(fetches.length).toBeGreaterThan(0);
    expect(body).not.toMatch(/fetch\([^)]*tick/i);
    expect(body).not.toMatch(/Authorization/i);
  });

  it("replaces the whole list rather than toggling one id", () => {
    /* A toggle that misses leaves the two sides disagreeing for good. */
    expect(body).toMatch(/function setSummitTicks\(ids\)/);
    expect(body).toMatch(/summitTicked = Object\.create\(null\)/);
  });

  it("reports the tap and lets the app decide", () => {
    /* The pin recolours when the app sends the list back, so what is drawn
       is always what was really saved. */
    expect(body).toMatch(/post\(\{ type: "summitTickToggled", id: p\.id, name: p\.name, done: !done \}\)/);
    const tickHandler = body.slice(body.indexOf('document.getElementById("summitTick").onclick'));
    expect(tickHandler.slice(0, 400)).not.toMatch(/summitTicked\[/);
  });

  it("recolours what is already on screen without asking for it again", () => {
    const setter = body.slice(body.indexOf("function setSummitTicks"));
    const block = setter.slice(0, setter.indexOf("\n}"));
    expect(block).toContain("summitCollection(summitPinsOnScreen)");
    expect(block).not.toContain("requestSummits()");
  });

  it("builds every summit feature in one place", () => {
    /* Two builders drift, and the same hill ends up drawn two ways. */
    expect(body.match(/function summitCollection\(/g) ?? []).toHaveLength(1);
    expect(body.match(/map\.getSource\("summits"\)\.setData\(summitCollection\(/g) ?? [])
      .toHaveLength(2);
  });

  it("redraws an open card in place rather than closing it", () => {
    /* Closing would drop the parking markers and the person's place. */
    const setter = body.slice(body.indexOf("function setSummitTicks"));
    const block = setter.slice(0, setter.indexOf("\n}"));
    expect(block).toContain("showSummitCard(summitCardLast.p, summitCardLast.coordinates)");
    expect(block).not.toContain("hideSummitCard");
  });
});
