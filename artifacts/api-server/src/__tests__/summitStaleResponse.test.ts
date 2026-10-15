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
    tabIndex: -1,
    attributes: {} as Record<string, string>,
    onclick: null as null | (() => void),
    onkeydown: null as null | ((event: { key: string; preventDefault(): void }) => void),
    children: [] as unknown[],
    setAttribute(name: string, value: string) { this.attributes[name] = value; },
    appendChild(child: unknown) { this.children.push(child); return child; },
    addEventListener: () => {},
    blur: () => {}, focus: () => {}, click: () => {},
  });
  const elements = new Map<string, ReturnType<typeof el>>();
  return {
    createElement: el,
    getElementById: (id: string) => {
      if (!elements.has(id)) elements.set(id, el());
      return elements.get(id)!;
    },
    querySelector: () => null,
    body: el(),
  };
}

/** A map, a network and just enough DOM for the script to run. */
function harness(opts: { abortable?: boolean } = {}) {
  let view: Box = SNOWDONIA;
  let zoom = 12;
  let data: { features: unknown[] } = { features: [] };
  const handlers: Record<string, Array<(e: unknown) => void>> = {};
  const pending: Array<{
    url: string; resolve: (body: unknown) => void;
    fail: (status: number) => void; aborted: boolean;
  }> = [];

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
      const entry = {
        url, aborted: false,
        resolve: (body: unknown) => resolve({ ok: true, json: () => Promise.resolve(body) }),
        fail: (status: number) => resolve({ ok: false, status }),
      };
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
           requestSummits: requestSummits, loaded: function () { return summitLoaded; },
           liftSummitNotice: liftSummitNotice };`;
  const api = new Function(
    "map", "post", "fetch", "document", "setTimeout", "clearTimeout", "AbortController", body,
  )(scope.map, scope.post, scope.fetch, scope.document, scope.setTimeout, scope.clearTimeout, scope.AbortController) as {
    addSummitLayers(): void; setSummitsOn(on: boolean): void; requestSummits(): void;
    loaded(): { minLat: number; maxLat: number } | null;
    liftSummitNotice(inset: number): void;
  };

  return {
    api, pending,
    notice: () => scope.document.getElementById("summitNote"),
    moveTo(box: Box, z = zoom) { view = box; zoom = z; },
    features: () => data.features,
    answer(index: number, box: Box, names: string[], truncated = false) {
      pending[index]!.resolve({
        summits: names.map((name, i) => ({
          id: `id-${name}`, name, alternativeName: null, heightM: 900 + i,
          classification: null, place: "Somewhere",
          lat: (box.s + box.n) / 2, lng: (box.w + box.e) / 2,
        })),
        truncated,
        covered: { minLat: box.s - 0.02, maxLat: box.n + 0.02, minLng: box.w - 0.03, maxLng: box.e + 0.03 },
      });
    },
  };
}

const settle = () => new Promise(r => setTimeout(r, 0));

describe("a retryable catalogue failure", () => {
  it("shows an accessible retry action and recovers without fake pins", async () => {
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.pending[0]!.fail(503);
    await settle();
    expect(h.features()).toHaveLength(0);
    const notice = h.notice();
    expect(notice.textContent).toContain("tap to retry");
    expect(notice.attributes.role).toBe("button");
    expect(notice.tabIndex).toBe(0);
    notice.onclick!();
    expect(h.pending).toHaveLength(2);
    expect(notice.textContent).toBe("Loading summits…");
    expect(notice.onclick).toBeNull();
    h.answer(1, SNOWDONIA, ["Tryfan"]);
    await settle();
    expect(h.features()).toHaveLength(1);
    expect(notice.style.display).toBe("none");
  });

  it.each(["Enter", " "])("supports the %j keyboard action", async key => {
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.pending[0]!.fail(503);
    await settle();
    let prevented = false;
    h.notice().onkeydown!({ key, preventDefault: () => { prevented = true; } });
    expect(prevented).toBe(true);
    expect(h.pending).toHaveLength(2);
    h.answer(1, SNOWDONIA, ["Tryfan"]);
    await settle();
    expect(h.features()).toHaveLength(1);
  });

  it("stays above the host panel when the inset changes", async () => {
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.pending[0]!.fail(503);
    await settle();
    h.api.liftSummitNotice(240);
    expect(h.notice().style.bottom).toBe("252px");
  });

  it("does not turn an incomplete-result warning into a retry button", async () => {
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.answer(0, SNOWDONIA, ["Tryfan"], true);
    await settle();
    expect(h.notice().textContent).toContain("zoom in for the rest");
    expect(h.notice().attributes.role).toBe("status");
    expect(h.notice().onclick).toBeNull();
  });
});

describe("partial summit responses", () => {
  it("draws a capped response covering the current view rather than leaving the map empty", async () => {
    const h = harness();
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.answer(0, SNOWDONIA, ["Tryfan", "Carnedd Dafydd"], true);
    await settle();
    expect(h.features()).toHaveLength(2);
    expect(h.api.loaded()).not.toBeNull();
    // A partial response can be displayed without pretending it is a complete
    // cache: a later movement must still be allowed to ask again.
    h.api.requestSummits();
    expect(h.pending).toHaveLength(2);
  });

  it("still refuses a capped response for an area the map has left", async () => {
    const h = harness({ abortable: false });
    h.api.addSummitLayers();
    h.api.setSummitsOn(true);
    h.moveTo(BEN_NEVIS);
    h.answer(0, SNOWDONIA, ["Tryfan"], true);
    await settle();
    expect(h.features()).toHaveLength(0);
    expect(h.api.loaded()).toBeNull();
  });

  it("keeps fractional zooms in the same band on client and server", () => {
    for (const zoom of [6.8, 8.7, 9.8, 11.7, 12.8]) {
      const h = harness();
      h.moveTo(SNOWDONIA, zoom);
      h.api.addSummitLayers();
      h.api.setSummitsOn(true);
      if (zoom < 7) {
        expect(h.pending).toHaveLength(0);
      } else {
        const sentZoom = Number(new URL(h.pending[0]!.url, "https://example.test").searchParams.get("zoom"));
        expect(sentZoom).toBe(zoom);
      }
    }
  });
});

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
