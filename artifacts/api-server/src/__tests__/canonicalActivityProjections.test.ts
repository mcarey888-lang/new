import { describe, expect, it } from "vitest";
import type {
  CanonicalHistoryActivity,
  CanonicalHistoryProjection,
} from "../services/canonicalActivityProjections";
import {
  compareCanonicalHistoryWithLegacy,
  projectCanonicalActivityHistory,
} from "../services/canonicalActivityProjections";

function activity(
  id: string,
  primaryContext: CanonicalHistoryActivity["primaryContext"],
  occurredAt: string,
  links: CanonicalHistoryActivity["links"] = [],
): CanonicalHistoryActivity {
  return {
    id,
    ownerUserId: "owner-1",
    sourceType: "tracked_hill_session",
    sourceId: id,
    sourceVersion: null,
    primaryContext,
    activityKind: "outdoor_hike",
    occurredAt: new Date(occurredAt),
    startedAt: null,
    endedAt: null,
    durationSeconds: 100,
    distanceKm: 4,
    recordedAscentM: 200,
    validatedAscentM: null,
    descentM: null,
    lifecycle: "synced",
    evidenceState: "recorded_unverified",
    visibility: "private",
    links,
  };
}

describe("canonical activity history projections", () => {
  const shared = activity(
    "activity-1",
    "free_hike",
    "2026-09-19T10:00:00.000Z",
    [
      { linkType: "training_session", targetId: "session-1" },
      { linkType: "expedition_stage", targetId: "stage-1" },
      { linkType: "canonical_route", targetId: "42" },
    ],
  );

  it("shows a multi-purpose activity once in All", () => {
    const result = projectCanonicalActivityHistory(
      [shared, { ...shared, links: [...(shared.links ?? []), ...shared.links!] }],
      { ownerUserId: "owner-1", filter: "all" },
    );
    expect(result).toHaveLength(1);
    expect(result[0].matchedContexts).toEqual([
      "training",
      "expeditions",
      "mountains_free_hike",
    ]);
    expect(result[0].links).toHaveLength(3);
  });

  it("includes the shared activity in each applicable filtered context", () => {
    expect(projectCanonicalActivityHistory([shared], {
      ownerUserId: "owner-1",
      filter: "training",
    })).toHaveLength(1);
    expect(projectCanonicalActivityHistory([shared], {
      ownerUserId: "owner-1",
      filter: "expeditions",
    })).toHaveLength(1);
    expect(projectCanonicalActivityHistory([shared], {
      ownerUserId: "owner-1",
      filter: "mountains_free_hike",
    })).toHaveLength(1);
  });

  it("uses primary context and excludes another owner's private activity", () => {
    const result = projectCanonicalActivityHistory([
      activity("training-1", "training", "2026-09-18T10:00:00.000Z"),
      { ...activity("other-owner", "training", "2026-09-20T10:00:00.000Z"), ownerUserId: "owner-2" },
    ], { ownerUserId: "owner-1", filter: "training" });
    expect(result.map((entry) => entry.id)).toEqual(["training-1"]);
  });

  it("excludes deleted activities from every history filter", () => {
    const deleted = {
      ...activity("deleted-1", "training", "2026-09-20T10:00:00.000Z"),
      lifecycle: "deleted",
    };
    const result = projectCanonicalActivityHistory([
      deleted,
      activity("active-1", "training", "2026-09-19T10:00:00.000Z"),
    ], { ownerUserId: "owner-1", filter: "all" });
    expect(result.map((entry) => entry.id)).toEqual(["active-1"]);
  });

  it("sorts newest first and does not fuzzy-match unrelated activities", () => {
    const result = projectCanonicalActivityHistory([
      activity("older", "free_hike", "2026-09-18T10:00:00.000Z"),
      activity("newer", "free_hike", "2026-09-19T10:00:00.000Z"),
    ], { ownerUserId: "owner-1" });
    expect(result.map((entry) => entry.id)).toEqual(["newer", "older"]);
  });
});

describe("legacy comparison report", () => {
  it("reports missing, duplicate, source, and owner mismatches", () => {
    const canonical = projectCanonicalActivityHistory([
      activity("activity-1", "training", "2026-09-19T10:00:00.000Z"),
      activity("activity-2", "free_hike", "2026-09-18T10:00:00.000Z"),
    ], { ownerUserId: "owner-1" });
    const report = compareCanonicalHistoryWithLegacy(canonical, [
      {
        legacyKey: "legacy-1",
        ownerUserId: "owner-1",
        canonicalActivityId: "activity-1",
        sourceType: "tracked_hill_session",
        sourceId: "wrong-source",
      },
      {
        legacyKey: "legacy-duplicate",
        ownerUserId: "owner-1",
        canonicalActivityId: "activity-1",
      },
      {
        legacyKey: "legacy-missing",
        ownerUserId: "owner-1",
        canonicalActivityId: "missing",
      },
    ], "owner-1");

    expect(report.mismatches).toEqual(expect.arrayContaining([
      {
        type: "legacy_source_mismatch",
        legacyKey: "legacy-1",
        canonicalActivityId: "activity-1",
      },
      {
        type: "legacy_duplicate_canonical",
        canonicalActivityId: "activity-1",
        legacyKeys: ["legacy-1", "legacy-duplicate"],
      },
      {
        type: "legacy_missing_canonical",
        legacyKey: "legacy-missing",
      },
      {
        type: "canonical_missing_legacy",
        canonicalActivityId: "activity-2",
      },
    ]));
  });

  it("ignores normal legacy rows belonging to another owner", () => {
    const ownerTwoActivity = {
      ...activity("owner-2-activity", "training", "2026-09-18T10:00:00.000Z"),
      ownerUserId: "owner-2",
    };
    const canonical = projectCanonicalActivityHistory([
      activity("activity-1", "training", "2026-09-19T10:00:00.000Z"),
      ownerTwoActivity,
    ], { ownerUserId: "owner-1" });
    const ownerTwoCanonical = projectCanonicalActivityHistory(
      [ownerTwoActivity],
      { ownerUserId: "owner-2" },
    );
    const report = compareCanonicalHistoryWithLegacy([
      ...canonical,
      ...ownerTwoCanonical,
    ], [
      {
        legacyKey: "owner-1-row",
        ownerUserId: "owner-1",
        canonicalActivityId: "activity-1",
      },
      {
        legacyKey: "owner-2-row",
        ownerUserId: "owner-2",
        canonicalActivityId: "owner-2-activity",
      },
    ], "owner-1");

    expect(report.mismatches).toEqual([]);
  });

  it("reports an owner mismatch only when the reviewed owner's row points elsewhere", () => {
    const ownerTwoActivity = {
      ...activity("owner-2-activity", "training", "2026-09-18T10:00:00.000Z"),
      ownerUserId: "owner-2",
    };
    const canonical = [
      ...projectCanonicalActivityHistory([
        activity("activity-1", "training", "2026-09-19T10:00:00.000Z"),
        ownerTwoActivity,
      ], { ownerUserId: "owner-1" }),
      ...projectCanonicalActivityHistory([ownerTwoActivity], { ownerUserId: "owner-2" }),
    ] satisfies CanonicalHistoryProjection[];
    const report = compareCanonicalHistoryWithLegacy(canonical, [{
      legacyKey: "wrong-owner-link",
      ownerUserId: "owner-1",
      canonicalActivityId: "owner-2-activity",
    }], "owner-1");
    expect(report.mismatches).toContainEqual({
      type: "legacy_owner_mismatch",
      legacyKey: "wrong-owner-link",
      canonicalActivityId: "owner-2-activity",
    });
  });
});
