import { describe, expect, it } from "vitest";
import { optionalInt, validPoint, validateSave } from "../services/routing/plannedRouteRules";

const pt = (lat: number, lng: number) => ({ lat, lng });
const ok = {
  name: "North Ridge",
  anchors: [pt(53.1225, -3.997), pt(53.115, -3.9986)],
  geometry: [pt(53.1225, -3.997), pt(53.119, -3.9975), pt(53.115, -3.9986)],
  lengthM: 840,
};

describe("coordinates", () => {
  it("accepts a real position", () => {
    expect(validPoint(pt(53.1225, -3.997))).toBe(true);
    expect(validPoint(pt(0, 0))).toBe(true);
  });

  it("rejects anything off the globe or not a number", () => {
    expect(validPoint(pt(91, 0))).toBe(false);
    expect(validPoint(pt(0, 181))).toBe(false);
    expect(validPoint(pt(NaN, 0))).toBe(false);
    expect(validPoint({ lat: "53", lng: -4 })).toBe(false);
    expect(validPoint(null)).toBe(false);
    expect(validPoint({ latitude: 53, longitude: -4 })).toBe(false);
  });
});

describe("what gets saved", () => {
  it("accepts a real route", () => {
    expect(validateSave(ok)).toEqual({ ok: true, name: "North Ridge" });
  });

  it("insists on a name, and trims it", () => {
    expect(validateSave({ ...ok, name: "  Bristly Ridge  " }))
      .toEqual({ ok: true, name: "Bristly Ridge" });
    expect(validateSave({ ...ok, name: "   " }).ok).toBe(false);
    expect(validateSave({ ...ok, name: undefined }).ok).toBe(false);
  });

  it("refuses a route that is not a route", () => {
    expect(validateSave({ ...ok, anchors: [pt(53, -4)] }).ok).toBe(false);
    expect(validateSave({ ...ok, geometry: [] }).ok).toBe(false);
    expect(validateSave({ ...ok, anchors: "nope" }).ok).toBe(false);
  });

  it("checks every coordinate, not a sample", () => {
    /* One bad point stored is a route that draws itself across the Atlantic
       the next time it is opened. */
    const poisoned = { ...ok, geometry: [...ok.geometry, pt(999, 999)] };
    expect(validateSave(poisoned)).toEqual({ ok: false, reason: "bad coordinate" });
  });

  it("gives a reason specific enough to act on", () => {
    /* "too many points" and "bad coordinate" need different fixes from
       whoever is calling. One generic error makes both into guesswork. */
    expect(validateSave({ ...ok, name: "" }).ok).toBe(false);
    expect((validateSave({ ...ok, geometry: [pt(999, 0), pt(0, 0)] }) as { reason: string }).reason)
      .toBe("bad coordinate");
    expect((validateSave({ ...ok, lengthM: -5 }) as { reason: string }).reason).toBe("bad length");
    expect((validateSave({ ...ok, lengthM: "840" }) as { reason: string }).reason).toBe("bad length");
  });

  it("will not store something unbounded", () => {
    const many = Array.from({ length: 30000 }, () => pt(53, -4));
    expect((validateSave({ ...ok, geometry: many }) as { reason: string }).reason)
      .toBe("route too large");
    expect((validateSave({ ...ok, anchors: many }) as { reason: string }).reason)
      .toBe("too many points");
    expect(validateSave({ ...ok, name: "x".repeat(500) }).ok).toBe(false);
  });
});

describe("unknown is not zero", () => {
  /* The rule this table was shaped around. A route whose heights could not be
     read has unknown ascent. Storing that as 0 tells someone their mountain
     day is flat, which is a confident wrong answer rather than an honest
     absence. */

  it("keeps a real figure", () => {
    expect(optionalInt(519)).toBe(519);
    expect(optionalInt(0)).toBe(0);
    expect(optionalInt(518.6)).toBe(519);
  });

  it("gives null for anything that is not a number", () => {
    expect(optionalInt(undefined)).toBeNull();
    expect(optionalInt(null)).toBeNull();
    expect(optionalInt("519")).toBeNull();
    expect(optionalInt(NaN)).toBeNull();
    expect(optionalInt(Infinity)).toBeNull();
  });

  it("never turns a missing ascent into a flat route", () => {
    expect(optionalInt(undefined)).not.toBe(0);
  });
});
