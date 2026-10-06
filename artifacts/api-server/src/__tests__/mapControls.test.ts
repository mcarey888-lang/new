import { describe, expect, it } from "vitest";
import { buildRouteMapHtml } from "../routes/route-map-web";
import { mapControlsScript } from "../routes/map-controls-script";

const script = (gpx = true) => mapControlsScript(gpx);
const page = () => buildRouteMapHtml("K", "full", "/api/map-tiles", true, "/api/path-snap", "/api/route-profile", "/api/route-gpx", "/api/summits");

describe("the script is valid JavaScript", () => {
  it("parses", () => {
    expect(() => new Function(`var map, post, LAYERS, drawing, snapping, mode, activeLayer,
      setDrawing, setSnapping, setMode, setLayer, undoPoint, clearRoute; ${script()}`)).not.toThrow();
  });

  it("carries no backtick that would close the page template", () => {
    expect(script()).not.toContain("`");
  });
});

describe("three icons, not twelve buttons", () => {
  it("offers layers, locate and a pencil", () => {
    const s = script();
    expect(s).toContain('controlButton("Map layers"');
    expect(s).toContain('controlButton("Show my location"');
    expect(s).toContain('controlButton("Plan a route"');
  });

  it("gives every icon a label a screen reader can read", () => {
    /* An icon with no name is a button nobody can use without sight. */
    expect(script()).toContain('b.setAttribute("aria-label", label)');
    expect(script()).toContain("b.title = label");
  });

  it("says whether the layers sheet is open", () => {
    expect(script()).toContain('setAttribute("aria-expanded"');
  });
});

describe("what it does with the original buttons", () => {
  it("hides them rather than removing them", () => {
    /* They stay the mechanism: this rail calls the same functions and reads
       their enabled state. */
    const s = script();
    expect(s).toContain('panel.style.display = "none"');
    expect(s).toContain('document.querySelector(".panel")');
  });

  it("calls the page's own functions rather than faking clicks", () => {
    const s = script();
    expect(s).toContain("setDrawing(!drawing)");
    expect(s).toContain("setSnapping(!snapping)");
    expect(s).toContain("setLayer(layer.id)");
    expect(s).toContain("setMode(entry[1])");
  });

  it("mirrors their enabled state instead of deciding its own", () => {
    /* "When is Undo available" has one right answer, and a second copy of it
       would drift. */
    const s = script();
    expect(s).toContain("control.disabled = original.disabled");
    expect(s).toContain('mirror("ctlUndo", "undo")');
    expect(s).toContain('mirror("ctlSave", "save")');
  });

  it("watches them for changes rather than polling", () => {
    expect(script()).toContain("new MutationObserver(syncControls)");
  });
});

describe("things appear when they matter", () => {
  it("keeps the drawing tools hidden until drawing", () => {
    // Undo and Clear mean nothing before there is a line, and a disabled
    // button is still something to read past.
    expect(script()).toContain('drawBar.style.display = drawing ? "block" : "none"');
  });

  it("shows saving only once there is a route to save", () => {
    expect(script()).toContain('routeBar.style.display = saveOriginal && !saveOriginal.disabled ? "block" : "none"');
  });

  it("leaves the GPX button out entirely when the server cannot build one", () => {
    expect(built({ gpx: true }).labels).toContain("GPX");
    expect(built({ gpx: false }).labels).not.toContain("GPX");
  });
});

/**
 * Runs the real script against a stub page and reports what it built.
 *
 * String matching proves the source says something; this proves the browser
 * would do it. The first version of the GPX test matched on source and failed
 * for the wrong reason — the button is guarded at runtime, not omitted from
 * the text.
 */
function built(opts: { gpx?: boolean; drawing?: boolean; saveDisabled?: boolean } = {}) {
  const created: Array<Record<string, unknown>> = [];
  const make = (): Record<string, unknown> => {
    const node: Record<string, unknown> = {
      style: new Proxy({ cssText: "" } as Record<string, string>, {
        set(t, k: string, v: string) { t[k] = v; return true; },
        get(t, k: string) { return t[k] ?? ""; },
      }),
      dataset: {}, children: [] as unknown[],
      textContent: "", innerHTML: "", id: "", type: "", title: "", className: "",
      disabled: false, onclick: null,
      setAttribute(k: string, v: string) { (this as Record<string, unknown>)[k] = v; },
      appendChild(c: unknown) { (this["children"] as unknown[]).push(c); },
    };
    created.push(node);
    return node;
  };
  const originals: Record<string, Record<string, unknown>> = {
    save: { ...make(), disabled: opts.saveDisabled ?? true, click() {} },
    gpx: { ...make(), disabled: true, click() {} },
    undo: { ...make(), disabled: true }, clear: { ...make(), disabled: true },
    snap: { ...make(), disabled: false },
  };
  const panel = make();
  const doc = {
    createElement: make,
    querySelector: (sel: string) => (sel === ".panel" ? panel : null),
    querySelectorAll: () => [] as unknown[],
    getElementById: (id: string) => originals[id] ?? null,
    body: { appendChild(c: unknown) { created.push(c as Record<string, unknown>); } },
  };
  const scope = `var map = { getZoom: function () { return 10; }, easeTo: function () {} };
    var post = function () {};
    var LAYERS = [{ id: "os", label: "OS Outdoor" }, { id: "osm", label: "OpenStreetMap" }];
    var drawing = ${opts.drawing ? "true" : "false"}, snapping = true, mode = "2d", activeLayer = "os";
    function setDrawing() {} function setSnapping() {} function setMode() {}
    function setLayer() {} function undoPoint() {} function clearRoute() {}
    ${mapControlsScript(opts.gpx ?? true)}
    buildControls();`;
  new Function("document", "navigator", "MutationObserver", scope)(
    doc, {}, undefined,
  );
  return { labels: created.map(n => String(n["textContent"] ?? "")).filter(Boolean) };
}

describe("locate", () => {
  it("says so rather than doing nothing when it cannot", () => {
    /* A button that silently does nothing is worse than one that explains. */
    const s = script();
    expect(s).toContain("if (!navigator.geolocation)");
    expect(s).toContain('type: "locateUnavailable"');
    expect(s).toContain('type: "locateDenied"');
  });

  it("does not zoom back out on somebody already zoomed in", () => {
    expect(script()).toContain("Math.max(map.getZoom(), 13)");
  });
});

describe("the page it goes into", () => {
  it("builds the rail when the map has its own chrome", () => {
    expect(page()).toContain("buildControls();");
  });

  it("leaves an embedded map alone", () => {
    /* With chrome off the map is inside the app's own screen, which brings
       its own controls. A second rail over the top would be two of
       everything. */
    const embedded = buildRouteMapHtml("K", "none", "/api/map-tiles", true, "/api/path-snap");
    expect(embedded).not.toContain("buildControls();");
  });
});
