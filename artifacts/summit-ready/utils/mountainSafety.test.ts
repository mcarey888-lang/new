import { describe, expect, it } from "vitest";
import { mountainHazardNotes } from "./mountainSafety";
import type { CanonicalRouteRecord } from "./routeIntelligence";
describe("evidence-backed mountain safety notes", () => {
  it("does not display plain AI hazards or empty facts as evidence", () => {
    expect(mountainHazardNotes(null)).toEqual([]);
    expect(mountainHazardNotes({ facts: { terrain: "Severe cliffs" } } as unknown as CanonicalRouteRecord)).toEqual([]);
  });
  it("retains route scope, source and retrieval date without inventing severity or verification", () => {
    const record = { route: { canonicalName: "North Ridge" }, facts: {
      technicalCharacter: { value: "Exposed scrambling", source: {
        provider: "Route operator", sourceUrl: "https://example.com/route",
        retrievedAt: "2026-10-03T10:00:00Z", qaFlags: ["review_required"],
      } },
    } } as unknown as CanonicalRouteRecord;
    expect(mountainHazardNotes(record)).toEqual([{
      label: "Exposed scrambling", routeName: "North Ridge", sourceName: "Route operator",
      sourceUrl: "https://example.com/route", retrievedAt: "2026-10-03T10:00:00Z", confidence: "Needs review",
    }]);
  });
});