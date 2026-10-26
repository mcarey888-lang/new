import { describe, expect, it } from "vitest";
import { analyseRoute, boundsOf, extractSummit, parseCoordinates, type LonLat } from "./route-review-map";

const out: LonLat[] = [[-4, 53], [-4.002, 53.002], [-4.004, 53.004], [-4.006, 53.006]];
const outBack = [...out, ...out.slice(0, -1).reverse()];

describe("route review map helpers", () => {
  it("rejects invalid geometry", () => {
    expect(parseCoordinates([[0, 0]]).ok).toBe(false);
    expect(parseCoordinates([[0, 0], [200, 0]]).ok).toBe(false);
    expect(parseCoordinates([[0, 0], [NaN, 1]]).ok).toBe(false);
    expect(parseCoordinates("x").ok).toBe(false);
    expect(parseCoordinates([[0, 0], [1, 1, 5]]).ok).toBe(false);
  });
  it("proves an exact out-and-back and ties summit by proximity", () => {
    const a = analyseRoute(outBack, { lat: 53.006, lon: -4.006 });
    expect(a.startFinishCombined && a.outAndBack).toBe(true);
    expect(a.turnaround).toEqual([-4.006, 53.006]);
    expect(a.turnaroundIsSummit).toBe(true);
    expect(analyseRoute(outBack, { lat: 54, lon: -4 }).turnaroundIsSummit).toBe(false);
    expect(analyseRoute(outBack, null).summitReference).toBeNull();
  });
  it("does not call a generic loop an out-and-back", () => {
    const loop: LonLat[] = [[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]];
    const a = analyseRoute(loop, { lat: 0.005, lon: 0.005 });
    expect(a.startFinishCombined).toBe(true);
    expect(a.outAndBack).toBe(false);
    expect(a.turnaround).toBeNull();
    expect(a.turnaroundIsSummit).toBe(false);
  });
  it("keeps separate endpoints separate", () => {
    const a = analyseRoute(out, null);
    expect(a.startFinishCombined).toBe(false);
    expect(a.outAndBack).toBe(false);
    expect(analyseRoute([[0, 0], [0.001, 0], [0, 0.0001]], null).startFinishCombined).toBe(false);
  });
  it("uses the true turnaround on a curving out-and-back, not the farthest point", () => {
    const curved: LonLat[] = [[0, 0], [0.01, 0], [0.003, 0.002], [0.01, 0], [0, 0]];
    expect(analyseRoute(curved, null).turnaround).toEqual([0.003, 0.002]);
  });
  it("does not merge nearby alternative return paths or call a distant peak the summit", () => {
    const alternate: LonLat[] = [[0, 0], [0.01, 0], [0.02, 0], [0.01, 0.0001], [0, 0]];
    expect(analyseRoute(alternate, null).outAndBack).toBe(false);
    expect(analyseRoute(outBack, { lat: 53.007, lon: -4.006 }).turnaroundIsSummit).toBe(false);
  });
  it("handles dateline bounds", () => {
    const b = boundsOf([[179.9, 0], [-179.9, 0.1]]);
    expect(b.crossesDateline).toBe(true);
    expect(b.east - b.west).toBeCloseTo(0.2);
  });
  it("extracts summit coordinates", () => {
    expect(extractSummit({ latitude: 1, longitude: 2 })).toEqual({ lat: 1, lon: 2 });
    expect(extractSummit({ coordinates: [2, 1] })).toEqual({ lat: 1, lon: 2 });
    expect(extractSummit({ name: "x" })).toBeNull();
  });
});
