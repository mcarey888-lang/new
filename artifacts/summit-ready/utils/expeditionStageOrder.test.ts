import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { NearbyHill, SavedExpedition } from "../context/AppContext";
import { chooseNextExpeditionStage, findExpeditionStage } from "./expeditionStageOrder";
import { selectExpeditionPresentation } from "./expeditionProgress";
import { routeCompletionKey } from "./stateReliability";
import { hillDetailNavigation } from "./hillDetailNavigation";

function hill(name: string, key: string, elevation = 100): NearbyHill {
  return {
    name, routeIdentityKey: key, summitIdentityKey: `summit:${key}`,
    elevation, totalElevation: elevation, repeats: 1, distance: 4,
    lat: 54.6, lng: -3, surface: "Mixed", grade: "Hard", emoji: "⛰️",
  };
}
const a = hill("Blencathra via Sharp Edge", "route:blencathra");
const b = hill("Helvellyn via Striding Edge", "route:helvellyn", 200);
const c = hill("Third stage", "route:third", 300);

describe("choosing the next expedition stage", () => {
  it("lets the user choose stage two first without changing route facts", () => {
    expect(chooseNextExpeditionStage([a, b, c], [], "route:helvellyn")).toEqual([b, a, c]);
    expect(chooseNextExpeditionStage([a, b], [], "route:helvellyn")?.[0]).toBe(b);
  });
  it("keeps completed stages in their original slots and reorders only unfinished ones", () => {
    expect(chooseNextExpeditionStage([a, b, c], ["route:helvellyn"], "route:third")).toEqual([c, b, a]);
    expect(chooseNextExpeditionStage([a, b, c], ["route:blencathra"], "route:third")).toEqual([a, c, b]);
  });
  it("does not mutate the original list or completed records", () => {
    const hills = Object.freeze([Object.freeze(a), Object.freeze(b), Object.freeze(c)]);
    const completed = Object.freeze(["route:blencathra"]);
    chooseNextExpeditionStage(hills, completed, "route:third");
    expect(hills).toEqual([a, b, c]);
    expect(completed).toEqual(["route:blencathra"]);
  });
  it("rejects completed, missing, ambiguous and empty stages", () => {
    expect(chooseNextExpeditionStage([a, b], ["route:helvellyn"], "route:helvellyn")).toBeNull();
    expect(chooseNextExpeditionStage([a, b], [], "missing")).toBeNull();
    expect(chooseNextExpeditionStage([a, { ...a }], [], "route:blencathra")).toBeNull();
    expect(chooseNextExpeditionStage([], [], "route:blencathra")).toBeNull();
  });
  it("supports legacy name completion and manual summit completion", () => {
    expect(chooseNextExpeditionStage([a, b, c], [a.name], "route:third")).toEqual([a, c, b]);
    const manual = { ...b, objectiveType: "manual_summit" as const };
    const key = routeCompletionKey(manual);
    expect(chooseNextExpeditionStage([a, manual], [], key)).toEqual([manual, a]);
    expect(chooseNextExpeditionStage([a, manual], [key], key)).toBeNull();
  });
  it("opens the selected route when names are duplicated", () => {
    const twin = { ...b, name: a.name };
    expect(findExpeditionStage([a, twin], "route:helvellyn")).toBe(twin);
    expect(hillDetailNavigation(twin, "Lake District").params).toMatchObject({
      routeIdentityKey: "route:helvellyn", summitIdentityKey: b.summitIdentityKey,
      lat: "54.6", lng: "-3", elevation: "200",
    });
  });
  it("preserves target, progress and completion authority after persistence and reload", () => {
    const expedition = {
      id: "qa-expedition", virtualHills: [a, b, c], completedRoutes: ["route:blencathra"],
      virtualHikeProgress: { elevationGained: 100, distanceCovered: 4, hikesLogged: 1 },
    } as SavedExpedition;
    const before = selectExpeditionPresentation(expedition);
    const updated = { ...expedition, virtualHills: chooseNextExpeditionStage(expedition.virtualHills!, expedition.completedRoutes!, "route:third")! };
    const after = selectExpeditionPresentation(JSON.parse(JSON.stringify(updated)));
    expect(after.nextStage?.routeIdentityKey).toBe("route:third");
    expect(after.progress).toEqual(before.progress);
    expect(after.summit).toEqual(before.summit);
    expect(after.stages.find(stage => stage.routeIdentityKey === "route:blencathra")?.status).toBe("completed");
    expect(updated.virtualHikeProgress).toBe(expedition.virtualHikeProgress);
    expect(updated.completedRoutes).toBe(expedition.completedRoutes);
  });
  it("allows repeatedly changing the next stage without adding or losing any stages", () => {
    const first = chooseNextExpeditionStage([a, b, c], [], "route:third")!;
    const second = chooseNextExpeditionStage(first, [], "route:helvellyn")!;
    expect(second).toEqual([b, c, a]);
    expect(new Set(second.map(routeCompletionKey))).toEqual(new Set([a, b, c].map(routeCompletionKey)));
    expect(chooseNextExpeditionStage(second, [], "route:helvellyn")).toEqual(second);
  });
  it("wires stage taps to details and saves only the active expedition's hill order", () => {
    const camp = readFileSync(new URL("../app/(expedition)/base-camp.tsx", import.meta.url), "utf8");
    const detail = readFileSync(new URL("../app/hill-detail.tsx", import.meta.url), "utf8");
    expect(camp).toContain("onSelect={stage =>");
    expect(camp).toContain("stageCompletionKey: stage.routeIdentityKey");
    expect(detail).toContain("expeditionId === activeExpedition?.id");
    expect(detail).toContain("await patchExpedition(stageExpedition.id, { virtualHills: hills })");
    expect(detail).toContain('stageExpedition.expeditionStatus === "complete"');
    expect(detail).toContain('testID="expedition-choose-stage-next"');
  });
});
