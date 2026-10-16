import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeActivityKinds } from "./activityReliability";
import { mountainImageUri } from "./mountainImage";
import { privateRecordedHikeBackup } from "./recordedHikeRecovery";
import { createReadinessInput } from "./readinessAdapter";
import type { ExploreHike, SummitGoal } from "@/context/AppContext";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const manual: ExploreHike = {
  id: "manual-qa-one", manualEntryId: "manual-qa-one",
  name: "QA manual", date: "2026-10-16", distance: 5,
  elevationGain: 200, timeTaken: 90, notes: "", countsTowardTraining: true,
};

describe("one manual hike, one activity", () => {
  it("never creates an extra plan workout or guesses a plan week", () => {
    const modal = read("components/LogHikeModal.tsx");
    expect(modal).not.toContain("addSession");
    expect(modal).not.toContain("weekNumber:");
    expect(modal).toContain("savingRef.current");
    expect(modal).toContain("manualEntryId: entryIdRef.current");
    expect(modal).toContain("countsTowardTraining: !hasSummitGoal || addToSummit");
    expect(modal).toContain("aria-checked={addToSummit}");
  });
  it("deduplicates explicit legacy training links without deleting source data", () => {
    const legacyCopy = { id: "old-plan-copy", sourceHikeId: manual.id, elevationGain: 200 };
    const rows = mergeActivityKinds([legacyCopy], [manual]);
    expect(rows).toEqual([manual]);
    expect(rows.reduce((sum, item) => sum + item.elevationGain, 0)).toBe(200);
    expect(legacyCopy.sourceHikeId).toBe(manual.id);
  });
  it("does not discard an unlinked hike with identical figures or an orphaned session", () => {
    expect(mergeActivityKinds([{ ...manual, id: "another" }], [manual])).toHaveLength(2);
    expect(mergeActivityKinds([{ id: "copy", sourceHikeId: "missing" }], [manual])).toHaveLength(2);
  });
  it("keeps the manual retry identity and contribution preference in private backups", () => {
    const backup = privateRecordedHikeBackup({ ...manual, countsTowardTraining: false });
    expect(backup.snapshot.manualEntryId).toBe(manual.id);
    expect(backup.snapshot.countsTowardTraining).toBe(false);
    expect(backup.snapshot.activityId).toBeUndefined();
  });
  it("uses manual readiness evidence, and respects opting out", () => {
    const goal = { mountainName: "Tryfan", elevationGain: 900, distance: 6, highestAltitude: 918 } as SummitGoal;
    const on = createReadinessInput("qa-owner", "2026-10-16", goal, [], [manual], []);
    expect(on.evidence).toHaveLength(1);
    expect(on.evidence[0].source).toBe("manual");
    expect(on.evidence[0].canonicalActivityId).toBeUndefined();
    expect(createReadinessInput("qa-owner", "2026-10-16", goal, [], [{ ...manual, countsTowardTraining: false }], []).evidence).toHaveLength(0);
  });
});

describe("recording and presentation safeguards", () => {
  it("keeps time-only recording available without location", () => {
    const recorder = read("app/hike-tracking.tsx");
    expect(recorder).not.toContain("if (permDenied) {");
    expect(recorder).toContain('testID="recording-without-gps"');
    expect(recorder.indexOf("timerRef.current = setInterval", recorder.indexOf("const startTrackingImpl"))).toBeLessThan(
      recorder.indexOf("const outcome = await requestBackgroundLocation", recorder.indexOf("const startTrackingImpl")),
    );
  });
  it("clears primary navigation and uses a responsive web viewport", () => {
    expect(read("components/SharedTrackScreen.tsx")).toContain("bottom: navigationHeight + 8");
    expect(read("components/SharedTabBar.tsx")).toContain('testID="primary-tab-bar"');
    expect(read("app/_layout.tsx")).toContain("height: 100dvh");
  });
  it("never surfaces raw sample errors or suggests re-login for generic story failures", () => {
    expect(read("hooks/useSavedDemoYear.ts")).not.toContain("String(error)");
    expect(read("hooks/useCommunity.ts")).not.toContain("Try signing in again");
  });
  it.each(["Kilimanjaro", "Indian's Head", "Ben Nevis"])("forbids map fallback for shared artwork: %s", name => {
    const uri = new URL(mountainImageUri(name)!, "https://example.test");
    expect(uri.searchParams.get("name")).toBe(name);
    expect(uri.searchParams.get("fallback")).toBe("illustration");
    expect(uri.searchParams.get("artworkRevision")).toBe("mountain-identity-v2");
  });
});
