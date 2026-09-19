import { describe, expect, it, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  canonicalActivityPayloadHash,
} from "../services/canonicalActivity";
import {
  manualTrainingCanonicalAdapterEnabled,
  manualTrainingCanonicalInput,
  manualTrainingRetryDecision,
  manualTrainingSourceSnapshot,
} from "../services/manualTrainingCanonicalAdapter";

const hillSessionRouteSource = readFileSync(
  new URL("../routes/hill-session.ts", import.meta.url),
  "utf8",
);

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
      plannedHillName: "Hill",
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

  it("simulates one transactional legacy/canonical store across first, retry, and conflict", () => {
    const legacyRows: number[] = [];
    let canonical: {
      ownerUserId: string;
      sourcePayloadHash: string;
      occurredAt: Date;
      sourceSnapshot: Record<string, unknown>;
    } | undefined;

    const save = (value: ReturnType<typeof completion>) => {
      if (canonical) {
        const legacyId = Number(canonical.sourceSnapshot.legacyTrackedHillSessionId);
        const retry = manualTrainingCanonicalInput({
          ...value,
          completedAt: canonical.occurredAt,
          sourceSnapshot: manualTrainingSourceSnapshot({
            plannedHillName: value.sourceSnapshot.plannedHillName as string,
            hillId: value.sourceSnapshot.hillId as number | undefined,
            targetReps: value.sourceSnapshot.targetReps as number,
            estimatedGainPerRepM: value.sourceSnapshot.estimatedGainPerRepM as number,
            estimatedTotalGainM: value.sourceSnapshot.estimatedTotalGainM as number,
            legacyTrackedHillSessionId: legacyId,
          }),
        });
        const decision = manualTrainingRetryDecision(
          canonical,
          value.ownerUserId,
          canonicalActivityPayloadHash(retry),
        );
        if (decision === "conflict") throw new Error("Source identity payload conflict");
        return legacyId;
      }

      const legacyId = 1;
      legacyRows.push(legacyId);
      const input = manualTrainingCanonicalInput({
        ...value,
        sourceSnapshot: manualTrainingSourceSnapshot({
          plannedHillName: value.sourceSnapshot.plannedHillName as string,
          hillId: undefined,
          targetReps: value.sourceSnapshot.targetReps as number,
          estimatedGainPerRepM: value.sourceSnapshot.estimatedGainPerRepM as number,
          estimatedTotalGainM: value.sourceSnapshot.estimatedTotalGainM as number,
          legacyTrackedHillSessionId: legacyId,
        }),
      });
      canonical = {
        ownerUserId: value.ownerUserId,
        sourcePayloadHash: canonicalActivityPayloadHash(input),
        occurredAt: input.occurredAt,
        sourceSnapshot: input.sourceSnapshot ?? {},
      };
      return legacyId;
    };

    const firstId = save(completion());
    const retryId = save(completion());
    expect(firstId).toBe(retryId);
    expect(legacyRows).toHaveLength(1);
    expect(() => save(completion({ estimatedAscentM: 999 })))
      .toThrow("Source identity payload conflict");
    expect(legacyRows).toHaveLength(1);
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

  it("supports completion without optional plan/session links", () => {
    const input = manualTrainingCanonicalInput(completion({
      trainingPlanId: undefined,
      trainingSessionId: undefined,
    }));
    expect(input.links).toEqual([]);
  });

  it("wires the adapter behind a default-off flag without changing the legacy response", () => {
    expect(hillSessionRouteSource).toMatch(
      /completionId:\s*z\.string\(\)\.min\(1\)\.max\(256\)\.optional\(\)/,
    );
    expect(hillSessionRouteSource).toMatch(/db\.transaction\(async \(tx\) =>/);
    expect(hillSessionRouteSource).toMatch(
      /ingestManualTrainingCompletionWithClient\(tx/,
    );
    expect(hillSessionRouteSource).toMatch(/canonicalActivityPayloadHash/);
    expect(hillSessionRouteSource).toMatch(/manualTrainingRetryDecision/);
    expect(hillSessionRouteSource).toMatch(/canonicalActivities\.sourceId/);
    expect(hillSessionRouteSource).toMatch(
      /return res\.status\(201\)\.json\(\{ id: result\.id, completionType: "estimated_manual" \}\)/,
    );
    expect(hillSessionRouteSource).toMatch(
      /return res\.status\(409\)\.json\(\{\s*error: "Source identity payload conflict"/s,
    );
    delete process.env.CANONICAL_MANUAL_TRAINING_ADAPTER_ENABLED;
    expect(manualTrainingCanonicalAdapterEnabled()).toBe(false);
  });
});
