import { describe, expect, it } from "vitest";
import {
  ALL_SUMMITS_ZOOM, HEADLINE_CLASSES, HEADLINE_PROMINENCE_M, HUMP_PROMINENCE_M,
  MARILYN_PROMINENCE_M, MIN_PIN_ZOOM,
  ascentDisplay, ascentLabel, baseClassCode, classificationLabel, filterForZoom, padBBox,
  parseBBox, pinCap, placeLabel, splitName, toPin, type MountainRow,
} from "../services/summits/summitPins";

/** Ben Nevis, exactly as the catalogue holds it. */
const benNevis = (over: Partial<MountainRow> = {}): MountainRow => ({
  id: "c72f54a6-7022-4569-8573-0cb476b24a50",
  name: "Ben Nevis [Beinn Nibheis]",
  latitude: 56.796891, longitude: -5.003675,
  elevationM: 1344.53, prominenceM: 1344.5,
  country: "Scotland",
  region: "04A: Fort William to Loch Treig & Loch Leven",
  county: "Highland",
  classificationCodes: ["CoA", "CoH", "CoU", "HHB", "M", "Ma", "SIB", "Sim"],
  ...over,
});

describe("which summits a zoom draws", () => {
  it("draws nothing on a globe", () => {
    for (const z of [0, 3, 5, MIN_PIN_ZOOM - 1]) expect(filterForZoom(z).kind).toBe("none");
  });

  it("shows the named lists when a whole country is on screen", () => {
    // About 720 hills between Munros, Corbetts and Wainwrights — few enough to
    // read, and what somebody zoomed this far out is actually looking for.
    const f = filterForZoom(MIN_PIN_ZOOM);
    expect(f).toEqual({
      kind: "headline", codes: HEADLINE_CLASSES, minProminenceM: HEADLINE_PROMINENCE_M,
    });
  });

  it("does not leave Wales, Ireland and the Peak District blank", () => {
    /* Munros and Corbetts are Scottish; Wainwrights are Lake District. On
       lists alone the widest zoom shows nothing at all over Snowdonia, and a
       map of Britain without Yr Wyddfa on it is indefensible. Prominence is
       the second way in, and it works everywhere. */
    const f = filterForZoom(MIN_PIN_ZOOM);
    expect(f.kind).toBe("headline");
    if (f.kind !== "headline") throw new Error("expected headline");
    expect(f.minProminenceM).toBeGreaterThan(0);
    /* Yr Wyddfa 1038 m, Scafell Pike 912 m, Carrauntoohil 1038 m. The bar has
       to sit below all of them. */
    expect(f.minProminenceM).toBeLessThan(900);
  });

  it("opens up to Marilyns, then HuMPs, as you come in", () => {
    expect(filterForZoom(9)).toEqual({ kind: "prominence", minProminenceM: MARILYN_PROMINENCE_M });
    expect(filterForZoom(10)).toEqual({ kind: "prominence", minProminenceM: HUMP_PROMINENCE_M });
  });

  it("draws everything once you are close in", () => {
    expect(filterForZoom(ALL_SUMMITS_ZOOM).kind).toBe("all");
    expect(filterForZoom(18).kind).toBe("all");
  });

  it("never gets stricter as you zoom in", () => {
    // A hill that appears at one zoom must not vanish at the next. Nothing is
    // more maddening on a map.
    const strictness = (z: number): number => {
      const f = filterForZoom(z);
      if (f.kind === "none") return 4;
      if (f.kind === "headline") return 3;
      if (f.kind === "prominence") return 1 + f.minProminenceM / 10000;
      return 0;
    };
    for (let z = MIN_PIN_ZOOM; z < 18; z += 1) {
      expect(strictness(z + 1), `got stricter from ${z} to ${z + 1}`).toBeLessThanOrEqual(strictness(z));
    }
  });

  it("uses prominence rather than height to thin them", () => {
    // Height says a 900 m shoulder matters more than a 600 m isolated hill.
    // Prominence says the opposite, and prominence is right.
    for (let z = 9; z < ALL_SUMMITS_ZOOM; z += 1) {
      expect(filterForZoom(z).kind).toBe("prominence");
    }
  });

  it("survives nonsense without drawing the whole catalogue", () => {
    for (const z of [Number.NaN, Number.POSITIVE_INFINITY, -4]) {
      expect(filterForZoom(z).kind).toBe("none");
      expect(pinCap(z)).toBe(0);
    }
  });
});

describe("the cap on how many come back", () => {
  it("is always a real limit", () => {
    for (let z = MIN_PIN_ZOOM; z <= 18; z += 1) {
      expect(pinCap(z)).toBeGreaterThan(0);
      expect(pinCap(z)).toBeLessThanOrEqual(1500);
    }
  });

  it("is tightest zoomed out, where a rectangle covers Britain", () => {
    expect(pinCap(MIN_PIN_ZOOM)).toBeLessThan(pinCap(14));
  });
});

describe("classifications", () => {
  it("picks the one a walker recognises from the eight Ben Nevis carries", () => {
    expect(classificationLabel(benNevis().classificationCodes!)).toBe("Munro");
  });

  it("reads a tied top as its classification", () => {
    // "Ma=" is a tied Marilyn. Dropped as unknown, a hill loses its only badge.
    expect(classificationLabel(["Ma="])).toBe("Marilyn");
    expect(baseClassCode("Hu=")).toBe("Hu");
    expect(baseClassCode("M")).toBe("M");
  });

  it("prefers the better-known list when a hill is on several", () => {
    expect(classificationLabel(["Ma", "Hu", "W"])).toBe("Wainwright");
    expect(classificationLabel(["Ma", "Hu"])).toBe("Marilyn");
    expect(classificationLabel(["Hu"])).toBe("HuMP");
  });

  it("says nothing rather than Unclassified", () => {
    expect(classificationLabel([])).toBeNull();
    expect(classificationLabel(["Sim", "CoU"])).toBeNull();
  });

  it("names the lesser lists properly", () => {
    expect(classificationLabel(["WO"])).toBe("Wainwright Outlying Fell");
    expect(classificationLabel(["MT"])).toBe("Munro Top");
    expect(classificationLabel(["D"])).toBe("Donald");
    expect(classificationLabel(["C"])).toBe("Corbett");
  });
});

describe("names", () => {
  it("lifts the Gaelic name out of the brackets", () => {
    expect(splitName("Ben Nevis [Beinn Nibheis]"))
      .toEqual({ name: "Ben Nevis", alternative: "Beinn Nibheis" });
  });

  it("leaves a plain name alone", () => {
    expect(splitName("Scafell Pike")).toEqual({ name: "Scafell Pike", alternative: null });
  });

  it("copes with a name that is only the bracketed form", () => {
    expect(splitName("[Yr Wyddfa]")).toEqual({ name: "Yr Wyddfa", alternative: null });
  });

  it("trims the whitespace the catalogue leaves behind", () => {
    expect(splitName("  Tryfan  ")).toEqual({ name: "Tryfan", alternative: null });
  });
});

describe("ascent", () => {
  it("says nothing when there is no route figure", () => {
    // The usual case: 23 route facts against 21,792 mountains.
    expect(ascentDisplay(null)).toEqual({ kind: "unknown" });
    expect(ascentDisplay(undefined)).toEqual({ kind: "unknown" });
    expect(ascentLabel({ kind: "unknown" })).toBeNull();
  });

  it("names the route when it has one", () => {
    const a = ascentDisplay(1352, "Pony Track");
    expect(a).toEqual({ kind: "known", metres: 1352, routeName: "Pony Track" });
    expect(ascentLabel(a)).toBe("1352 m of climbing via Pony Track");
  });

  it("still says the figure without a route name", () => {
    expect(ascentLabel(ascentDisplay(820))).toBe("820 m of climbing");
  });

  it("treats zero and nonsense as not known", () => {
    for (const bad of [0, -5, Number.NaN]) expect(ascentDisplay(bad).kind).toBe("unknown");
  });

  it("never passes prominence off as ascent", () => {
    // Ben Nevis has 1,344 m of prominence and no walk up it climbs that,
    // because nobody starts in the col. A pin built from prominence would be
    // confidently wrong on every hill in the country.
    const pin = toPin(benNevis())!;
    expect(pin.ascent).toEqual({ kind: "unknown" });
    expect(pin.prominenceM).toBe(1345);
  });
});

describe("where it is", () => {
  it("prefers the county to a catalogue region code", () => {
    // "04A: Fort William to Loch Treig & Loch Leven" is precise and is not how
    // anybody says where they walked.
    expect(placeLabel(benNevis())).toBe("Highland, Scotland");
  });

  it("falls back to a region that reads like a place", () => {
    expect(placeLabel({ county: null, region: "Snowdonia", country: "Wales" }))
      .toBe("Snowdonia, Wales");
  });

  it("drops a region that is a catalogue code", () => {
    expect(placeLabel({ county: null, region: "17B: Something", country: "Wales" })).toBe("Wales");
  });

  it("copes with only one part", () => {
    expect(placeLabel({ county: null, region: null, country: "Scotland" })).toBe("Scotland");
    expect(placeLabel({ county: "Cumbria", region: null, country: null })).toBe("Cumbria");
  });

  it("says nothing rather than a stray comma", () => {
    expect(placeLabel({ county: null, region: null, country: null })).toBeNull();
    expect(placeLabel({ county: "  ", region: "", country: null })).toBeNull();
  });

  it("does not repeat itself", () => {
    expect(placeLabel({ county: "Wales", region: null, country: "Wales" })).toBe("Wales");
  });
});

describe("turning a catalogue row into a pin", () => {
  it("carries everything the card needs", () => {
    const pin = toPin(benNevis())!;
    expect(pin.id).toBe("c72f54a6-7022-4569-8573-0cb476b24a50");
    expect(pin.name).toBe("Ben Nevis");
    expect(pin.alternativeName).toBe("Beinn Nibheis");
    expect(pin.heightM).toBe(1345);
    expect(pin.classification).toBe("Munro");
    expect(pin.place).toBe("Highland, Scotland");
  });

  it("keeps the catalogue id, so a pin can open the mountain page", () => {
    // The page takes this as catalogueId. No join to canonical_hills, which
    // holds no rows anyway.
    expect(toPin(benNevis())!.id).toBe(benNevis().id);
  });

  it("drops a summit with no point rather than inventing one", () => {
    expect(toPin(benNevis({ latitude: null }))).toBeNull();
    expect(toPin(benNevis({ longitude: Number.NaN }))).toBeNull();
    expect(toPin(benNevis({ latitude: 91 }))).toBeNull();
  });

  it("drops a row with nothing to label it", () => {
    expect(toPin(benNevis({ name: "   " }))).toBeNull();
    expect(toPin(benNevis({ id: "" }))).toBeNull();
  });

  it("keeps a real zero prominence apart from a missing one", () => {
    // A col height of 0 appears in this data. Zero is a measurement; null is
    // not knowing, and rounding one into the other loses that.
    expect(toPin(benNevis({ prominenceM: 0 }))!.prominenceM).toBe(0);
    expect(toPin(benNevis({ prominenceM: null }))!.prominenceM).toBeNull();
  });

  it("leaves the height null rather than zero when it is missing", () => {
    expect(toPin(benNevis({ elevationM: null }))!.heightM).toBeNull();
  });

  it("works for a hill on no list at all", () => {
    const pin = toPin(benNevis({ classificationCodes: [] }))!;
    expect(pin.classification).toBeNull();
    expect(pin.name).toBe("Ben Nevis");
  });
});

describe("the rectangle", () => {
  it("reads the order every mapping tool writes", () => {
    expect(parseBBox("-4.3,53.0,-3.9,53.2"))
      .toEqual({ minLng: -4.3, minLat: 53.0, maxLng: -3.9, maxLat: 53.2 });
  });

  it("refuses one inside out, or with no area", () => {
    expect(parseBBox("-3.9,53.0,-4.3,53.2")).toBeNull();
    expect(parseBBox("-4.3,53.2,-3.9,53.0")).toBeNull();
    expect(parseBBox("-4.0,53.0,-4.0,53.2")).toBeNull();
  });

  it("refuses coordinates off the planet, and junk", () => {
    expect(parseBBox("-4.3,-91,-3.9,53.2")).toBeNull();
    expect(parseBBox("-181,53.0,-3.9,53.2")).toBeNull();
    expect(parseBBox("not,a,box,at all")).toBeNull();
    expect(parseBBox("-4.3,53.0,-3.9")).toBeNull();
    expect(parseBBox(undefined)).toBeNull();
    expect(parseBBox(42)).toBeNull();
  });

  it("grows the margin so a short pan finds pins already there", () => {
    const grown = padBBox({ minLat: 53.0, maxLat: 53.2, minLng: -4.3, maxLng: -3.9 }, 0.05);
    expect(grown.minLat).toBeCloseTo(52.95, 5);
    expect(grown.maxLat).toBeCloseTo(53.25, 5);
    expect(grown.minLng).toBeLessThan(-4.3);
  });

  it("widens longitude more the further north you go", () => {
    const cornwall = padBBox({ minLat: 50.0, maxLat: 50.1, minLng: -5, maxLng: -4.9 }, 0.05);
    const capeWrath = padBBox({ minLat: 58.5, maxLat: 58.6, minLng: -5, maxLng: -4.9 }, 0.05);
    expect(capeWrath.minLng).toBeLessThan(cornwall.minLng);
  });

  it("does not wander off the edge of the world", () => {
    const grown = padBBox({ minLat: -89.99, maxLat: 89.99, minLng: -179.9, maxLng: 179.9 }, 1);
    expect(grown.minLat).toBeGreaterThanOrEqual(-90);
    expect(grown.maxLat).toBeLessThanOrEqual(90);
    expect(grown.minLng).toBeGreaterThanOrEqual(-180);
    expect(grown.maxLng).toBeLessThanOrEqual(180);
  });
});
