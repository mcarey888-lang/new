import { describe, expect, it, afterEach } from "vitest";
import {
  canonicalActivityPayloadHash,
} from "../services/canonicalActivity";
import {
  manualTrainingCanonicalAdapterEnabled,
  manualTrainingCanonicalInput,
} from "../services/manualTrainingCanonicalAdapter";

const originalFlag = process.env.CANONICAL_MANUAL_TRAINING_ADAPTER_ENABLED;

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.CANONICAL_MANUAL_TRAINING_ADAPTER_ENABLED;
  } else {
    process.env.CANONICAL_MANUAL_TRAINING_ADAPTER_ENABLED = originalFlag;
  }
});

function completion(overrides: Partial<Parameters<typeof manualTrainingCanonicalInput>[0]> = {}) {
  return {
    ownerUserId: "user_A",
    completionId: "training-completion-01",
    trainingPlanId: "plan-7",
    trainingSessionId: "session-3",
    completedAt: new Date("2026-09-19T10:00:00.000Z"),
    activityKind: "hill_repetitions",
    durationSeconds: 1800,
    estimatedAscentM: 420,
    sourceSnapshot: {
      targetReps: 6,
      estimatedGainPerRepM: 70,
    },
    ...overrides,
  };
}

describe("manual Training canonical adapter", () => {
  it("is disabled unless explicitly enabled", () => {
    delete process.env.CANONICAL_MANUAL_TRAINING_ADAPTER_ENABLED;
    expect(manualTrainingCanonicalAdapterEnabled()).toBe(false);
    process.env.CANONICAL_MANUAL_TRAINING_ADAPTER_ENABLED = "false";
    expect(manualTrainingCanonicalAdapterEnabled()).toBe(false);
    process.env.CANONICAL_MANUAL_TRAINING_ADAPTER_ENABLED = "true";
    expect(manualTrainingCanonicalAdapterEnabled()).toBe(true);
  });

  it("uses the stable completion ID and preserves owner separation", () => {
    const first = manualTrainingCanonicalInput(completion());
    const otherOwner = manualTrainingCanonicalInput(completion({ ownerUserId: "user_B" }));

    expect(first.sourceType).toBe("training_manual");
    expect(first.sourceId).toBe("training-completion-01");
    expect(first.sourceId).toBe(otherOwner.sourceId);
    expect(first.ownerUserId).not.toBe(otherOwner.ownerUserId);
    expect(first.sourceId).not.toContain("plan-7");
    expect(first.sourceId).not.toContain("420");
  });

  it("is idempotent for identical retries and conflicts on changed payloads", () => {
    const first = manualTrainingCanonicalInput(completion());
    const retry = manualTrainingCanonicalInput(completion());
    const changed = manualTrainingCanonicalInput(completion({ estimatedAscentM: 500 }));

    expect(canonicalActivityPayloadHash(first)).toBe(canonicalActivityPayloadHash(retry));
    expect(canonicalActivityPayloadHash(first))
      .not.toBe(canonicalActivityPayloadHash(changed));
    // The existing canonical ingestion service uses the stable owner/source
    // unique key: equal hashes deduplicate; changed hashes become conflicts.
    expect(first.sourceType).toBe(retry.sourceType);
    expect(first.sourceId).toBe(retry.sourceId);
  });

  it("stores manual evidence and never promotes it to GPS or competitive state", () => {
    const input = manualTrainingCanonicalInput(completion());

    expect(input.primaryContext).toBe("training");
    expect(input.evidenceState).toBe("unverified_manual");
    expect(input.evidence).toEqual([expect.objectContaining({
      evidenceType: "manual_estimate",
      payload: expect.objectContaining({ classification: "estimated_manual" }),
    })]);
    expect(input.evidence?.some((item) => item.evidenceType === "gps_track")).toBe(false);
    expect(input.evidenceState).not.toBe("quality_accepted");
    expect(input.evidenceState).not.toBe("competition_eligible");
  });

  it("adds only explicit plan/session links and leaves legacy route behavior unwired", () => {
    const withPlan = manualTrainingCanonicalInput(completion());
    const withoutPlan = manualTrainingCanonicalInput(completion({
      trainingPlanId: undefined,
    }));

    expect(withPlan.links).toEqual([
      { linkType: "training_plan", targetId: "plan-7" },
      { linkType: "training_session", targetId: "session-3" },
    ]);
    expect(withoutPlan.links).toEqual([
      { linkType: "training_session", targetId: "session-3" },
    ]);
  });
});
