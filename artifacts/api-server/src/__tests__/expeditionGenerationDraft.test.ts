import { describe, expect, it } from "vitest";
import { expeditionGenerationDraft } from "../services/expeditionGenerationDraft";
import { expeditionInput } from "../services/expeditionAuthoring";
import { GenerateAdminExpeditionResponse } from "@workspace/api-zod";

const mountainId = "cea28ba5-4a81-4762-add7-f36f85b8d071";
function result() {
  return {
    targetProfile: { name: "Mont Blanc", difficulty: "Hard" },
    expedition: {
      title: "Local alpine challenge", concept: "Walking preparation, not alpine certification.",
      days: [
        { routes: [{ name: "Fairfield", routeIdentityKey: "route:fairfield", why: "Sustained ridge walking." }] },
        { routes: [{ name: "Scafell Pike", routeIdentityKey: "route:scafell" }] },
      ],
    },
    recommendedHills: [
      { name: "Scafell Pike", routeName: "Corridor Route", routeIdentityKey: "route:scafell",
        summitIdentityKey: "osm:123", elevation: 1000, routeDistance: 15, grade: "Hard", repeats: 1,
        dataSource: "osm_overpass", routeDataStatus: "terrain_calculated" },
      { name: "Fairfield", routeName: "Fairfield Horseshoe", routeIdentityKey: "route:fairfield",
        summitIdentityKey: `sde:mountain:${mountainId}`, elevation: 1100, routeDistance: 18,
        grade: "Hard", repeats: 1, dataSource: "summit_data_engine", routeDataStatus: "verified" },
    ],
    provenance: { targetMountainSource: "verified", targetRouteSource: "reviewed_profile", warnings: ["Access needs review."] },
  };
}
describe("admin draft adapter", () => {
  it("keeps engine stage order and real full-route figures, creates a unique unsaved draft", () => {
    const { draft, warnings } = expeditionGenerationDraft(result());
    expect(draft).toMatchObject({ status: "draft", reviewed: false, updatedAt: "", recommendedDays: 2 });
    expect(draft.stages[0]).toMatchObject({ routeName: "Fairfield Horseshoe", distanceKm: 18, ascentM: 1100, mountainId });
    expect(draft.stages[0].catalogueMountain).toBeNull();
    expect(GenerateAdminExpeditionResponse.safeParse({ draft, warnings }).success).toBe(true);
    expect(draft.stages[1]).toMatchObject({ routeName: "Corridor Route", distanceKm: 15, ascentM: 1000 });
    expect(draft.stages[1]).not.toHaveProperty("mountainId");
    expect(warnings.join(" ")).toContain("estimates");
    expect(warnings).toContain("Access needs review.");
    expect(expeditionInput.safeParse({
      ...draft, updatedAt: undefined, stages: draft.stages.map(({ catalogueMountain, ...stage }) => stage),
    }).success).toBe(false); // Record-only fields must be removed by the editor before import.
    const { updatedAt, ...input } = draft;
    expect(expeditionInput.safeParse({
      ...input, stages: input.stages.map(({ catalogueMountain, ...stage }) => stage),
    }).success).toBe(true);
    expect(expeditionGenerationDraft(result()).draft.challengeId).not.toBe(draft.challengeId);
  });
  it("does not use summit altitude, location distance or zero to fill missing walking facts", () => {
    const raw = result();
    Object.assign(raw.recommendedHills[0], { routeDistance: undefined, elevation: undefined, distance: 22, summitElevationASL: 978 });
    const preview = expeditionGenerationDraft(raw);
    expect(preview.draft.stages[1]).toMatchObject({ distanceKm: null, ascentM: null });
    expect(preview.warnings.join(" ")).toContain("missing distance or ascent");
  });
  it("preserves single-route figures rather than silently multiplying by repeat counts", () => {
    const raw = result(); raw.recommendedHills[1].repeats = 3;
    const preview = expeditionGenerationDraft(raw);
    expect(preview.draft.stages[0]).toMatchObject({ distanceKm: 18, ascentM: 1100 });
    expect(preview.warnings.join(" ")).toContain("3 repeats");
  });
  it("rejects stale or ambiguous narrative stage identities", () => {
    const raw = result(); raw.expedition.days[0].routes[0].routeIdentityKey = "made-up-route";
    expect(() => expeditionGenerationDraft(raw)).toThrow("stage identities");
  });
  it("rejects plans which omit selected hills or repeat one in place of another", () => {
    const raw = result(); raw.expedition.days.pop();
    expect(() => expeditionGenerationDraft(raw)).toThrow("incomplete or repeated");
    raw.expedition.days.push(raw.expedition.days[0]);
    expect(() => expeditionGenerationDraft(raw)).toThrow("incomplete or repeated");
  });
  it("never treats name matches or non-canonical provider IDs as catalogue bindings", () => {
    const raw = result(); raw.recommendedHills[1].summitIdentityKey = "Fairfield";
    expect(expeditionGenerationDraft(raw).draft.stages[0]).not.toHaveProperty("mountainId");
  });
  it("rejects empty selections rather than returning a fake expedition", () => {
    expect(() => expeditionGenerationDraft({ ...result(), recommendedHills: [] })).toThrow();
  });
});
