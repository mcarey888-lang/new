import { describe, expect, it } from "vitest";
import {
  HILL_BANDS,
  bandFor,
  hillPlaceholderArt,
  nameSeed,
  placeholderLabel,
  ridgePath,
} from "./hillPlaceholder";

const highest = () => HILL_BANDS[HILL_BANDS.length - 1]!;

describe("bands come from the recorded elevation", () => {
  it("puts a hill in the band its height falls in", () => {
    expect(bandFor(120).name).toBe("low ground");
    expect(bandFor(420).name).toBe("moorland");
    expect(bandFor(724).name).toBe("fell");
    expect(bandFor(1_070).name).toBe("high ground");
  });

  it("takes the boundary itself as the start of the higher band", () => {
    for (const band of HILL_BANDS) {
      expect(bandFor(band.fromM).name).toBe(band.name);
    }
  });

  it("treats a missing height as missing, not as zero metres of nothing", () => {
    /* It lands in the lowest band because that is the quietest thing to draw,
       but nothing is invented and no figure is shown for it. */
    expect(bandFor(null).name).toBe(HILL_BANDS[0]!.name);
    expect(bandFor(undefined).name).toBe(HILL_BANDS[0]!.name);
    expect(bandFor(Number.NaN).name).toBe(HILL_BANDS[0]!.name);
  });

  it("gives only the top band a cap", () => {
    const capped = HILL_BANDS.filter(b => b.cap !== null);
    expect(capped).toHaveLength(1);
    expect(capped[0]!.name).toBe(highest().name);
  });
});

describe("the same hill always draws the same", () => {
  it("is stable across calls", () => {
    const a = hillPlaceholderArt("Mam na Gualainn", 797);
    const b = hillPlaceholderArt("Mam na Gualainn", 797);
    expect(a).toEqual(b);
  });

  it("ignores case and surrounding space, which a name can pick up", () => {
    expect(nameSeed("  Mam Mor ")).toBe(nameSeed("mam mor"));
  });

  it("draws neighbouring hills differently", () => {
    /* Two Scottish tops a few rows apart in a list must not be identical, or
       the list reads as one repeated tile. */
    const a = hillPlaceholderArt("Mam na Gualainn", 797);
    const b = hillPlaceholderArt("Mam na Gualainn East Top", 755);
    expect(a.ridge).not.toEqual(b.ridge);
  });
});

describe("height is the one thing the drawing states", () => {
  it("draws a higher hill with a higher skyline", () => {
    const top = (art: ReturnType<typeof hillPlaceholderArt>) =>
      Math.min(...art.ridge.map(p => p.y));
    const low = top(hillPlaceholderArt("Mam Mor", 217));
    const high = top(hillPlaceholderArt("Mam Coire Easain", 1_070));
    // y is measured downwards, so the higher hill has the smaller number.
    expect(high).toBeLessThan(low);
  });

  it("gives an unrecorded height the flattest skyline of all", () => {
    const top = (art: ReturnType<typeof hillPlaceholderArt>) =>
      Math.min(...art.ridge.map(p => p.y));
    const unknown = top(hillPlaceholderArt("Unnamed top", null));
    expect(unknown).toBeGreaterThan(top(hillPlaceholderArt("Unnamed top", 100)));
  });

  it("keeps a freakishly large height inside the box", () => {
    const art = hillPlaceholderArt("Everest typo", 88_848);
    for (const p of [...art.ridge, ...art.farRidge]) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("the shape stays a stylised stand-in", () => {
  it("draws few enough points that it cannot read as a real profile", () => {
    const art = hillPlaceholderArt("Mam Hael", 724);
    expect(art.ridge.length).toBeLessThanOrEqual(9);
    expect(art.farRidge.length).toBeLessThanOrEqual(7);
  });

  it("starts and ends on the floor of the box, so the ridge sits on ground", () => {
    const art = hillPlaceholderArt("Mam na Luirg", 530);
    expect(art.ridge[0]).toEqual({ x: 0, y: 1 });
    expect(art.ridge[art.ridge.length - 1]).toEqual({ x: 1, y: 1 });
  });

  it("keeps the far ridge behind the near one", () => {
    for (const [name, elev] of [["Mam Mor", 217], ["Mam Coire Easain", 1_070]] as const) {
      const art = hillPlaceholderArt(name, elev);
      const near = Math.min(...art.ridge.map(p => p.y));
      const far = Math.min(...art.farRidge.map(p => p.y));
      expect(far).toBeGreaterThan(near);
    }
  });
});

describe("ridgePath", () => {
  it("closes the shape along the bottom of the box", () => {
    const art = hillPlaceholderArt("Mam Mor", 217);
    const path = ridgePath(art.ridge, 220, 200);
    expect(path.startsWith("M0.0 200.0")).toBe(true);
    expect(path.endsWith("L220.0 200.0 L0.0 200.0 Z")).toBe(true);
  });

  it("returns an empty string rather than a broken path", () => {
    expect(ridgePath([], 220, 200)).toBe("");
  });
});

describe("placeholderLabel", () => {
  it("says it is an illustration, because nothing else on screen can", () => {
    const label = placeholderLabel("Mam Coire Easain", 1070);
    expect(label).toContain("Illustration");
    expect(label).toContain("Mam Coire Easain");
    expect(label).toContain("1,070");
  });

  it("quotes no height when none was recorded", () => {
    const label = placeholderLabel("Unnamed top", null);
    expect(label).toContain("Illustration");
    expect(label).not.toMatch(/\d/);
  });
});
