import { describe, expect, it } from "vitest";
import {
  CANONICAL_EVIDENCE_STORAGE,
  canonicalEvidenceStoragePlan,
  canonicalSourceIdentity,
  canonicalSourceIdentityKey,
  classifyCanonicalSourceType,
  externalCanonicalSourceType,
  parseCanonicalSourceIdentityKey,
  parseSdeMountainTarget,
  parseSdeRouteTarget,
  sdeMountainTarget,
  sdeRouteTarget,
  validateAdapterOutput,
  validateCanonicalLinkTarget,
  type ExploreHikeAdapterInput,
  type TrainingManualAdapterInput,
} from "../services/canonicalActivityContracts";

describe("canonical source identity contracts", () => {
  it("preserves the existing tracked-hill persisted identity", () => {
    expect(canonicalSourceIdentity("tracked_hill_session", "route_100")).toEqual({
      sourceType: "tracked_hill_session",
      sourceId: "route_100",
    });
    expect(classifyCanonicalSourceType("tracked_hill_session")).toEqual({
      kind: "built_in",
      sourceType: "tracked_hill_session",
    });
  });

  it("supports manual, ExploreHike, provider and import namespaces", () => {
    expect(classifyCanonicalSourceType("training_manual").kind).toBe("built_in");
    expect(classifyCanonicalSourceType("explore_hike").kind).toBe("built_in");
    expect(externalCanonicalSourceType("provider", "Garmin")).toBe("provider:garmin");
    expect(externalCanonicalSourceType("import", "legacy_v1")).toBe("import:legacy_v1");
    expect(classifyCanonicalSourceType("provider:garmin")).toEqual({
      kind: "provider",
      provider: "garmin",
    });
  });

  it("keeps pre-contract Phase 1 source types valid as legacy namespaces", () => {
    expect(classifyCanonicalSourceType("future_source")).toEqual({
      kind: "legacy",
      sourceType: "future_source",
    });
  });

  it("formats and parses a deterministic identity key without changing persistence", () => {
    const identity = canonicalSourceIdentity(
      "provider:garmin",
      "activity:with spaces/and/slashes",
    );
    const key = canonicalSourceIdentityKey(identity);
    expect(key).toBe(
      "source:provider%3Agarmin:activity%3Awith%20spaces%2Fand%2Fslashes",
    );
    expect(parseCanonicalSourceIdentityKey(key)).toEqual(identity);
    expect(canonicalSourceIdentityKey(identity)).toBe(key);
  });

  it.each([
    ["bad type", "id"],
    ["tracked_hill_session", ""],
    ["tracked_hill_session", " leading"],
    ["tracked_hill_session", "line\nbreak"],
  ])("rejects invalid source identity %s / %s", (sourceType, sourceId) => {
    expect(() => canonicalSourceIdentity(sourceType, sourceId)).toThrow();
  });
});

describe("canonical link target contracts", () => {
  const mountainUuid = "f5dd0ef8-7c31-4af4-a9ed-e264753b39c6";

  it("formats and parses Summit Data Engine mountain targets", () => {
    const targetId = sdeMountainTarget(mountainUuid.toUpperCase());
    expect(targetId).toBe(`sde:mountain:${mountainUuid}`);
    expect(parseSdeMountainTarget(targetId)).toEqual({ mountainId: mountainUuid });
    expect(validateCanonicalLinkTarget({
      linkType: "canonical_hill",
      targetId,
    }).targetId).toBe(targetId);
  });

  it("formats and parses versioned Summit Data Engine route targets", () => {
    const targetId = sdeRouteTarget("dobih:route/crib-goch", "v2 reviewed");
    expect(targetId).toBe(
      "sde:route:dobih%3Aroute%2Fcrib-goch@v2%20reviewed",
    );
    expect(parseSdeRouteTarget(targetId)).toEqual({
      identityKey: "dobih:route/crib-goch",
      version: "v2 reviewed",
    });
    expect(validateCanonicalLinkTarget({
      linkType: "canonical_route",
      targetId,
    }).targetId).toBe(targetId);
  });

  it("retains existing non-namespaced link IDs", () => {
    expect(validateCanonicalLinkTarget({
      linkType: "training_session",
      targetId: "week-2-session-3",
    }).targetId).toBe("week-2-session-3");
    expect(validateCanonicalLinkTarget({
      linkType: "canonical_route",
      targetId: "42",
    }).targetId).toBe("42");
  });

  it("rejects invalid or mismatched Summit Data Engine targets", () => {
    expect(() => sdeMountainTarget("not-a-uuid")).toThrow();
    expect(() => parseSdeRouteTarget("sde:route:missing-version")).toThrow();
    expect(() => validateCanonicalLinkTarget({
      linkType: "challenge",
      targetId: sdeMountainTarget(mountainUuid),
    })).toThrow();
    expect(() => validateCanonicalLinkTarget({
      linkType: "canonical_hill",
      targetId: "sde:unknown:value",
    })).toThrow();
  });
});

describe("canonical evidence and adapter contracts", () => {
  it("maps classifications onto existing Phase 1 evidence storage", () => {
    expect(canonicalEvidenceStoragePlan("gps_recorded")).toEqual({
      evidenceState: "recorded_unverified",
      allowedEvidenceTypes: ["gps_track", "elevation_profile", "source_snapshot"],
      classificationMarkerRequired: false,
    });
    expect(CANONICAL_EVIDENCE_STORAGE.estimated_manual.evidenceState)
      .toBe("unverified_manual");
    expect(CANONICAL_EVIDENCE_STORAGE.indoor_training).toEqual({
      evidenceState: "unverified_manual",
      allowedEvidenceTypes: ["source_snapshot"],
      classificationMarkerRequired: true,
    });
    expect(CANONICAL_EVIDENCE_STORAGE.unavailable_untrusted)
      .toEqual(CANONICAL_EVIDENCE_STORAGE.indoor_training);
  });

  it("validates a future manual Training adapter output", () => {
    const input = {
      completionId: "completion_01",
      trainingSessionId: "week-2-session-3",
      completedAt: new Date("2026-09-19T10:00:00.000Z"),
      activityKind: "hill_repetitions",
      estimatedAscentM: 420,
      sourceSnapshot: { repetitions: 6, gainPerRepM: 70 },
    } satisfies TrainingManualAdapterInput;
    const output = {
      source: canonicalSourceIdentity("training_manual", input.completionId),
      primaryContext: "training" as const,
      activityKind: input.activityKind,
      occurredAt: input.completedAt,
      recordedAscentM: input.estimatedAscentM,
      evidence: [{
        classification: "estimated_manual" as const,
        evidenceType: "manual_estimate" as const,
        payload: input.sourceSnapshot,
      }],
      links: [{
        linkType: "training_session" as const,
        targetId: "week-2-session-3",
      }],
    };
    expect(validateAdapterOutput(output)).toBe(output);
  });

  it("defines stable ExploreHike adapter input identity", () => {
    const input = {
      exploreHikeId: "log_01",
      occurredAt: new Date("2026-09-19T10:00:00.000Z"),
      activityKind: "outdoor_hike",
      distanceKm: 12,
      recordedAscentM: 650,
      evidenceClassification: "gps_recorded",
      sourceSnapshot: { source: "device_log" },
    } satisfies ExploreHikeAdapterInput;
    expect(canonicalSourceIdentity("explore_hike", input.exploreHikeId)).toEqual({
      sourceType: "explore_hike",
      sourceId: "log_01",
    });
  });

  it("rejects incompatible evidence and invalid time order", () => {
    expect(() => validateAdapterOutput({
      source: canonicalSourceIdentity("explore_hike", "log_01"),
      primaryContext: "free_hike",
      activityKind: "outdoor_hike",
      occurredAt: new Date("2026-09-19T10:00:00.000Z"),
      evidence: [{
        classification: "indoor_training",
        evidenceType: "gps_track",
        payload: [],
      }],
    })).toThrow(/incompatible/);

    expect(() => validateAdapterOutput({
      source: canonicalSourceIdentity("training_manual", "completion_02"),
      primaryContext: "training",
      activityKind: "hill_repetitions",
      occurredAt: new Date("2026-09-19T10:00:00.000Z"),
      startedAt: new Date("2026-09-19T11:00:00.000Z"),
      endedAt: new Date("2026-09-19T10:30:00.000Z"),
    })).toThrow(/precedes/);
  });
});
