import { describe, expect, it } from "vitest";
import { summitLayerScript } from "../routes/summit-layer-script";

/**
 * The failure Replit found on a real map, reproduced.
 *
 * Load Snowdonia, pan to Ben Nevis, pan straight back. The return journey
 * issues no request, because Snowdonia is already loaded — so the Ben Nevis
 * request is still the newest, arrives, and is accepted. The map, sitting over
 * Snowdonia, is handed Ben Nevis's hills and shows none at all. No error
 * anywhere.
 */

const SNOWDONIA = { s: 52.98, n: 53.15, w: -4.2, e: -3.9 };
const BEN_NEVIS = { s: 56.7, n: 56.9, w: -5.1, e: -4.9 };

interface Box { s: number; n: number; w: number; e: number }

/**
 * Enough DOM for the script to build its own furniture.
 *
 * The search box and the parking note are created in script rather than
 * written into the page, so a document that can only find elements is not
 * enough to run it any more.
 */
export function stubDocument() {
  const el = () => ({
    style: {} as Record<string, string>,
    textContent: "",
    innerHTML: "",
    type: "", placeholder: "", value: "",
    children: [] as unknown[],
    setAttribute: () => {},
    appendChild(child: unknown) { this.children.push(child); return child; },
    addEventListener: () => {},
    blur: () => {}, focus: () => {}, click: () => {},
  });
  return {
    createElement: el,
    getElementById: () => el(),
    body: el(),
  };
}

/** A map, a network and just enough DOM for the script to run. */
function harness(opts: { abortable?: boolean } = {}) {
  let view: Box = SNOWDONIA;
  let zoom = 12;
  let data: { features: unknown[] } = { features: [] };
  const handlers: Record<string, Array<(e: unknown) => void>> = {};
  const pending: Array<{ url: string; resolve: (body: unknown) => void; aborted: boolean }> = [];

  const map = {
    getZoom: () => zoom,
    getBounds: () => ({
      getSouth: () => view.s, getNorth: () => view.n,
      getWest: () => view.w, getEast: () => view.e,
    }),
    getSource: () => ({
      setData: (d: { features: unknown[] }) => { data = d; },
      getClusterExpansionZoom: () => Promise.resolve(10),
    }),
    addSource: () => {}, addLayer: () => {}, getLayer: () => null,
    setLayoutProperty: () => {},
    getCanvas: () => ({ style: {} }),
    on: (name: string, a: unknown, b?: unknown) => {
      const fn = (typeof a === "function" ? a : b) as (e: unknown) => void;
      (handlers[name] ||= []).push(fn);
    },
    easeTo: () => {},
  };

  const fetchStub = (url: string, opts?: { signal?: { addEventListener(t: string, f: () => void): void } }) =>
    new Promise((resolve, reject) => {
      const entry = { url, aborted: false, resolve: (body: unknown) => resolve({ ok: true, json: () => Promise.resolve(body) }) };
      pending.push(entry);
      opts?.signal?.addEventListener?.("abort", () => {
        entry.aborted = true;
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    });

  const scope = {
    map, post: () => {}, fetch: fetchStub,
    document: stubDocument(),
    setTimeout: ((fn: () => void) => { fn(); return 0; }) as unknown as typeof setTimeout,
    clearTimeout: () => {},
    /* Some browsers, and any request already on the wire, cannot be called
       back. Leaving it out is how the arrival guard gets tested on its own
       rather than hiding behind the abort. */
    AbortController: opts.abortable === false ? undefined : class {
      private fns: Array<() => void> = [];
      signal = { addEventListener: (_t: string, f: () => void) => { this.fns.push(f); } };
      abort() { this.fns.forEach(f => f()); }
    },
  };

  const body = `${summitLayerScript("/api/summits")}
  return { addSummitLayers: addSummitLayers, setSummitsOn: setSummitsOn,
           requestSummits: requestSummits, loaded: function () { return summitLoaded; } };`;
  const api = new Function(
    "map", "post", "fetch", "document", "setTimeout", "clearTimeout", "AbortController", body,
  )(scope.map, scope.post, scope.fetch, scope.document, scope.setTimeout, scope.clearTimeout, scope.AbortController) as {
    addSummitLayers(): void; setSummitsOn(on: boolean): void; requestSummits(): void;
    loaded(): { minLat: number; maxLat: number } | null;
  };

  return {
    api, pending,
    moveTo(box: Box, z = zoom) { view = box; zoom = z; },
    features: () => data.features,
    answer(index: number, box: Box, names: string[], truncated = false) {
      pending[index]!.resolve({
        summits: names.map((name, i) => ({
          id: `id-${name}`, name, alternativeName: null, heightM: 900 + i,
          classification: null, place: "Somewhere",
          lat: (box.s + box.n) / 2, lng: (box.w + box.e) / 2,
        })),
        truncated: truncated,
        covered: { minLat: box.s - 0.02, maxLat: box.n + 0.02, minLng: box.w - 0.03, maxLng: box.e + 0.03 },
      });
    },
  };
}

const settle = () => new Promise(r => setTimeout(r, 0));

describe("a reply for somewhere the map has left", () => {
  it("does not replace the hills that are actually on screen", async () => {
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);                 // asks for Snowdonia
    h.answer(0, SNOWDONIA, ["Yr Wyddfa", "Tryfan"]);
    await settle();
    expect(h.features()).toHaveLength(2);

    h.moveTo(BEN_NEVIS);                      // asks for Ben Nevis
    h.api.requestSummits();
    expect(h.pending).toHaveLength(2);

    h.moveTo(SNOWDONIA);                      // back again — issues nothing
    h.api.requestSummits();

    h.answer(1, BEN_NEVIS, ["Ben Nevis", "Carn Mor Dearg", "Aonach Beag"]);
    await settle();

    /* The bug: Ben Nevis's three hills land while the map sits over
       Snowdonia, and nothing is drawn where the person is looking. */
    const names = (h.features() as Array<{ properties: { name: string } }>).map(f => f.properties.name);
    expect(names).toContain("Yr Wyddfa");
    expect(names).not.toContain("Ben Nevis");
  });

  it("leaves the record pointing at the ground that is drawn", async () => {
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.answer(0, SNOWDONIA, ["Yr Wyddfa"]);
    await settle();

    h.moveTo(BEN_NEVIS);
    h.api.requestSummits();
    h.moveTo(SNOWDONIA);
    h.api.requestSummits();
    h.answer(1, BEN_NEVIS, ["Ben Nevis"]);
    await settle();

    /* If the record said Ben Nevis while Snowdonia was drawn, the next small
       pan would decide it already held the right hills and never correct. */
    const loaded = h.api.loaded()!;
    expect(loaded.maxLat).toBeLessThan(54);
  });
});

describe("a small pan inside what the server already searched", () => {
  it("does not ask again", async () => {
    /* The server pads the rectangle it searches and now says so. Recording
       only the narrower rectangle asked for made the slightest nudge look
       like new ground. */
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.answer(0, SNOWDONIA, ["Yr Wyddfa"]);
    await settle();
    expect(h.pending).toHaveLength(1);

    h.moveTo({ s: 52.981, n: 53.151, w: -4.199, e: -3.899 });
    h.api.requestSummits();
    expect(h.pending).toHaveLength(1);
  });

  it("still asks once the view leaves what was searched", async () => {
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.answer(0, SNOWDONIA, ["Yr Wyddfa"]);
    await settle();

    h.moveTo({ s: 53.5, n: 53.7, w: -4.2, e: -3.9 });
    h.api.requestSummits();
    expect(h.pending).toHaveLength(2);
  });
});

describe("a request the map has moved away from", () => {
  it("is abandoned rather than left running", async () => {
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.answer(0, SNOWDONIA, ["Yr Wyddfa"]);
    await settle();

    h.moveTo(BEN_NEVIS);
    h.api.requestSummits();
    h.moveTo(SNOWDONIA);
    h.api.requestSummits();

    expect(h.pending[1]!.aborted).toBe(true);
  });
});


describe("when the request cannot be called back", () => {
  /* The abort saves most cases, but not all: a browser without
     AbortController, or a response already on the wire, arrives regardless.
     That is what the guard on arrival is for, and testing it needs the abort
     out of the way — otherwise the guard could be deleted and every test
     above would still pass, which is exactly what happened the first time I
     wrote them. */

  it("still refuses an answer for ground the map has left", async () => {
    const h = harness({ abortable: false });
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.answer(0, SNOWDONIA, ["Yr Wyddfa", "Tryfan"]);
    await settle();

    h.moveTo(BEN_NEVIS);
    h.api.requestSummits();
    h.moveTo(SNOWDONIA);
    h.api.requestSummits();

    h.answer(1, BEN_NEVIS, ["Ben Nevis", "Carn Mor Dearg"]);
    await settle();

    const names = (h.features() as Array<{ properties: { name: string } }>).map(f => f.properties.name);
    expect(names).toContain("Yr Wyddfa");
    expect(names).not.toContain("Ben Nevis");
  });

  it("keeps the record on the ground that is drawn", async () => {
    const h = harness({ abortable: false });
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.answer(0, SNOWDONIA, ["Yr Wyddfa"]);
    await settle();

    h.moveTo(BEN_NEVIS);
    h.api.requestSummits();
    h.moveTo(SNOWDONIA);
    h.api.requestSummits();
    h.answer(1, BEN_NEVIS, ["Ben Nevis"]);
    await settle();

    expect(h.api.loaded()!.maxLat).toBeLessThan(54);
  });

  it("accepts an answer that does still cover where the map is", async () => {
    /* The guard must not be so eager that it throws away good answers. */
    const h = harness({ abortable: false });
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.answer(0, SNOWDONIA, ["Yr Wyddfa", "Tryfan", "Glyder Fawr"]);
    await settle();
    expect(h.features()).toHaveLength(3);
  });
});


describe("an answer the server had to cut short", () => {
  /* The arrival check used the same predicate as "should I fetch again", and
     that one short-circuits on truncation. So every truncated answer was
     thrown away on arrival — and since the retry truncates too, the map stayed
     empty over anywhere busy enough to hit the cap. Scotland at the widest
     zoom returns 400 of 770 eligible hills, so it drew nothing at all. */

  it("is still drawn", async () => {
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.answer(0, SNOWDONIA, ["Yr Wyddfa", "Tryfan", "Glyder Fawr"], true);
    await settle();
    expect(h.features()).toHaveLength(3);
  });

  it("is recorded, so the notice can say the list was cut", async () => {
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.answer(0, SNOWDONIA, ["Yr Wyddfa"], true);
    await settle();
    expect(h.api.loaded()).not.toBeNull();
  });

  it("still asks again on the next move, because it was incomplete", async () => {
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.answer(0, SNOWDONIA, ["Yr Wyddfa"], true);
    await settle();
    /* Inside the covered rectangle, which a complete answer would not refetch
       — but a cut-short one must, since the hills it dropped may be here. */
    h.moveTo({ s: 53.0, n: 53.1, w: -4.1, e: -4.0 });
    h.api.requestSummits();
    expect(h.pending).toHaveLength(2);
  });

  it("does not ask again inside a complete answer", async () => {
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.answer(0, SNOWDONIA, ["Yr Wyddfa"], false);
    await settle();
    h.moveTo({ s: 53.0, n: 53.1, w: -4.1, e: -4.0 });
    h.api.requestSummits();
    expect(h.pending).toHaveLength(1);
  });
});
