import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  planExpeditionStageContribution,
  planPersonalElevationCredit,
  toPersistedElevationEvidenceClass,
} from "../services/stage2LedgerPlanning";
import { canonicalActivityBridgeEnabled } from "../services/canonicalActivity";
import {
  assertStage2LedgerWritesAvailable,
  withFreshTransactionRetry,
  writeExpeditionStageContributionWithClient,
} from "../services/stage2Ledgers";

const baseCredit = {
  ownerUserId: "user-1",
  activityId: "activity-1",
  evidenceClass: "recorded_unverified" as const,
  creditedAscentM: 600,
  ruleVersion: "elevation-v1",
  effectiveAt: new Date("2026-09-19T10:00:00Z"),
};

describe("personal elevation credit planning", () => {
  it("maps only persisted evidence classes to personal-credit evidence", () => {
    expect(toPersistedElevationEvidenceClass("recorded_unverified")).toBe("recorded_unverified");
    expect(toPersistedElevationEvidenceClass("quality_accepted")).toBe("quality_accepted");
    expect(toPersistedElevationEvidenceClass("verified_activity")).toBe("verified_activity");
    expect(toPersistedElevationEvidenceClass("unverified_manual")).toBeNull();
    expect(toPersistedElevationEvidenceClass("indoor_training")).toBeNull();
    expect(toPersistedElevationEvidenceClass("unavailable_untrusted")).toBeNull();
  });

  it("derives identity from activity and rule, preventing context double-credit", () => {
    expect(planPersonalElevationCredit(baseCredit).status).toBe("create");
    expect(planPersonalElevationCredit(baseCredit, [{
      id: "credit-1",
      ownerUserId: "user-1",
      activityId: "activity-1",
      ruleVersion: "elevation-v1",
      revision: 1,
      status: "credited",
       creditedAscentM: 600,
       evidenceClass: "recorded_unverified",
       effectiveAt: new Date("2026-09-19T10:00:00Z"),
    }])).toEqual({ status: "deduplicated", revision: 1 });
  });

  it("keeps one effective identity regardless of context links", () => {
    const existing = [{
      id: "credit-1",
      ownerUserId: "user-1",
      activityId: "activity-1",
      ruleVersion: "elevation-v1",
      revision: 1,
      status: "credited" as const,
       creditedAscentM: 600,
       evidenceClass: "recorded_unverified" as const,
       effectiveAt: new Date("2026-09-19T10:00:00Z"),
    }];
    expect(planPersonalElevationCredit({ ...baseCredit, correction: false }, existing))
      .toEqual({ status: "deduplicated", revision: 1 });
    expect(planPersonalElevationCredit({ ...baseCredit, ownerUserId: "user-2" }, existing).status)
      .toBe("create");
  });

  it("rejects manual, indoor, and unavailable evidence", () => {
    for (const evidenceClass of ["unverified_manual", "indoor_training", "unavailable_untrusted"] as const) {
      expect(planPersonalElevationCredit({ ...baseCredit, evidenceClass }).status).toBe("rejected");
    }
  });

  it("creates a new revision for correction/revocation after a prior event", () => {
    expect(planPersonalElevationCredit({ ...baseCredit, revocation: true }, [{
      id: "credit-1",
      ownerUserId: "user-1",
      activityId: "activity-1",
      ruleVersion: "elevation-v1",
      revision: 1,
       status: "credited",
       creditedAscentM: 600,
       evidenceClass: "recorded_unverified",
       effectiveAt: new Date("2026-09-19T10:00:00Z"),
    }])).toMatchObject({ status: "create", revision: 2, correctionOfRevision: 1, priorEventId: "credit-1" });
  });

  it("deduplicates identical correction/revocation retries but appends changed corrections", () => {
    const corrected = { ...baseCredit, creditedAscentM: 700, correction: true };
    const existing = [{
      id: "credit-2",
      ownerUserId: "user-1",
      activityId: "activity-1",
      ruleVersion: "elevation-v1",
      revision: 2,
      status: "corrected" as const,
      creditedAscentM: 700,
      evidenceClass: "recorded_unverified" as const,
      effectiveAt: corrected.effectiveAt,
    }];
    expect(planPersonalElevationCredit(corrected, existing))
      .toEqual({ status: "deduplicated", revision: 2 });
    expect(planPersonalElevationCredit({ ...corrected, creditedAscentM: 701 }, existing))
      .toMatchObject({ status: "create", revision: 3 });
  });
});

describe("canonical bridge activation", () => {
  it("is disabled unless explicitly enabled", () => {
    const previous = process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED;
    delete process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED;
    expect(canonicalActivityBridgeEnabled()).toBe(false);
    process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED = "false";
    expect(canonicalActivityBridgeEnabled()).toBe(false);
    process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED = "true";
    expect(canonicalActivityBridgeEnabled()).toBe(true);
    if (previous === undefined) delete process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED;
    else process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED = previous;
  });
});

describe("development-only ledger migration contract", () => {
  it("keeps owner-safe lineage and simulated-only constraints additive", () => {
    const migration = readFileSync(resolve(process.cwd(), "../../lib/db/migrations/0002_stage2_activity_ledgers.sql"), "utf8");
    expect(migration).toContain("personal_elevation_credit_events_activity_owner_fk");
    expect(migration).toContain("expedition_stage_contributions_run_owner_fk");
    expect(migration).toContain("expedition_stage_contributions_activity_owner_fk");
    expect(migration).toContain("chk_expedition_contribution_simulated");
    expect(migration).toContain("personal_elevation_credit_events_effective_idx");
    expect(migration).toContain("expedition_stage_contributions_effective_idx");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS");
    expect(migration).not.toMatch(/\b(DROP|TRUNCATE|DELETE FROM)\b/i);
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
    expeditionId: "expedition-1",
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
       acceptedMetric: 600,
       acceptedElevationM: 600,
    }])).toEqual({ status: "deduplicated", revision: 1 });
  });

  it("requires a defined stage rule and never infers a real summit", () => {
    expect(planExpeditionStageContribution({ ...input, stageRule: undefined }).status).toBe("rejected");
    expect(planExpeditionStageContribution({ ...input, realSummitClaim: true }).status).toBe("rejected");
    expect(planExpeditionStageContribution({ ...input, activityKind: "indoor_session" }).status).toBe("rejected");
  });

  it("creates a new revision after a revoked contribution", () => {
    expect(planExpeditionStageContribution({ ...input, revocation: true }, [{
      id: "contribution-1",
      ownerUserId: "user-1",
      runId: "run-1",
      activityId: "activity-1",
      stageKey: "stage-1",
      ruleVersion: "expedition-v1",
      scoreVersion: "score-v1",
      revision: 1,
       status: "accepted",
       acceptedMetric: 600,
       acceptedElevationM: 600,
    }])).toMatchObject({
      status: "create",
      revision: 2,
      correctionOfRevision: 1,
      priorContributionId: "contribution-1",
      contributionStatus: "revoked",
      simulatedCompletion: true,
    });
  });

  it("deduplicates identical Expedition correction/revocation retries", () => {
    const existing = [{
      id: "contribution-2",
      ownerUserId: "user-1",
      runId: "run-1",
      activityId: "activity-1",
      stageKey: "stage-1",
      ruleVersion: "expedition-v1",
      scoreVersion: "score-v1",
      revision: 2,
      status: "corrected" as const,
      acceptedMetric: 600,
      acceptedElevationM: 600,
    }];
    expect(planExpeditionStageContribution({ ...input, correction: true }, existing))
      .toEqual({ status: "deduplicated", revision: 2 });
    expect(planExpeditionStageContribution({
      ...input,
      correction: true,
      acceptedMetric: 601,
    }, existing)).toMatchObject({ status: "create", revision: 3 });
  });
});

describe("revision lineage contract", () => {
  it("restarts a fresh transaction attempt only for unique conflicts", async () => {
    let transactionAttempts = 0;
    const operationAttempts: number[] = [];
    const result = await withFreshTransactionRetry(
      async (operation) => {
        transactionAttempts += 1;
        if (transactionAttempts === 1) {
          throw { code: "23505", constraint: "personal_elevation_credit_events_identity_uidx" };
        }
        return operation({} as never);
      },
      async () => {
        operationAttempts.push(transactionAttempts);
        return "created";
      },
      ["personal_elevation_credit_events_identity_uidx"],
    );
    expect(result).toBe("created");
    expect(transactionAttempts).toBe(2);
    expect(operationAttempts).toEqual([2]);
  });

  it("does not retry non-unique transaction failures", async () => {
    let transactionAttempts = 0;
    await expect(withFreshTransactionRetry(
      async () => {
        transactionAttempts += 1;
        throw new Error("serialization failure");
      },
      async () => "unreachable",
      [],
    )).rejects.toThrow("serialization failure");
    expect(transactionAttempts).toBe(1);
  });

  it("does not retry an unrelated unique constraint", async () => {
    let transactionAttempts = 0;
    await expect(withFreshTransactionRetry(
      async () => {
        transactionAttempts += 1;
        throw {
          code: "23505",
          constraint: "unrelated_business_constraint",
        };
      },
      async () => "unreachable",
      ["personal_elevation_credit_events_identity_uidx"],
    )).rejects.toMatchObject({
      code: "23505",
      constraint: "unrelated_business_constraint",
    });
    expect(transactionAttempts).toBe(1);
  });

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
      creditedAscentM: 0,
      evidenceClass: "recorded_unverified" as const,
      effectiveAt: new Date("2026-09-19T10:00:00Z"),
    }];
    const first = planPersonalElevationCredit(baseCredit, existing);
    const concurrent = planPersonalElevationCredit(baseCredit, existing);
    expect(first).toEqual(concurrent);
    expect(first).toMatchObject({ status: "create", revision: 2, priorEventId: "credit-1" });
  });
});

describe("Stage 2 ledger availability gate", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousEnabled = process.env.STAGE2_LEDGER_ENABLED;

  it("allows explicitly enabled test writes", () => {
    process.env.NODE_ENV = "test";
    process.env.STAGE2_LEDGER_ENABLED = "true";
    expect(() => assertStage2LedgerWritesAvailable()).not.toThrow();
  });

  it("blocks production even when the flag is true", () => {
    process.env.NODE_ENV = "production";
    process.env.STAGE2_LEDGER_ENABLED = "true";
    expect(() => assertStage2LedgerWritesAvailable()).toThrow(/disabled in production/);
  });

  it("blocks a non-production write when schema availability is false", () => {
    process.env.NODE_ENV = "test";
    process.env.STAGE2_LEDGER_ENABLED = "false";
    expect(() => assertStage2LedgerWritesAvailable()).toThrow(/schema availability gate/);
  });

  afterAll(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousEnabled === undefined) delete process.env.STAGE2_LEDGER_ENABLED;
    else process.env.STAGE2_LEDGER_ENABLED = previousEnabled;
  });
});

describe("Expedition run binding", () => {
  it("rejects a same-owner run bound to another expedition before writing", async () => {
    process.env.NODE_ENV = "test";
    process.env.STAGE2_LEDGER_ENABLED = "true";
    let inserts = 0;
    const emptySelect = () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    });
    const client = {
      select: emptySelect,
      insert: () => {
        inserts += 1;
        throw new Error("unexpected insert");
      },
    } as never;
    const result = await writeExpeditionStageContributionWithClient(client, {
      ownerUserId: "user-1",
      runId: "run-1",
      expeditionId: "expedition-2",
      activityId: "activity-1",
      stageRule,
      activityKind: "outdoor_hike",
      evidenceClass: "recorded_unverified",
      acceptedMetric: 600,
      acceptedElevationM: 600,
    });
    expect(result).toMatchObject({ status: "rejected" });
    expect(inserts).toBe(0);
  });
});