import { describe, expect, it } from "vitest";
import { expeditionTotals, previewExpeditions, type CatalogueMountain } from "../services/expeditionAuthoring";

const input = {
  challengeId: "TEST-NEW", challengeName: "New expedition", targetMountainName: "Matterhorn",
  stages: [{ routeName: "Blencathra via Sharp Edge", distanceKm: 12, ascentM: 850, estimatedHours: 6 },
    { routeName: "Helvellyn via Striding Edge", distanceKm: 13, ascentM: 950, estimatedHours: 6 }],
};
const preview = (expeditions: unknown[], existing = new Set<string>(), editingId?: string) =>
  previewExpeditions({ expeditions }, existing, new Map<string, CatalogueMountain>(), editingId);

describe("expedition authoring validation", () => {
  it("derives stage totals rather than accepting invented top-level totals", () => {
    expect(expeditionTotals(input.stages)).toEqual({ totalDistanceKm: 25, totalAscentM: 1800, estimatedHours: 12 });
    expect(preview([{ ...input, totalDistanceKm: 50 }]).valid).toBe(false);
  });
  it("validates a draft and warns that unlinked owner route facts are not verified", () => {
    const result = preview([input]);
    expect(result.valid).toBe(true);
    expect(result.entries[0].expedition?.status).toBe("draft");
    expect(result.entries[0].warnings.join(" ")).toContain("not verified");
    expect(result.entries[0].warnings.join(" ")).toContain("no catalogue mountain selected");
  });
  it("rejects duplicate IDs within a batch and existing IDs", () => {
    expect(preview([input, input]).valid).toBe(false);
    expect(preview([input], new Set([input.challengeId])).valid).toBe(false);
  });
  it("rejects malformed numbers, zero walking distance, excessive stage counts and unknown fields", () => {
    for (const stage of [{ ...input.stages[0], distanceKm: "12" }, { ...input.stages[0], distanceKm: 0 },
      { ...input.stages[0], ascentM: -2 }, { ...input.stages[0], verified: true }]) {
      expect(preview([{ ...input, stages: [stage] }]).valid).toBe(false);
    }
    expect(preview([{ ...input, stages: Array.from({ length: 31 }, () => input.stages[0]) }]).valid).toBe(false);
    expect(preview(Array.from({ length: 101 }, () => input)).valid).toBe(false);
  });
  it("does not trust a supplied mountain UUID or duplicate route keys", () => {
    expect(preview([{ ...input, stages: [{ ...input.stages[0],
      mountainId: "0a3d3334-cb82-4659-a8bc-9f8658557731" }] }]).valid).toBe(false);
    expect(preview([{ ...input, stages: input.stages.map(s => ({ ...s, routeKey: "same" })) }]).valid).toBe(false);
  });
  it("requires explicit review before activation and preserves the existing ID", () => {
    const existing = new Set([input.challengeId]);
    expect(preview([{ ...input, status: "active" }], existing, input.challengeId).valid).toBe(false);
    expect(preview([{ ...input, status: "active", reviewed: true }], existing, input.challengeId).valid).toBe(true);
    expect(preview([{ ...input, challengeId: "CHANGED" }], existing, input.challengeId).valid).toBe(false);
  });
  it("warns that an import requesting active status will still be a draft", () => {
    const result = preview([{ ...input, status: "active", reviewed: true }]);
    expect(result.valid).toBe(true);
    expect(result.entries[0].warnings.join(" ")).toContain("Imported as a draft");
  });
  it("accepts only catalogue bindings that the server resolved", () => {
    const id = "0a3d3334-cb82-4659-a8bc-9f8658557731";
    const result = previewExpeditions({ expeditions: [{ ...input,
      stages: [{ ...input.stages[0], mountainId: id }] }] }, new Set(),
    new Map([[id, { id, name: "Helvellyn", latitude: 54.527, longitude: -3.0175,
      region: "Lake District", country: "England", elevationM: 949.8, status: "imported" }]]));
    expect(result.valid).toBe(true);
  });
});
