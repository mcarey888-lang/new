import { describe, expect, it } from "vitest";
import { parseNamedMappedPeaks } from "../services/namedMappedPeak";

const center = { lat: 53.70, lng: -2.30 };
const pendle = {
  osm_type: "node", osm_id: 29798197, category: "natural", type: "peak",
  name: "Pendle Hill", lat: "53.8685844", lon: "-2.2985841", extratags: { ele: "558" },
};

describe("source-backed named hill search", () => {
  it("finds the Lancashire peak with its actual OSM identity and summit height", () => {
    expect(parseNamedMappedPeaks([pendle], center, 50)).toEqual([{
      id: 29798197, name: "Pendle Hill", lat: 53.8685844, lng: -2.2985841, ele: 558, source: "osm_nominatim",
    }]);
  });
  it("rejects the Australian suburb and similarly named streets", () => {
    expect(parseNamedMappedPeaks([
      { ...pendle, osm_type: "relation", category: "boundary", type: "administrative", lat: "-33.79", lon: "150.95" },
      { ...pendle, category: "highway", type: "residential" },
    ], center, 50)).toEqual([]);
  });
  it("rejects same-named peaks outside the search radius", () => {
    expect(parseNamedMappedPeaks([{ ...pendle, lat: "55" }], center, 50)).toEqual([]);
  });
  it("rejects malformed coordinates and identities", () => {
    expect(parseNamedMappedPeaks([{ ...pendle, lat: "NaN" }, { ...pendle, osm_id: "invalid" }, null], center, 50)).toEqual([]);
  });
  it("leaves unavailable summit elevation unknown rather than inventing it", () => {
    expect(parseNamedMappedPeaks([{ ...pendle, extratags: {} }], center, 50)[0].ele).toBeNull();
  });
  it("distinguishes invalid provider responses from an empty successful search", () => {
    expect(() => parseNamedMappedPeaks({ error: "unavailable" }, center, 50)).toThrow("Invalid mapped peak response");
    expect(parseNamedMappedPeaks([], center, 50)).toEqual([]);
  });
});
