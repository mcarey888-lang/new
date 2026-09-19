import { describe, expect, it } from "vitest";
import {
  planExpeditionStageContribution,
  planPersonalElevationCredit,
} from "../services/stage2LedgerPlanning";

const baseCredit = {
  ownerUserId: "user-1",
  activityId: "activity-1",
  evidenceClass: "recorded_unverified" as const,
  creditedAscentM: 600,
  ruleVersion: "elevation-v1",
  effectiveAt: new Date("2026-09-19T10:00:00Z"),
};

describe("personal elevation credit planning", () => {
  it("derives identity from activity and rule, preventing context double-credit", () => {
    expect(planPersonalElevationCredit(baseCredit).status).toBe("create");
    expect(planPersonalElevationCredit(baseCredit, [{
      id: "credit-1",
      ownerUserId: "user-1",
      activityId: "activity-1",
      ruleVersion: "elevation-v1",
      revision: 1,
      status: "credited",
    }])).toEqual({ status: "deduplicated", revision: 1 });
  });

  it("rejects manual, indoor, and unavailable evidence", () => {
    for (const evidenceClass of ["unverified_manual", "indoor_training", "unavailable_untrusted"] as const) {
      expect(planPersonalElevationCredit({ ...baseCredit, evidenceClass }).status).toBe("rejected");
    }
  });

  it("creates a new revision for correction/revocation after a prior event", () => {
    expect(planPersonalElevationCredit(baseCredit, [{
      id: "credit-1",
      ownerUserId: "user-1",
      activityId: "activity-1",
      ruleVersion: "elevation-v1",
      revision: 1,
      status: "revoked",
    }])).toMatchObject({ status: "create", revision: 2, correctionOfRevision: 1, priorEventId: "credit-1" });
  });
});

const stageRule = {
  stageKey: "stage-1",
  ruleVersion: "expedition-v1",
  scoreVersion: "score-v1",
  allowedActivityKinds: ["outdoor_hike"],
  allowedEvidenceClasses: ["recorded_unverified", "quality_accepted"] as const,
};

describe("Expedition contribution planning", () => {
  const input = {
    ownerUserId: "user-1",
    runId: "run-1",
    activityId: "activity-1",
    stageRule,
    activityKind: "outdoor_hike",
    evidenceClass: "recorded_unverified" as const,
    acceptedMetric: 600,
    acceptedElevationM: 600,
  };

  it("creates an explicitly simulated contribution and deduplicates retries", () => {
    const first = planExpeditionStageContribution(input);
    expect(first).toMatchObject({ status: "create", simulatedCompletion: true, stageKey: "stage-1" });
    expect(planExpeditionStageContribution(input, [{
      id: "contribution-1",
      ownerUserId: "user-1",
      runId: "run-1",
      activityId: "activity-1",
      stageKey: "stage-1",
      ruleVersion: "expedition-v1",
      scoreVersion: "score-v1",
      revision: 1,
      status: "accepted",
    }])).toEqual({ status: "deduplicated", revision: 1 });
  });

  it("requires a defined stage rule and never infers a real summit", () => {
    expect(planExpeditionStageContribution({ ...input, stageRule: undefined }).status).toBe("rejected");
    expect(planExpeditionStageContribution({ ...input, realSummitClaim: true }).status).toBe("rejected");
    expect(planExpeditionStageContribution({ ...input, activityKind: "indoor_session" }).status).toBe("rejected");
  });

  it("creates a new revision after a revoked contribution", () => {
    expect(planExpeditionStageContribution(input, [{
      id: "contribution-1",
      ownerUserId: "user-1",
      runId: "run-1",
      activityId: "activity-1",
      stageKey: "stage-1",
      ruleVersion: "expedition-v1",
      scoreVersion: "score-v1",
      revision: 1,
      status: "revoked",
    }])).toMatchObject({ status: "create", revision: 2, correctionOfRevision: 1, priorContributionId: "contribution-1" });
  });
});

describe("revision lineage contract", () => {
  it("rejects a prior row id from another owner or identity", async () => {
    const { validateTransactionalRevisionWrite } = await import("../services/stage2LedgerPlanning");
    expect(validateTransactionalRevisionWrite(
      { ownerUserId: "user-1", identityKey: "activity-1:elevation-v1", revision: 2 },
      { id: "credit-2", ownerUserId: "user-2", identityKey: "activity-1:elevation-v1", revision: 1 },
    )).toEqual({ valid: false, reason: "prior owner does not match" });
  });

  it("rejects missing prior revisions", async () => {
    const { validateTransactionalRevisionWrite } = await import("../services/stage2LedgerPlanning");
    expect(validateTransactionalRevisionWrite(
      { ownerUserId: "user-1", identityKey: "activity-1:elevation-v1", revision: 3 },
      { id: "credit-2", ownerUserId: "user-1", identityKey: "activity-1:elevation-v1", revision: 1 },
    )).toEqual({ valid: false, reason: "prior revision must be immediately previous" });
  });

  it("makes concurrent plans deterministic; the unique identity is the database race gate", () => {
    const existing = [{
      id: "credit-1",
      ownerUserId: "user-1",
      activityId: "activity-1",
      ruleVersion: "elevation-v1",
      revision: 1,
      status: "revoked" as const,
    }];
    const first = planPersonalElevationCredit(baseCredit, existing);
    const concurrent = planPersonalElevationCredit(baseCredit, existing);
    expect(first).toEqual(concurrent);
    expect(first).toMatchObject({ status: "create", revision: 2, priorEventId: "credit-1" });
  });
});