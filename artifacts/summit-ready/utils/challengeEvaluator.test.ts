import { describe, expect, it } from "vitest";
import { evaluateAchievement, evaluateChallenge } from "./challengeEvaluator";
import { STAGE_8_ACHIEVEMENTS, STAGE_8_CHALLENGES } from "./challengeCatalogue";
import type { ChallengeDefinition, EvidenceReference } from "./challengeDomain";

const definition = STAGE_8_CHALLENGES[0];
const outdoor = (overrides: Partial<EvidenceReference> = {}): EvidenceReference => ({
  evidenceId: "activity-1",
  ownerUserId: "owner-1",
  sourceType: "canonical_activity",
  sourceId: "activity-1",
  evidenceClass: "trusted_gps_outdoor",
  occurredAt: "2026-06-15T10:00:00.000Z",
  qualificationStatus: "eligible",
  value: 1200,
  distanceKm: 12,
  ...overrides,
});

describe("challenge-domain-v1 evaluator", () => {
  it("allows one activity to progress multiple definitions without duplicate contribution", () => {
    const distance: ChallengeDefinition = {
      ...definition,
      definitionId: "distance",
      family: "hiking_distance",
      unit: "kilometres",
      target: 10,
      eligibility: { ...definition.eligibility, purpose: "eligible_real_outdoor" },
    };
    const elevation = evaluateChallenge("owner-1", definition, [outdoor(), outdoor()], "2026-06");
    const distanceResult = evaluateChallenge("owner-1", distance, [outdoor()], "lifetime");
    expect(elevation.progress.value).toBe(1000);
    expect(distanceResult.progress.value).toBe(10);
    expect(elevation.progress.evidenceIds).toEqual(["activity-1"]);
  });

  it("is deterministic across retries and evidence ordering", () => {
    const first = evaluateChallenge("owner-1", definition, [outdoor({ evidenceId: "b" }), outdoor({ evidenceId: "a", value: 200 })], "2026-06");
    const retry = evaluateChallenge("owner-1", definition, [outdoor({ evidenceId: "a", value: 200 }), outdoor({ evidenceId: "b" })], "2026-06");
    expect(retry).toEqual(first);
  });

  it("rejects cross-owner evidence", () => {
    const result = evaluateChallenge("owner-1", definition, [outdoor({ ownerUserId: "owner-2" })], "2026-06");
    expect(result.reason).toBe("cross_owner_evidence");
    expect(result.progress.status).toBe("unavailable");
  });

  it("keeps manual, indoor and simulated evidence in their explicit lanes", () => {
    expect(evaluateChallenge("owner-1", definition, [outdoor({ evidenceClass: "manual_outdoor" })], "2026-06").reason)
      .toBe("manual_personal_only");
    expect(evaluateChallenge("owner-1", definition, [outdoor({ evidenceClass: "indoor" })], "2026-06").reason)
      .toBe("indoor_personal_only");
    expect(evaluateChallenge("owner-1", definition, [outdoor({ evidenceClass: "simulated_expedition" })], "2026-06").reason)
      .toBe("simulated_expedition_only");
  });

  it("supports simulated Expedition milestones without granting real elevation", () => {
    const expedition = STAGE_8_CHALLENGES.find((item) => item.family === "expedition_milestone")!;
    const result = evaluateChallenge("owner-1", expedition, [outdoor({
      evidenceClass: "simulated_expedition",
      expeditionStageCompleted: true,
      value: 5000,
    })], "expedition-1");
    expect(result.progress.status).toBe("completed");
    expect(result.progress.value).toBe(1);
  });

  it("uses inclusive start and exclusive end boundaries", () => {
    const start = outdoor({ evidenceId: "start", occurredAt: "2026-06-01T00:00:00.000Z" });
    const end = outdoor({ evidenceId: "end", occurredAt: "2026-07-01T00:00:00.000Z" });
    const bounded = { ...definition, window: { ...definition.window, startInclusive: "2026-06-01T00:00:00.000Z", endExclusive: "2026-07-01T00:00:00.000Z" } };
    const result = evaluateChallenge("owner-1", bounded, [start, end], "june");
    expect(result.progress.evidenceIds).toEqual(["start"]);
  });

  it("resolves explicit timezone offsets without using the device clock", () => {
    const bounded = {
      ...definition,
      window: {
        ...definition.window,
        timezone: "Europe/London",
        startInclusive: "2026-06-01T00:00:00+01:00",
        endExclusive: "2026-07-01T00:00:00+01:00",
      },
    };
    const result = evaluateChallenge("owner-1", bounded, [
      outdoor({ evidenceId: "boundary", occurredAt: "2026-05-31T23:00:00.000Z" }),
    ], "june-london");
    expect(result.progress.evidenceIds).toEqual(["boundary"]);
  });

  it("returns pending and unavailable rather than treating missing evidence as zero", () => {
    const pending = evaluateChallenge("owner-1", definition, [outdoor({ qualificationStatus: "pending" })], "2026-06");
    expect(pending.reason).toBe("pending");
    expect(pending.progress.status).toBe("pending");
    const unavailable = evaluateChallenge("owner-1", definition, [], "2026-06");
    expect(unavailable.progress.status).toBe("unavailable");
  });

  it("models corrections and revocations in derived outputs", () => {
    const corrected = evaluateChallenge("owner-1", definition, [outdoor({ correctionVersion: 2 })], "2026-06");
    expect(corrected.progress.correctionVersion).toBe(2);
    const revoked = evaluateChallenge("owner-1", definition, [outdoor({ qualificationStatus: "revoked" })], "2026-06");
    expect(revoked.reason).toBe("activity_revoked");
  });

  it("requires canonical provenance for the first tracked mountain achievement", () => {
    const mountain = STAGE_8_ACHIEVEMENTS[0];
    expect(evaluateAchievement("owner-1", mountain, [outdoor()], "2026-06-15").award).toBeNull();
    const result = evaluateAchievement("owner-1", mountain, [outdoor({
      mountainId: "mountain-1",
      sdeTargetId: "sde:mountain:mountain-1",
    })], "2026-06-15");
    expect(result.award?.awardIdentity).toContain("first-tracked-mountain");
  });

  it("does not award the cumulative elevation achievement before its threshold", () => {
    const achievement = STAGE_8_ACHIEVEMENTS.find((item) => item.achievementId === "first-1000m-elevation")!;
    const result = evaluateAchievement("owner-1", achievement, [outdoor({ value: 999 })], "2026-06-15");
    expect(result.award).toBeNull();
    expect(result.reason).toBe("threshold_not_met");
  });

  it("awards cumulative elevation at the threshold with a retry-stable identity", () => {
    const achievement = STAGE_8_ACHIEVEMENTS.find((item) => item.achievementId === "first-1000m-elevation")!;
    const evidence = [outdoor({ value: 600 }), outdoor({ evidenceId: "activity-2", value: 400 })];
    const first = evaluateAchievement("owner-1", achievement, evidence, "2026-06-15");
    const retry = evaluateAchievement("owner-1", achievement, [...evidence].reverse(), "2026-06-15");
    expect(first.award?.awardIdentity).toBe(retry.award?.awardIdentity);
    expect(first.acceptedEvidenceIds).toEqual(["activity-1", "activity-2"]);
  });

  it("rejects semantic family mismatches, pending, revoked and cross-owner evidence", () => {
    const expedition = STAGE_8_ACHIEVEMENTS.find((item) => item.achievementId === "first-expedition-stage")!;
    expect(evaluateAchievement("owner-1", expedition, [outdoor({ value: 1 })], "2026-06-15").reason)
      .toBe("semantic_mismatch");
    expect(evaluateAchievement("owner-1", expedition, [outdoor({
      evidenceClass: "simulated_expedition",
      qualificationStatus: "pending",
    })], "2026-06-15").reason).toBe("pending");
    expect(evaluateAchievement("owner-1", expedition, [outdoor({
      evidenceClass: "simulated_expedition",
      qualificationStatus: "revoked",
      expeditionStageCompleted: true,
    })], "2026-06-15").reason).toBe("activity_revoked");
    expect(evaluateAchievement("owner-1", expedition, [outdoor({
      ownerUserId: "owner-2",
      evidenceClass: "simulated_expedition",
      expeditionStageCompleted: true,
    })], "2026-06-15").reason).toBe("cross_owner_evidence");
  });

  it("keeps manual, indoor and simulated evidence separated by achievement semantics", () => {
    const elevation = STAGE_8_ACHIEVEMENTS.find((item) => item.achievementId === "first-1000m-elevation")!;
    expect(evaluateAchievement("owner-1", elevation, [outdoor({
      evidenceClass: "manual_outdoor", value: 1000,
    })], "2026-06-15").award).toBeNull();
    expect(evaluateAchievement("owner-1", elevation, [outdoor({
      evidenceClass: "indoor", value: 1000,
    })], "2026-06-15").award).toBeNull();
    expect(evaluateAchievement("owner-1", elevation, [outdoor({
      evidenceClass: "simulated_expedition", value: 1000,
    })], "2026-06-15").award).toBeNull();
  });

  it("requires an explicitly completed training block", () => {
    const training = STAGE_8_ACHIEVEMENTS.find((item) => item.achievementId === "training-block-complete")!;
    expect(evaluateAchievement("owner-1", training, [outdoor({
      sourceType: "training_session",
      evidenceClass: "indoor",
    })], "2026-06-15").reason).toBe("semantic_mismatch");
    expect(evaluateAchievement("owner-1", training, [outdoor({
      sourceType: "training_session",
      evidenceClass: "indoor",
      trainingBlockCompleted: true,
    })], "2026-06-15").award).not.toBeNull();
  });
});