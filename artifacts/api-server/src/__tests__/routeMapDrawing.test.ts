import { describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { buildRouteMapHtml } from "../routes/route-map-web";

/**
 * These are contract tests over the generated page, not behaviour tests.
 *
 * The drawing logic runs in the browser, inside a script this module emits as
 * a string, and nothing in this repo runs a browser in CI. So what follows
 * asserts that the page is wired the way it must be — it cannot prove that
 * clicking actually adds a point. That was verified by driving a real browser:
 * four clicks produced four points and a 2.08 km readout, undo removed one,
 * dragging a dot moved it without leaving a duplicate, clear emptied it, and
 * the console stayed silent.
 *
 * Treat a failure here as a real regression and the passes as a floor, not a
 * guarantee. If drawing grows much past this, it earns a browser test.
 */

const page = () => buildRouteMapHtml("K", "full", "/api/map-tiles", true);

describe("zooming out in 3D", () => {
  function cameraHarness() {
    let zoom = 13;
    let pitch = 0;
    const events = new Map<string, () => void>();
    const map = {
      addControl: vi.fn(),
      getCenter: () => ({ lat: 53.1149 }),
      on: vi.fn((name: string, callback: () => void) => { events.set(name, callback); }),
      getZoom: () => zoom, getPitch: () => pitch,
      setPitch: vi.fn((value: number) => { pitch = value; }),
      setTerrain: vi.fn(), setProjection: vi.fn(), setLayoutProperty: vi.fn(),
      easeTo: vi.fn((value: { pitch: number }) => { pitch = value.pitch; }),
    };
    const window = { parent: null as unknown, addEventListener: vi.fn() };
    window.parent = window;
    const context = {
      maplibregl: { Map: function () { return map; }, NavigationControl: function () {} },
      window,
      document: {
        getElementById: () => ({ setAttribute: vi.fn() }),
        querySelectorAll: () => [], addEventListener: vi.fn(),
      },
      setTimeout, clearTimeout,
    };
    const script = page().match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    runInNewContext(script!, context);
    const runtime = context as typeof context & {
      mapLoaded: boolean; setMode: (mode: string) => void; routePts: unknown[];
      snapRadiusM: () => number;
    };
    runtime.mapLoaded = true;
    return {
      map, runtime,
      zoomTo(value: number) { zoom = value; events.get("zoom")?.(); },
    };
  }

  it("transitions from terrain to globe and back without replacing the route", () => {
    const { map, runtime, zoomTo } = cameraHarness();
    runtime.routePts = [{ lat: 53.12, lng: -4 }, { lat: 53.13, lng: -4 }];
    const points = runtime.routePts;
    runtime.setMode("3d");
    expect(map.setProjection).toHaveBeenLastCalledWith({ type: "globe" });
    expect(map.setTerrain).toHaveBeenLastCalledWith({ source: "terrain", exaggeration: 1.4 });
    zoomTo(1);
    expect(map.setTerrain).toHaveBeenLastCalledWith(null);
    expect(map.getPitch()).toBe(0);
    const calls = map.setTerrain.mock.calls.length;
    zoomTo(0.5);
    expect(map.setTerrain).toHaveBeenCalledTimes(calls);
    zoomTo(13);
    expect(map.setTerrain).toHaveBeenLastCalledWith({ source: "terrain", exaggeration: 1.4 });
    expect(map.getPitch()).toBe(62);
    expect(runtime.routePts).toBe(points);
    runtime.setMode("2d");
    expect(map.setProjection).toHaveBeenLastCalledWith({ type: "mercator" });
    expect(map.setTerrain).toHaveBeenLastCalledWith(null);
    expect(map.getPitch()).toBe(0);
  });
  it("keeps a 25m minimum tap tolerance at detailed zooms", () => {
    const { runtime, zoomTo } = cameraHarness();
    zoomTo(19);
    expect(runtime.snapRadiusM()).toBe(25);
    zoomTo(22);
    expect(runtime.snapRadiusM()).toBe(25);
  });
  it("scales tap tolerance by 45 pixels when zoomed out", () => {
    const { runtime, zoomTo } = cameraHarness();
    zoomTo(13);
    expect(runtime.snapRadiusM()).toBe(Math.round(
      156543.03392 * Math.cos(53.1149 * Math.PI / 180) / 2 ** 13 * 45,
    ));
  });

  it("pins matching globe-capable renderer and stylesheet versions", () => {
    expect(page()).toContain("maplibre-gl@5.24.0/dist/maplibre-gl.js");
    expect(page()).toContain("maplibre-gl@5.24.0/dist/maplibre-gl.css");
  });
  it("uses a globe in 3D and retains a flat Mercator projection in 2D", () => {
    expect(page()).toContain('map.setProjection({ type: next === "3d" ? "globe" : "mercator" })');
  });
  it("only enables terrain at detailed zoom levels and removes it at globe scale", () => {
    const html = page();
    expect(html).toContain('mode === "3d" && map.getZoom() >= 12');
    expect(html).toContain('map.setTerrain(enabled ? { source: "terrain", exaggeration: 1.4 } : null)');
    expect(html).toContain("if (enabled === terrainEnabled) return");
  });
  it("centres the globe without losing the previous local terrain pitch", () => {
    const html = page();
    expect(html).toContain('mode === "3d" && map.getZoom() < 6');
    expect(html).toContain("localPitch = map.getPitch()");
    expect(html).toContain("map.setPitch(0)");
    expect(html).toContain("map.setPitch(localPitch)");
  });
});

/** The body of one function in the emitted script, up to the next one. A fixed
 *  character window would be at the mercy of comment length. */
function bodyOf(html: string, signature: string): string {
  const start = html.indexOf(signature);
  expect(start, `${signature} missing from the page`).toBeGreaterThan(-1);
  const rest = html.slice(start + signature.length);
  const end = rest.indexOf("\nfunction ");
  return end === -1 ? rest : rest.slice(0, end);
}

describe("drawing controls", () => {
  it("offers draw, undo and clear", () => {
    const html = page();
    expect(html).toContain('id="draw"');
    expect(html).toContain('id="undo"');
    expect(html).toContain('id="clear"');
  });

  it("wires each control to its handler", () => {
    const html = page();
    expect(html).toContain('document.getElementById("draw").onclick');
    expect(html).toContain('document.getElementById("undo").onclick = undoPoint');
    expect(html).toContain('document.getElementById("clear").onclick = clearRoute');
  });

  it("lets the host drive drawing too, for the embedded case", () => {
    /* With chrome="none" the app supplies the buttons, so the page must accept
       the same three actions as messages or the embedded map cannot draw. */
    const html = page();
    expect(html).toContain('msg.type === "draw"');
    expect(html).toContain('msg.type === "undo"');
    expect(html).toContain('msg.type === "clear"');
  });

  it("hides its own controls when the host supplies them", () => {
    const embedded = buildRouteMapHtml("K", "none", "/api/map-tiles", true);
    /* The readout has to go with the panel. Left behind, it sits over the
       app's own chrome saying things the app is already saying. */
    expect(embedded).toContain(".panel,#hud{display:none}");
  });
});

describe("a drawn line is never dressed as a surveyed one", () => {
  /* The safety property this whole feature turns on. A leg that has not been
     routed over mapped paths hops straight between taps — over crag, over
     cliff, over water. Rendering it in the same solid blue as a path-following
     leg would say it had been checked when nothing checked it. */

  it("counts only a routed leg as surveyed", () => {
    /* Every other state — waiting on the server, a gap with no path across it,
       a tap on open ground, snapping off, the server unreachable — is a
       straight line, and the one predicate decides that for all of them. */
    expect(page()).toContain('return leg && leg.kind === "routed";');
  });

  it("sends surveyed and unsurveyed legs to different sources", () => {
    expect(page()).toContain(
      "(legIsSurveyed(leg) ? surveyed : asserted).push(coords);",
    );
  });

  it("draws the two states in different ink", () => {
    const html = page();
    /* Amber and dashed for asserted, solid blue for surveyed. The same colour
       for both would make the distinction invisible, which is worse than not
       drawing it at all. */
    expect(html).toContain('"line-dasharray": [2, 1.6]');
    expect(html).toContain('var ASSERTED_COLOR = "#E9B949"');
    expect(html).toContain('var ROUTE_COLOR = "#167DF7"');
  });

  it("says so in words as well as colour", () => {
    /* Colour alone fails anyone who cannot separate amber from blue, and fails
       everyone on a bright hillside. The count is spelled out because "3
       sections" says how much of a route is a guess and "partly snapped"
       does not. */
    const html = page();
    expect(html).toContain('" not on a path"');
    expect(html).toContain("no path across the gap");
    expect(html).toContain("Snapping off — straight lines");
  });

  it("falls back to straight on every failure, never to apparently routed", () => {
    const html = page();
    /* A gap, an off-path tap, an unknown outcome and a thrown request all end
       in a kind that legIsSurveyed rejects. */
    for (const kind of ['kind: "gap"', 'kind: "offPath"', 'kind: "straight"', 'kind: "pending"']) {
      expect(html).toContain(kind);
    }
    expect(html).toContain('reason: "unreachable"');
  });

  it("makes a new leg straight before it is ever routed", () => {
    /* The cautious state is what a leg is born in. If the server never answers
       the leg simply stays as drawn. */
    expect(bodyOf(page(), "function addPoint")).toContain('legs[i] = { kind: "straight", points: null };');
  });

  it("drops the routed geometry the moment a point is dragged", () => {
    /* Keeping it would leave the line following a path it no longer touches. */
    const move = bodyOf(page(), "function move(e)");
    expect(move).toContain('legs[dragIndex - 1] = { kind: "straight", points: null }');
    expect(move).toContain('legs[dragIndex] = { kind: "straight", points: null }');
  });

  it("re-asks only for the legs a moved point touches", () => {
    expect(bodyOf(page(), "function resnapAround")).toContain("snapLeg(i - 1)");
  });

  it("re-snaps on release, not on every frame of a drag", () => {
    /* A request per mousemove would hammer a service we are meant to be
       sparing, and most of those answers would be stale before they landed. */
    expect(bodyOf(page(), "function drop")).toContain("resnapAround(moved)");
  });

  it("ignores an answer for a leg that has since changed", () => {
    /* A slow reply landing after the point moved would drag the line back to
       where it used to be, with nothing on screen to explain it. */
    expect(page()).toContain("legs[i].token !== token");
  });

  it("treats a host route without an explicit flag as surveyed, but honours false", () => {
    /* msg.snapped !== false, not === true: a host that omits the flag is
       handing over a real route, while one passing false is handing over a
       draft and must not have it drawn as checked. */
    expect(page()).toContain("var surveyed = msg.snapped !== false;");
  });
});

describe("the route the host receives", () => {
  it("calls the route snapped only when every leg is", () => {
    /* One straight section makes the whole route unsurveyed. A route that is
       "mostly" on paths is not a route that was checked. */
    expect(page()).toContain("legs.length > 0 && legs.every(legIsSurveyed)");
  });

  it("hands over the legs as well as the line, so detail is not lost", () => {
    expect(page()).toContain("anchors: anchors.slice()");
    expect(page()).toContain("legs: legs.map(");
  });

  it("reports length from great-circle distance, not a flat approximation", () => {
    /* The only number this page states. Over a long day the shortcut is wrong
       by enough to matter to someone planning around it. */
    expect(page()).toContain("Math.asin(Math.min(1, Math.sqrt(h)))");
  });

  it("never counts a shared junction twice", () => {
    /* Each leg starts where the last ended. Without the guard the length
       counts a zero-length hop at every junction and the point list doubles. */
    expect(bodyOf(page(), "function flatten")).toContain("last.lat !== q.lat || last.lng !== q.lng");
  });
});

describe("a reply that is not a snap result", () => {
  /* The readout said "3 sections not on a path" and nothing else, on a route
     drawn directly over mapped rights of way. The cause was a reply that was
     not a snap result at all — it parsed as JSON, carried no `outcome`, and
     fell through to the branch meant for unrecognised outcomes. A throttled
     server and ground with no paths on it looked identical. */

  it("checks the response was accepted before reading it as a result", () => {
    expect(page()).toContain("if (!r.ok) return { outcome: r.status === 429 ?");
  });

  it("names throttling as itself", () => {
    const html = page();
    expect(html).toContain('"rate_limited"');
    expect(html).toContain("too many requests — wait a moment");
  });

  it("does not mistake a reply with no outcome for unmapped ground", () => {
    const html = page();
    expect(html).toContain('typeof data.outcome !== "string"');
    expect(html).toContain('"not_a_snap_reply"');
  });

  it("counts a throttled leg towards the straight sections", () => {
    expect(page()).toContain("gaps + offPath + unavailable + noPaths + throttled + other");
  });

  it("leads with throttling, because tapping on makes it worse", () => {
    const html = page();
    const throttledAt = html.indexOf("too many requests — wait a moment");
    const busyAt = html.indexOf("map service busy, try again");
    expect(throttledAt).toBeGreaterThan(-1);
    expect(busyAt).toBeGreaterThan(throttledAt);
  });
});
