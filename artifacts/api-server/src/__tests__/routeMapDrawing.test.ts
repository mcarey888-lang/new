import { describe, expect, it } from "vitest";
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
  /* The safety property this whole feature turns on. A line drawn by tapping
     hops straight between taps — over crag, over cliff, over water. Rendering
     it in the same solid blue as a path-following route would tell someone it
     had been checked when it has not. */

  it("sends an unsnapped route to the dashed layer and leaves the solid one empty", () => {
    const html = page();
    expect(html).toContain(
      'map.getSource("route").setData(routeSnapped ? drawn : empty());',
    );
    expect(html).toContain(
      'map.getSource("asserted").setData(routeSnapped ? empty() : drawn);',
    );
  });

  it("draws the two states in different ink", () => {
    const html = page();
    /* Amber and dashed for asserted, solid blue for a surveyed route. Same
       colour for both would make the distinction invisible, which is worse
       than not drawing it at all. */
    expect(html).toContain('"line-dasharray": [2, 1.6]');
    expect(html).toContain('var ASSERTED_COLOR = "#E9B949"');
    expect(html).toContain('var ROUTE_COLOR = "#167DF7"');
  });

  it("says so in words as well as colour", () => {
    /* Colour alone fails anyone who cannot distinguish amber from blue, and
       fails everyone on a bright hillside. */
    expect(page()).toContain("not following paths yet");
  });

  it("starts unsnapped, so the cautious state is the default", () => {
    expect(page()).toContain("var routeSnapped = false;");
  });

  it("drops the snapped claim the moment a point is added by hand", () => {
    /* Extending a snapped route by tapping makes part of it unsurveyed. The
       whole line has to stop claiming otherwise. */
    expect(bodyOf(page(), "function addPoint")).toContain("routeSnapped = false");
  });

  it("drops it when a point is dragged, too", () => {
    expect(bodyOf(page(), "function move(e)")).toContain("routeSnapped = false");
  });

  it("treats a host route without an explicit flag as snapped, but honours false", () => {
    /* msg.snapped !== false, not msg.snapped === true: a host that omits the
       flag is handing over a real route, while one that passes false is
       handing over a draft and must not have it drawn as surveyed. */
    expect(page()).toContain("routeSnapped = msg.snapped !== false;");
  });
});

describe("the route the host receives", () => {
  it("carries whether it is snapped, so the app cannot lose that", () => {
    const html = page();
    expect(html).toContain('post({ type: "routeChanged", snapped: routeSnapped,');
  });

  it("reports length from great-circle distance, not a flat approximation", () => {
    /* The only number this page states. Over a long day a flat-earth shortcut
       is wrong by enough to matter to someone planning around it. */
    expect(page()).toContain("Math.asin(Math.min(1, Math.sqrt(h)))");
  });
});
