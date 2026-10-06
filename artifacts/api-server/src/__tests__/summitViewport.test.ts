import { describe, expect, it } from "vitest";
import { coversView, coversViewSource, shouldRefetch, shouldRefetchSource, type LoadedView } from "../services/summits/summitViewport";

const loaded = (over: Partial<LoadedView> = {}): LoadedView => ({
  minLat: 52.9, maxLat: 53.3, minLng: -4.4, maxLng: -3.8,
  band: "prominence:100", truncated: false, ...over,
});
const inside = { minLat: 53.0, maxLat: 53.1, minLng: -4.1, maxLng: -4.0, band: "prominence:100" };

describe("when the map asks again", () => {
  it("asks when it has nothing", () => {
    expect(shouldRefetch(null, inside)).toBe(true);
  });

  it("does not ask for ground it already holds", () => {
    // The loaded rectangle carries the pan margin, so this covers most small
    // movements — which is most movements.
    expect(shouldRefetch(loaded(), inside)).toBe(false);
  });

  it("asks when the view moves past what it holds", () => {
    for (const edge of [
      { ...inside, maxLat: 53.9 },
      { ...inside, minLat: 52.0 },
      { ...inside, maxLng: -3.0 },
      { ...inside, minLng: -5.0 },
    ]) {
      expect(shouldRefetch(loaded(), edge)).toBe(true);
    }
  });

  it("asks when the zoom band changes, even standing still", () => {
    /* The subtle one. Zoom in without panning and more hills qualify, so the
       rectangle is covered but the answer is not. Skipping this leaves the
       map showing a handful of Munros while the person is close enough to see
       every bump. */
    expect(shouldRefetch(loaded(), { ...inside, band: "prominence:30" })).toBe(true);
    expect(shouldRefetch(loaded({ band: "headline" }), inside)).toBe(true);
  });

  it("asks again inside a truncated answer", () => {
    /* A cut-short list is a partial one, and the hills that were cut may be
       exactly the ones now on screen. */
    expect(shouldRefetch(loaded({ truncated: true }), inside)).toBe(true);
  });

  it("treats an exactly matching rectangle as covered", () => {
    const same = loaded();
    expect(shouldRefetch(same, { ...same })).toBe(false);
  });
});

describe("the copy that ships to the browser", () => {
  it("is the same pair of functions the tests just exercised", () => {
    /* The band check lives in coversView and the truncation check in
       shouldRefetch, so each is asserted where it actually is. */
    expect(coversViewSource()).toContain("loaded.band !== next.band");
    expect(shouldRefetchSource()).toContain("loaded.truncated");
    expect(shouldRefetchSource()).toContain("coversView(loaded, next)");
  });

  it("works with nothing in scope but the pair of them", () => {
    /* shouldRefetch calls coversView, so the page has to carry both under
       their own names. Emitted under a different name, that call points at
       nothing and every pan throws — which is exactly what happened when this
       was first split in two.
       
       Running them with no module scope at all is the cheapest way to catch
       either one reaching for something the browser will not have. */
    const isolated = new Function(
      `${coversViewSource()}; return (${shouldRefetchSource()})`,
    )() as typeof shouldRefetch;
    expect(isolated(null, inside)).toBe(true);
    expect(isolated(loaded(), inside)).toBe(false);
    expect(isolated(loaded(), { ...inside, band: "other" })).toBe(true);
    expect(isolated(loaded({ truncated: true }), inside)).toBe(true);
  });
});


describe("covering a view and needing a new one are different questions", () => {
  it("says a truncated answer still covers the ground it describes", () => {
    /* It is incomplete, not wrong. Treating the two as one threw away every
       cut-short answer on arrival, and the map drew nothing over anywhere
       busy enough to hit the cap. */
    expect(coversView(loaded({ truncated: true }), inside)).toBe(true);
  });

  it("but still asks again, because something was left out", () => {
    expect(shouldRefetch(loaded({ truncated: true }), inside)).toBe(true);
  });

  it("agrees with shouldRefetch when nothing was cut", () => {
    for (const view of [inside, { ...inside, band: "other" }, { ...inside, maxLat: 99 }]) {
      expect(shouldRefetch(loaded(), view)).toBe(!coversView(loaded(), view));
    }
  });

  it("covers nothing when there is nothing loaded", () => {
    expect(coversView(null, inside)).toBe(false);
  });
});
