import { describe, expect, it } from "vitest";
import {
  parkingResearchKey, parseParkingResearch, parkingResearchSources, publicSourceUrl,
} from "../services/parkingSuggestionRules.js";

const option = {
  name: "Example car park", description: "Check restrictions on arrival.",
  sourceName: "Park authority", sourceUrl: "https://example.org/parking",
  directionsQuery: "Example car park, Eryri, Wales",
};
describe("shared parking research", () => {
  it("separates identically named mountains by region and coordinates", () => {
    const first = { mountainName: "The Beacon", region: "Wales", latitude: 52, longitude: -4 };
    expect(parkingResearchKey(first)).not.toBe(parkingResearchKey({ ...first, region: "England" }));
    expect(parkingResearchKey(first)).not.toBe(parkingResearchKey({ ...first, latitude: 53 }));
    expect(parkingResearchKey(first)).toBe(parkingResearchKey({ ...first, mountainName: "  THE BEACON " }));
  });
  it("does not accept an invented source URL", () => {
    expect(parseParkingResearch(JSON.stringify({ options: [option] }), ["https://example.org/another"])).toEqual([]);
  });
  it("accepts a sourced option, adds research time, and deduplicates names", () => {
    const result = parseParkingResearch(JSON.stringify({ options: [option, option] }), [option.sourceUrl], new Date("2026-10-07T12:00:00Z"));
    expect(result).toHaveLength(1);
    expect(result[0]?.lastChecked).toBe("2026-10-07T12:00:00.000Z");
    expect(result[0]).not.toHaveProperty("latitude");
  });
  it("rejects private URLs and guessed coordinate destinations", () => {
    expect(publicSourceUrl("http://example.org")).toBeNull();
    expect(publicSourceUrl("https://127.0.0.1/")).toBeNull();
    expect(publicSourceUrl("https://service.internal/")).toBeNull();
    expect(() => parseParkingResearch(JSON.stringify({ options: [{ ...option, directionsQuery: "53.1,-4.1" }] }), [option.sourceUrl])).toThrow();
  });
  it("extracts actual web search and citation sources", () => {
    expect(parkingResearchSources([
      { type: "web_search_call", action: { sources: [{ url: option.sourceUrl }] } },
      { type: "message", content: [{ annotations: [{ type: "url_citation", url: "https://example.org/other" }] }] },
    ])).toEqual([option.sourceUrl, "https://example.org/other"]);
  });
  it("does not offer generic roadside areas as a directions destination", () => {
    expect(parseParkingResearch(JSON.stringify({ options: [{ ...option, name: "Lay-bys along the A5" }] }), [option.sourceUrl])).toEqual([]);
    expect(parseParkingResearch(JSON.stringify({ options: [{ ...option, directionsQuery: "Car park at 53.1,-4.1" }] }), [option.sourceUrl])).toEqual([]);
  });
});
