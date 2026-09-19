import { describe, expect, it } from "vitest";
import { evaluateReadiness, type ReadinessEvidence, type ReadinessInput } from "./readinessV2";
import { selectReadinessNextAction, type ReadinessActionCandidate } from "./readinessActions";

const asOf = "2026-09-19T12:00:00.000Z";
const target = { mountainId: "sde:target", distanceKm: 16, ascentM: 1200, expectedDurationMinutes: 420 };
const evidence = (overrides: Partial<ReadinessEvidence> = {}): ReadinessEvidence => ({
  evidenceId: "activity-1",
  ownerId: "owner-a",
  source: "tracked_gps",
  completedAt: "2026-09-12T12:00:00.000Z",
  distanceKm: 5,
  ascentM: 250,
  durationMinutes: 120,
  gpsQuality: "trusted",
  ...overrides,
});
const input: ReadinessInput = {
  ownerId: "owner-a",
  asOf,
  target,
  evidence: Array.from({ length: 4 }, (_, index) =>
    evidence({ evidenceId: `activity-${index}`, completedAt: `2026-09-${String(12 - index).padStart(2, "0")}T12:00:00.000Z` }),
  ),
};
const projected = (overrides: Partial<ReadinessEvidence> = {}): ReadinessEvidence => ({
  ...evidence(),
  evidenceId: "not-used-as-real-id",
  completedAt: asOf,
  ...overrides,
});

describe("Readiness next action and projected impact", () => {
  it("ranks the largest readiness gap before later dimensions", () => {
    const result = evaluateReadiness(input);
    const action = selectReadinessNextAction({
      input,
      result,
      candidates: [
        { actionId: "consistency", label: "Weekly walk", focusDimension: "consistency" },
        { actionId: "elevation", label: "Hill session", focusDimension: "elevationCapacity" },
        { actionId: "mountain", label: "Outdoor terrain", focusDimension: "mountainExperience" },
        { actionId: "endurance", label: "Long walk", focusDimension: "endurance" },
      ],
    });
    expect(action?.focusDimension).toBe(result.gaps[0]);
  });

  it("uses stable scheduled-date then action-id tie breaks", () => {
    const result = evaluateReadiness(input);
    const candidates: ReadinessActionCandidate[] = [
      { actionId: "z", label: "Z", focusDimension: "endurance", scheduledDate: "2026-09-22" },
      { actionId: "a", label: "A", focusDimension: "endurance", scheduledDate: "2026-09-22" },
      { actionId: "early", label: "Early", focusDimension: "endurance", scheduledDate: "2026-09-20" },
    ];
    expect(selectReadinessNextAction({ input, result, candidates })?.actionId).toBe("early");
    expect(selectReadinessNextAction({ input, result, candidates: candidates.slice(0, 2) })?.actionId).toBe("a");
  });

  it("prioritizes explicit recovery when overload is supplied", () => {
    const result = evaluateReadiness(input);
    const action = selectReadinessNextAction({
      input,
      result,
      overloadDetected: true,
      candidates: [
        { actionId: "hard", label: "Hard hill", focusDimension: "elevationCapacity" },
        { actionId: "recovery", label: "Recovery day", focusDimension: "consistency" },
      ],
    });
    expect(action?.actionId).toBe("recovery");
  });

  it("projects through the same engine and labels impact estimated", () => {
    const result = evaluateReadiness(input);
    const action = selectReadinessNextAction({
      input,
      result,
      candidates: [{
        actionId: "long-hill",
        label: "Complete Saturday's hill session",
        focusDimension: "elevationCapacity",
        projectedEvidence: projected({ distanceKm: 16, ascentM: 1200, durationMinutes: 420 }),
      }],
    });
    expect(action?.projectedImpact?.estimated).toBe(true);
    expect(action?.projectedImpact?.before).toBe(result.overallScore);
    expect(action?.projectedImpact?.after).toBeGreaterThanOrEqual(action?.projectedImpact?.before ?? 0);
    expect(action?.projectedImpact?.delta).toBeLessThanOrEqual(20);
  });

  it("does not project without explicit action metrics", () => {
    const result = evaluateReadiness(input);
    const action = selectReadinessNextAction({
      input,
      result,
      candidates: [{ actionId: "planned", label: "Planned session", focusDimension: "endurance" }],
    });
    expect(action?.projectedImpact).toBeUndefined();
  });

  it("does not mutate input or count projected evidence as actual evidence", () => {
    const original = structuredClone(input);
    const result = evaluateReadiness(input);
    const action = selectReadinessNextAction({
      input,
      result,
      candidates: [{
        actionId: "projected",
        label: "Projected",
        focusDimension: "endurance",
        projectedEvidence: projected({ distanceKm: 16 }),
      }],
    });
    expect(action?.projectedImpact).toBeDefined();
    expect(input).toEqual(original);
    expect(result.includedEvidenceIds).not.toContain("projected:projected");
  });
});