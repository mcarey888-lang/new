import { describe, expect, it } from "vitest";
import {
  ALL_SUMMITS_ZOOM, MIN_PIN_ZOOM, gainDisplay, gainLabel, heightFloorForZoom,
  padBBox, parseBBox, pinCap, placeLabel, toPin, type SummitRow,
} from "../services/summits/summitPins";

const row = (over: Partial<SummitRow> = {}): SummitRow => ({
  slug: "yr-wyddfa", name: "Yr Wyddfa", country: "Wales", region: "Snowdonia",
  latitude: 53.0685, longitude: -4.076, summitElevationM: 1085,
  estimatedGainM: 723, verifiedGainM: null, verifiedSampleCount: 0, ...over,
});

describe("which summits a zoom shows", () => {
  it("draws nothing on a globe", () => {
    for (const z of [0, 3, 5, MIN_PIN_ZOOM - 1]) expect(heightFloorForZoom(z)).toBeNull();
  });

  it("draws everything once you are close in", () => {
    expect(heightFloorForZoom(ALL_SUMMITS_ZOOM)).toBe(0);
    expect(heightFloorForZoom(17)).toBe(0);
  });

  it("asks for more height the further out you go", () => {
    // Monotonic. A hill that appears at one zoom must not vanish as you zoom in.
    let previous = Number.POSITIVE_INFINITY;
    for (let z = MIN_PIN_ZOOM; z <= ALL_SUMMITS_ZOOM; z += 1) {
      const floor = heightFloorForZoom(z);
      expect(floor, `no floor at zoom ${z}`).not.toBeNull();
      expect(floor!, `floor rose when zooming in at ${z}`).toBeLessThanOrEqual(previous);
      previous = floor!;
    }
  });

  it("keeps Yr Wyddfa visible at every zoom that shows anything", () => {
    for (let z = MIN_PIN_ZOOM; z <= 17; z += 1) {
      expect(heightFloorForZoom(z)!).toBeLessThanOrEqual(1085);
    }
  });

  it("survives nonsense without drawing the whole country", () => {
    for (const z of [Number.NaN, Number.POSITIVE_INFINITY, -4]) {
      expect(heightFloorForZoom(z)).toBeNull();
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

  it("is tightest zoomed out, where a careless rectangle covers everything", () => {
    expect(pinCap(MIN_PIN_ZOOM)).toBeLessThan(pinCap(14));
  });
});

describe("what a pin may claim about ascent", () => {
  it("calls a measured figure measured, and counts the climbs", () => {
    const g = gainDisplay({ verifiedGainM: 820, verifiedSampleCount: 14, estimatedGainM: 700 });
    expect(g).toEqual({ kind: "verified", metres: 820, sampleCount: 14 });
    expect(gainLabel(g)).toBe("820 m ascent, from 14 recorded climbs");
  });

  it("does not say climbs when there was one", () => {
    expect(gainLabel({ kind: "verified", metres: 500, sampleCount: 1 }))
      .toBe("500 m ascent, from 1 recorded climb");
  });

  it("prefers the measured figure over the estimate", () => {
    const g = gainDisplay({ verifiedGainM: 820, verifiedSampleCount: 3, estimatedGainM: 700 });
    expect(g.kind).toBe("verified");
  });

  it("says an estimate is an estimate", () => {
    const g = gainDisplay({ verifiedGainM: null, verifiedSampleCount: 0, estimatedGainM: 723 });
    expect(g).toEqual({ kind: "estimated", metres: 723 });
    expect(gainLabel(g)).toContain("estimated");
  });

  it("will not call a figure verified with no climbs behind it", () => {
    // A verified column with a zero sample count is a half-written record,
    // not a measurement.
    const g = gainDisplay({ verifiedGainM: 820, verifiedSampleCount: 0, estimatedGainM: 700 });
    expect(g).toEqual({ kind: "estimated", metres: 700 });
  });

  it("treats a missing figure as unknown, never as zero", () => {
    // The whole point. A summit shown as 0 m ascent reads as a flat walk, and
    // somebody could plan a day on it.
    const g = gainDisplay({ verifiedGainM: null, verifiedSampleCount: 0, estimatedGainM: null });
    expect(g).toEqual({ kind: "unknown" });
    expect(gainLabel(g)).toBeNull();
  });

  it("treats zero and negative as missing too", () => {
    for (const bad of [0, -1, -200]) {
      expect(gainDisplay({ verifiedGainM: bad, verifiedSampleCount: 9, estimatedGainM: null }).kind)
        .toBe("unknown");
      expect(gainDisplay({ verifiedGainM: null, verifiedSampleCount: 0, estimatedGainM: bad }).kind)
        .toBe("unknown");
    }
  });

  it("ignores a figure that is not a number", () => {
    expect(gainDisplay({ verifiedGainM: Number.NaN, verifiedSampleCount: 5, estimatedGainM: null }).kind)
      .toBe("unknown");
  });

  it("never prints a decimal at somebody", () => {
    expect(gainLabel(gainDisplay({ verifiedGainM: 820.4, verifiedSampleCount: 2, estimatedGainM: null })))
      .toBe("820 m ascent, from 2 recorded climbs");
  });
});

describe("where it is", () => {
  it("reads region then country", () => {
    expect(placeLabel({ region: "Snowdonia", country: "Wales" })).toBe("Snowdonia, Wales");
  });

  it("copes with only one of them", () => {
    expect(placeLabel({ region: null, country: "Scotland" })).toBe("Scotland");
    expect(placeLabel({ region: "Lake District", country: null })).toBe("Lake District");
  });

  it("says nothing rather than an empty comma", () => {
    expect(placeLabel({ region: null, country: null })).toBeNull();
    expect(placeLabel({ region: "  ", country: "" })).toBeNull();
  });

  it("does not repeat itself", () => {
    expect(placeLabel({ region: "Isle of Skye, Scotland", country: "Scotland" }))
      .toBe("Isle of Skye, Scotland");
    expect(placeLabel({ region: "Wales", country: "Wales" })).toBe("Wales");
  });
});

describe("turning a row into a pin", () => {
  it("carries name, height, place and ascent", () => {
    const pin = toPin(row({ verifiedGainM: 948, verifiedSampleCount: 31 }))!;
    expect(pin.name).toBe("Yr Wyddfa");
    expect(pin.heightM).toBe(1085);
    expect(pin.place).toBe("Snowdonia, Wales");
    expect(pin.gain).toEqual({ kind: "verified", metres: 948, sampleCount: 31 });
  });

  it("drops a summit with no coordinates rather than inventing some", () => {
    // Placed at a default, it lands in the Atlantic off Africa and somebody
    // sees a Welsh mountain at sea.
    expect(toPin(row({ latitude: null }))).toBeNull();
    expect(toPin(row({ longitude: null }))).toBeNull();
    expect(toPin(row({ latitude: Number.NaN }))).toBeNull();
  });

  it("drops coordinates that are not on Earth", () => {
    expect(toPin(row({ latitude: 91 }))).toBeNull();
    expect(toPin(row({ longitude: -181 }))).toBeNull();
  });

  it("drops a row with no name to show", () => {
    expect(toPin(row({ name: "" }))).toBeNull();
    expect(toPin(row({ slug: "" }))).toBeNull();
  });

  it("leaves the height null when there is not one, never zero", () => {
    expect(toPin(row({ summitElevationM: null }))!.heightM).toBeNull();
    expect(toPin(row({ summitElevationM: 0 }))!.heightM).toBeNull();
  });
});

describe("the rectangle", () => {
  it("reads the order every mapping tool writes", () => {
    expect(parseBBox("-4.3,53.0,-3.9,53.2"))
      .toEqual({ minLng: -4.3, minLat: 53.0, maxLng: -3.9, maxLat: 53.2 });
  });

  it("refuses one that is inside out", () => {
    expect(parseBBox("-3.9,53.0,-4.3,53.2")).toBeNull();
    expect(parseBBox("-4.3,53.2,-3.9,53.0")).toBeNull();
  });

  it("refuses one with no area", () => {
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

  it("grows the margin, so a short pan finds pins already there", () => {
    const grown = padBBox({ minLat: 53.0, maxLat: 53.2, minLng: -4.3, maxLng: -3.9 }, 0.05);
    expect(grown.minLat).toBeCloseTo(52.95, 5);
    expect(grown.maxLat).toBeCloseTo(53.25, 5);
    expect(grown.minLng).toBeLessThan(-4.3);
    expect(grown.maxLng).toBeGreaterThan(-3.9);
  });

  it("widens longitude more the further north you go", () => {
    // A degree of longitude is about 67 km in Cornwall and 48 km at Cape
    // Wrath, so the same margin in metres is more degrees up there.
    const south = padBBox({ minLat: 50.0, maxLat: 50.1, minLng: -5, maxLng: -4.9 }, 0.05);
    const north = padBBox({ minLat: 58.5, maxLat: 58.6, minLng: -5, maxLng: -4.9 }, 0.05);
    expect(north.minLng).toBeLessThan(south.minLng);
  });

  it("does not wander off the edge of the world", () => {
    const grown = padBBox({ minLat: -89.99, maxLat: 89.99, minLng: -179.9, maxLng: 179.9 }, 1);
    expect(grown.minLat).toBeGreaterThanOrEqual(-90);
    expect(grown.maxLat).toBeLessThanOrEqual(90);
    expect(grown.minLng).toBeGreaterThanOrEqual(-180);
    expect(grown.maxLng).toBeLessThanOrEqual(180);
  });
});
