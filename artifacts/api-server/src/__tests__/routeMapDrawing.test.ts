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

  it("never leaves a failure without a reason", () => {
    /* A bare "13 sections not on a path" is the least useful state this
       readout has: it is the one where somebody cannot tell a broken
       deployment from genuinely pathless ground. It cost an afternoon of
       looking in the wrong place. */
    expect(page()).toContain("could not reach the path service");
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

describe("the snap radius the page asks for", () => {
  /* The bug this exists to prevent happened: a whole route came back as
     straight lines with the snapping working perfectly throughout, because the
     tolerance was smaller than anyone can tap. */

  it("scales with the zoom rather than being fixed", () => {
    expect(page()).toContain("156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, map.getZoom())");
  });

  it("is forgiving enough to actually hit a path", () => {
    /* Measured: a point chosen deliberately, zoomed in, on a screenshot, was
       still 113 m from the nearest mapped way. At planning zoom the old
       multiplier of 20 gave about 60 m, so nothing snapped. 45 gives about
       135 m there, which catches a tap like that. */
    const html = page();
    const m = /metresPerPixel \* (\d+)/.exec(html);
    expect(m, "radius multiplier not found").not.toBeNull();
    const multiplier = Number(m![1]);
    expect(multiplier).toBeGreaterThanOrEqual(40);

    /* At zoom 14 over Snowdonia that must comfortably clear 113 m. */
    const metresPerPixel = (156543.03392 * Math.cos(53.12 * Math.PI / 180)) / 2 ** 14;
    expect(metresPerPixel * multiplier).toBeGreaterThan(113);
  });

  /* The multiplier alone solves the zoomed-OUT end. The other end broke too:
     zoomed right in on aerial imagery, the scaled radius falls below the
     offset between the photograph and the mapped geometry, so a tap placed
     exactly on the visible path misses the path in the data. */
  it("does not collapse when somebody zooms in to be precise", () => {
    const html = page();
    const floor = /var SNAP_RADIUS_FLOOR_M = (\d+);/.exec(html);
    expect(floor, "no floor on the snap radius").not.toBeNull();
    expect(Number(floor![1])).toBeGreaterThanOrEqual(20);
    expect(html).toContain("Math.max(SNAP_RADIUS_FLOOR_M, Math.round(metresPerPixel * 45))");
  });

  it("keeps a usable tolerance at every zoom somebody can draw at", () => {
    const html = page();
    const multiplier = Number(/metresPerPixel \* (\d+)/.exec(html)![1]);
    const floorM = Number(/var SNAP_RADIUS_FLOOR_M = (\d+);/.exec(html)![1]);
    const radiusAt = (z: number) =>
      Math.max(floorM, (156543.03392 * Math.cos((53.12 * Math.PI) / 180) * multiplier) / 2 ** z);
    /* Zoom 19 is close enough to count parked cars, which is exactly where
       somebody zooms to place a tap carefully. */
    for (const z of [14, 16, 17, 18, 19, 20]) {
      expect(radiusAt(z), `tolerance collapsed at zoom ${z}`).toBeGreaterThanOrEqual(20);
    }
  });

  it("stays tight enough not to reach across to a different path", () => {
    /* The floor buys tolerance where there was none; it must not buy so much
       that a car park with several paths becomes ambiguous. The snapper takes
       the nearest way inside the radius, so this is a bound on how far a
       "nearest" can be, not a licence to pick the wrong one. */
    const floorM = Number(/var SNAP_RADIUS_FLOOR_M = (\d+);/.exec(page())![1]);
    expect(floorM).toBeLessThanOrEqual(40);
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
