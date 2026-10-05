import { describe, expect, it } from "vitest";
import { shouldRefetch, shouldRefetchSource, type LoadedView } from "../services/summits/summitViewport";

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
  it("is the same function the tests just exercised", () => {
    const src = shouldRefetchSource();
    expect(src).toContain("loaded.band !== next.band");
    expect(src).toContain("loaded.truncated");
  });

  it("closes over nothing, so serialising it is safe", () => {
    /* The moment this function reaches for an import or a module constant,
       the browser copy silently breaks while the tests carry on passing. The
       cheapest guard is to run it with no module scope at all. */
    const isolated = new Function(`return (${shouldRefetchSource()})`)() as typeof shouldRefetch;
    expect(isolated(null, inside)).toBe(true);
    expect(isolated(loaded(), inside)).toBe(false);
    expect(isolated(loaded(), { ...inside, band: "other" })).toBe(true);
    expect(isolated(loaded({ truncated: true }), inside)).toBe(true);
  });
});
