import { describe, expect, it } from "vitest";
import {
  calculateManualDna, canShowManualChoices, choiceRequest, removeSelection,
  reorderSelection, requiresExtraDay, suggestionTransition, hydrateManualSnapshot,
  normalizeManualTechnicalTarget, CUSTOM_EXPEDITION_LABELS,
  buildManualSaveSnapshot,
  dispatchCreationChoice, applySelectionChange, assignObjectiveDay,
  confirmSuggestionFlow, confirmExtraDayFlow,
} from "./manualExpedition";

describe("manual expedition DNA", () => {
  const target = { gainM: 1000, distanceKm: 10, averageGradientPercent: 10 };
  it("uses symmetric axes and weighted gradient, not altitude or days", () => {
    const dna = calculateManualDna([
      { gainM: 500, distanceKm: 5, averageGradientPercent: 20 },
      { gainM: 500, distanceKm: 5, averageGradientPercent: 0 },
    ], target);
    expect(dna.overall).toBe(100);
    expect(dna.averageGradientPercent).toBe(10);
    expect(dna.gradientSimilarity).toBe(100);
    expect(dna.range).toBe("within");
  });
  it("distinguishes normal, widened and outside ranges", () => {
    expect(calculateManualDna([{ gainM: 900, distanceKm: 9 }], target).range).toBe("within");
    expect(calculateManualDna([{ gainM: 720, distanceKm: 7.5 }], target).range).toBe("within_widened");
    expect(calculateManualDna([{ gainM: 400, distanceKm: 4 }], target).range).toBe("below");
  });
  it("gates choices on resolved route and available days", () => {
    expect(canShowManualChoices({ targetMountain: "Ben Nevis", days: 2, routeSelectionRequired: true })).toBe(false);
    expect(canShowManualChoices({ targetMountain: "Ben Nevis", targetRouteIdentityKey: "r1", days: null })).toBe(false);
    expect(canShowManualChoices({ targetMountain: "Ben Nevis", targetRouteIdentityKey: "r1", days: 2 })).toBe(true);
    expect(canShowManualChoices({ targetMountain: "Ben Nevis", days: 2, routeSelectionRequired: false })).toBe(true);
    expect(canShowManualChoices({ targetMountain: "Ben Nevis", days: 2, routeSelectionRequired: true })).toBe(false);
    expect(choiceRequest("automatic", { targetMountain: "Ben Nevis", targetRouteIdentityKey: "r1", days: 2 })).toMatchObject({ mode: "automatic", resolveOnly: false, daysOverride: 2 });
    expect(choiceRequest("manual", { targetMountain: "Ben Nevis", targetRouteIdentityKey: "r1", days: 2 })).toMatchObject({ mode: "manual", resolveOnly: false, daysOverride: 2 });
  });
  it("normalizes technical fallback and protects Custom Expedition terminology", () => {
    expect(normalizeManualTechnicalTarget()).toBe("walking");
    expect(normalizeManualTechnicalTarget("Hard exposed scramble")).toBe("scrambling");
    expect(normalizeManualTechnicalTarget("technical alpine")).toBe("technical");
    expect(CUSTOM_EXPEDITION_LABELS.equivalent).not.toMatch(/HILL/i);
    expect(CUSTOM_EXPEDITION_LABELS.matchScore).not.toMatch(/HILL/i);
  });
  it("builds exact ordered snapshot and prunes stale assignment/provenance entries", () => {
    const dna = calculateManualDna([{ gainM: 10, distanceKm: 1 }], { gainM: 10, distanceKm: 1 });
    const snapshot = buildManualSaveSnapshot({
      selectedRouteIdentityKeys: ["r2", "r1"], dayAssignments: { r2: 2, stale: 4 }, dna,
      routes: [
        { routeIdentityKey: "r2", summitIdentityKey: "s2", dataSource: "canonical", confidence: "verified" },
        { routeIdentityKey: "r1", summitIdentityKey: "s1", dataSource: "terrain", confidence: "calculated" },
        { routeIdentityKey: "stale", summitIdentityKey: "s0" },
      ],
    });
    expect(snapshot.selectedRouteIdentityKeys).toEqual(["r2", "r1"]);
    expect(snapshot.dayAssignments).toEqual({ r2: 2 });
    expect(snapshot.routes.map(route => route.routeIdentityKey)).toEqual(["r2", "r1"]);
    expect(snapshot.dna).toEqual(dna);
  });
  it("supports add/remove/reorder and prunes assignments", () => {
    const initial = { keys: ["a", "b", "c"], assignments: { a: 1, b: 2, c: 3 } };
    expect(removeSelection(initial, "b")).toEqual({ keys: ["a", "c"], assignments: { a: 1, c: 3 } });
    expect(reorderSelection(initial, 2, -1).keys).toEqual(["a", "c", "b"]);
    expect(requiresExtraDay({ a: 1, b: 3 }, ["a", "b"], 2)).toBe(true);
    expect(requiresExtraDay({ a: 1, b: 2 }, ["a", "b"], 2)).toBe(false);
  });
  it("keeps suggestions preview-only until confirmation", () => {
    expect(suggestionTransition(70, 90, false)).toEqual({ preview: true, added: false });
    expect(suggestionTransition(70, 90, true)).toEqual({ preview: false, added: true });
    expect(suggestionTransition(90, 70, true).added).toBe(false);
  });
  it("round-trips selected IDs and assignments for save/hydration", () => {
    const dna = calculateManualDna([{ gainM: 500, distanceKm: 5 }], { gainM: 500, distanceKm: 5 });
    const snapshot = {
      selectedRouteIdentityKeys: ["r1"], dayAssignments: { r1: 2 }, dna,
      routes: [{ routeIdentityKey: "r1", summitIdentityKey: "s1", dataSource: "canonical", confidence: "verified" }],
    };
    expect(hydrateManualSnapshot(snapshot)).toEqual({ keys: ["r1"], assignments: { r1: 2 } });
    expect(hydrateManualSnapshot(null)).toEqual({ keys: [], assignments: {} });
  });
  it("uses the same technical fallback for live and save calculations", () => {
    const routes = [{ gainM: 500, distanceKm: 5, technicalSuitability: 80 }];
    const target = { gainM: 500, distanceKm: 5, averageGradientPercent: 10 };
    expect(calculateManualDna(routes, target)).toEqual(calculateManualDna(routes, target));
  });
  it("controllers execute production choice, selection, scheduling and confirmation paths", async () => {
    const calls: any[] = [];
    expect(await dispatchCreationChoice({ targetMountain: "Alps", targetRouteIdentityKey: "r", days: 2, location: "Area", radius: 20 }, async payload => { calls.push(payload); }, "automatic")).toBe(true);
    expect(calls[0]).toMatchObject({ mode: "automatic", resolveOnly: false });
    expect(await dispatchCreationChoice({ targetMountain: "Alps", days: 2, routeSelectionRequired: true, location: "Area", radius: 20 }, async () => {}, "manual")).toBe(false);
    const routes = { a: { gainM: 100, distanceKm: 2, summitIdentityKey: "s1" }, b: { gainM: 200, distanceKm: 3, summitIdentityKey: "s2" }, c: { gainM: 150, distanceKm: 2.5, summitIdentityKey: "s1" } };
    const state = { keys: ["a"], assignments: { a: 1 }, routes, target: { gainM: 100, distanceKm: 2 } };
    const added = applySelectionChange(state, { type: "add", key: "b" });
    expect(added.dna.gainM).toBe(300);
    expect(applySelectionChange(added, { type: "remove", key: "b" }).dna.gainM).toBe(100);
    expect(applySelectionChange(state, { type: "replace", key: "a", replacementKey: "c" }).keys).toEqual(["c"]);
    expect(assignObjectiveDay({ assignments: { a: 1 }, selectedKeys: ["a"], days: 1 }, "b", 1).accepted).toBe(false);
    expect((await confirmSuggestionFlow(state, { key: "b", route: routes.b }, () => false)).keys).toEqual(["a"]);
    expect((await confirmSuggestionFlow(state, { key: "b", route: routes.b }, () => true)).keys).toEqual(["a", "b"]);
    expect(await confirmExtraDayFlow(2, 1, () => false)).toBe(false);
    expect(await confirmExtraDayFlow(2, 1, () => true)).toBe(true);
  });
});