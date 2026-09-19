import { describe, expect, it } from "vitest";
import {
  evaluateReadiness,
  READINESS_MODEL_VERSION,
  type ReadinessEvidence,
  type ReadinessInput,
} from "./readinessV2";

const asOf = "2026-09-19T12:00:00.000Z";
const target = { mountainId: "sde:ben-nevis", distanceKm: 16, ascentM: 1352, expectedDurationMinutes: 420 };
const activity = (overrides: Partial<ReadinessEvidence> = {}): ReadinessEvidence => ({
  evidenceId: "activity-1",
  ownerId: "owner-a",
  source: "tracked_gps",
  completedAt: "2026-09-10T12:00:00.000Z",
  distanceKm: 10,
  ascentM: 700,
  durationMinutes: 240,
  gpsQuality: "trusted",
  ...overrides,
});
const input = (evidence: ReadonlyArray<ReadinessEvidence>, targetOverride = target): ReadinessInput => ({
  ownerId: "owner-a",
  asOf,
  target: targetOverride,
  evidence,
});

describe("Readiness 2.0", () => {
  it("returns unavailable rather than a fabricated zero without evidence", () => {
    const result = evaluateReadiness(input([]));
    expect(result.modelVersion).toBe(READINESS_MODEL_VERSION);
    expect(result.state).toBe("unavailable");
    expect(result.overallScore).toBeNull();
    expect(result.confidence).toBe("none");
  });

  it("returns a bounded degraded result for partial evidence and missing target facts", () => {
    const result = evaluateReadiness(input([activity()], {
      mountainId: "sde:target",
      distanceKm: null,
      ascentM: null,
    }));
    expect(result.state).toBe("degraded");
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(55);
    expect(result.missing).toContain("target_distance_km");
    expect(result.missing).toContain("target_ascent_m");
  });

  it("calculates strong multi-week evidence deterministically and keeps all dimensions bounded", () => {
    const evidence = Array.from({ length: 10 }, (_, index) => activity({
      evidenceId: `activity-${index}`,
      completedAt: new Date(Date.parse(asOf) - (index * 4 + 1) * 86_400_000).toISOString(),
      distanceKm: 16,
      ascentM: 1352,
      durationMinutes: 420,
      terrainTags: ["mountain"],
    }));
    const first = evaluateReadiness(input(evidence, target));
    const second = evaluateReadiness(input(evidence, target));
    expect(first).toEqual(second);
    expect(first.state).toBe("available");
    expect(first.overallScore).toBeGreaterThanOrEqual(0);
    expect(first.overallScore).toBeLessThanOrEqual(100);
    for (const dimension of Object.values(first.dimensions)) {
      expect(dimension.score).toBeGreaterThanOrEqual(0);
      expect(dimension.score).toBeLessThanOrEqual(100);
    }
  });

  it("decays stale evidence and applies a stale-only cap", () => {
    const result = evaluateReadiness(input([activity({
      completedAt: "2026-06-01T12:00:00.000Z",
    })]));
    expect(result.overallScore).toBeLessThanOrEqual(60);
    expect(result.confidence).toBe("low");
  });

  it("reduces manual and indoor evidence and never infers mountain experience", () => {
    const result = evaluateReadiness(input([
      activity({ evidenceId: "manual", source: "manual", gpsQuality: null, terrainTags: ["indoor"] }),
      activity({ evidenceId: "indoor", source: "indoor", gpsQuality: null }),
    ]));
    expect(result.overallScore).toBeLessThanOrEqual(65);
    expect(result.dimensions.mountainExperience.score).toBe(0);
  });

  it("excludes planned, simulated, invalid GPS, and future evidence", () => {
    const result = evaluateReadiness(input([
      activity({ evidenceId: "planned", completed: false }),
      activity({ evidenceId: "simulated", simulated: true }),
      activity({ evidenceId: "untrusted", gpsQuality: "untrusted" }),
      activity({ evidenceId: "future", completedAt: "2026-10-01T12:00:00.000Z" }),
      activity({ evidenceId: "negative", distanceKm: -2 }),
    ]));
    expect(result.state).toBe("unavailable");
    expect(result.includedEvidenceIds).toEqual([]);
    expect(result.excludedEvidence).toHaveLength(5);
  });

  it("counts a real Expedition GPS activity once while excluding its simulated copy", () => {
    const result = evaluateReadiness(input([
      activity({ evidenceId: "real", canonicalActivityId: "canonical-1", expedition: true }),
      activity({ evidenceId: "retry", canonicalActivityId: "canonical-1", expedition: true }),
      activity({ evidenceId: "simulated", simulated: true, source: "manual" }),
    ]));
    expect(result.includedEvidenceIds).toEqual(["real"]);
    expect(result.excludedEvidence.map((item) => item.reason)).toContain("duplicate_activity_evidence");
    expect(result.excludedEvidence.map((item) => item.reason)).toContain("simulated_expedition_evidence");
  });

  it("isolates owners before aggregation", () => {
    const result = evaluateReadiness(input([
      activity({ evidenceId: "other", ownerId: "owner-b", distanceKm: 100, ascentM: 5000 }),
    ]));
    expect(result.state).toBe("unavailable");
    expect(result.excludedEvidence[0]?.reason).toBe("owner_or_identity_mismatch");
  });

  it("deduplicates legacy retries by stable source identity", () => {
    const result = evaluateReadiness(input([
      activity({ evidenceId: "one", stableSourceId: "source-1", syncState: "local_only" }),
      activity({ evidenceId: "two", stableSourceId: "source-1", syncState: "synced" }),
    ]));
    expect(result.includedEvidenceIds).toEqual(["two"]);
    expect(result.excludedEvidence[0]?.reason).toBe("duplicate_activity_evidence");
  });

  it("uses plan adherence for consistency without counting planned sessions as evidence", () => {
    const result = evaluateReadiness({
      ...input([activity()]),
      plan: { dueSessions: 8, completedDueSessions: 1, plannedSessionCount: 8 },
    });
    expect(result.dimensions.consistency.evidenceIds).toEqual(["activity-1"]);
    expect(result.includedEvidenceIds).toEqual(["activity-1"]);
  });
});