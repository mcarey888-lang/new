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

  const body = `${summitLayerScript("/api/summits", "/api/directions/lookup")}
  return { buildSummitSearch: buildSummitSearch, searchInput: function () { return searchInput; },
           searchList: function () { return searchList; }, goToSummit: goToSummit,
           showParkingFor: showParkingFor, hideSummitCard: hideSummitCard,
           showSummitCard: showSummitCard, ensureParkingLayers: ensureParkingLayers };`;

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
    hideSummitCard(): void;
    showSummitCard(p: Record<string, unknown>, c: number[]): void;
    ensureParkingLayers(): void;
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

describe("the car park on the summit card", () => {
  it("asks the existing directions lookup, with the hill's region to narrow it", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.url).toBe("/api/directions/lookup");
    expect(h.calls[0]!.opts!.method).toBe("POST");
    const sent = JSON.parse(h.calls[0]!.opts!.body!);
    /* "Scafell Pike" alone matches more than one hill in the catalogue. */
    expect(sent).toMatchObject({
      hillName: "Scafell Pike", location: "Cumbria, England",
      summitLat: HILL.lat, summitLng: HILL.lng,
    });
  });

  it("marks a walker-confirmed car park as confirmed", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({ status: "gps_confirmed", name: "Wasdale Head NT", lat: 54.46, lng: -3.28 });
    await h.tick();
    const note = h.byId.get("summitParking")!;
    expect(note.textContent).toBe("Parking: Wasdale Head NT");
    expect(note.textContent).not.toContain("not confirmed");
  });

  it("will not pass a looked-up car park off as a confirmed one", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({ status: "internet_lookup", name: "Car Park", lat: 54.46, lng: -3.28 });
    await h.tick();
    const note = h.byId.get("summitParking")!;
    /* Drawn identically, a guess sends somebody down a farm track at dawn.
       The hedge is the whole point of this line. */
    expect(note.textContent).toContain("Possible parking");
    expect(note.textContent).toContain("not confirmed");
    expect(note.textContent).not.toMatch(/^Parking:/);
  });

  it("puts the car park on the map where the lookup said it is", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({ status: "gps_confirmed", name: "Wasdale Head NT", lat: 54.46, lng: -3.28 });
    await h.tick();
    const features = h.parking()!.features;
    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({
      geometry: { type: "Point", coordinates: [-3.28, 54.46] },
      properties: { label: "Wasdale Head NT", status: "gps_confirmed" },
    });
  });

  it("draws nothing when no car park was found", async () => {
    const h = harness();
    h.api.ensureParkingLayers();
    h.api.showParkingFor(HILL);
    /* A 404 here is a normal answer: plenty of hills have no named parking. */
    h.queue[0]!.resolve(null);
    await h.tick();
    expect(h.parking()!.features).toHaveLength(0);
  });

  it("takes the car park away with the card that owned it", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    h.queue[0]!.resolve({ status: "gps_confirmed", name: "Wasdale Head NT", lat: 54.46, lng: -3.28 });
    await h.tick();
    expect(h.parking()!.features).toHaveLength(1);

    h.api.hideSummitCard();
    /* Left behind, it sits there claiming to be the parking for the next
       hill somebody opens. */
    expect(h.parking()!.features).toHaveLength(0);
  });

  it("does not let a slow answer land on the card that replaced it", async () => {
    const h = harness();
    h.api.showParkingFor(HILL);
    const other = { ...HILL, name: "Great Gable", lat: 54.482, lng: -3.219 };
    h.api.showParkingFor(other);

    /* Scafell's answer arrives after Great Gable's card is already open. */
    h.queue[1]!.resolve({ status: "gps_confirmed", name: "Honister", lat: 54.51, lng: -3.21 });
    await h.tick();
    h.queue[0]!.resolve({ status: "gps_confirmed", name: "Wasdale Head NT", lat: 54.46, lng: -3.28 });
    await h.tick();

    expect(h.parking()!.features[0]!.properties["label"]).toBe("Honister");
  });
});
