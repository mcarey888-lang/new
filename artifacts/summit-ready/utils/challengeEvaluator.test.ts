import { describe, expect, it } from "vitest";
import { evaluateAchievement, evaluateChallenge, resolveCalendarMonth, resolveCalendarMonthForInstant, resolveRollingWindow } from "./challengeEvaluator";
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
  qualificationPurpose: "eligible_real_elevation",
  qualificationRuleVersion: "elevation-bank-v1",
  value: 1200,
  distanceKm: 12,
  ...overrides,
});

describe("challenge-domain-v1 evaluator", () => {
  it("derives calendar buckets in the supplied IANA timezone", () => {
    expect(resolveCalendarMonthForInstant("2026-03-01T00:30:00.000Z", "Europe/London").windowKey).toBe("2026-03");
    expect(resolveCalendarMonthForInstant("2026-02-28T23:30:00.000Z", "Europe/London").windowKey).toBe("2026-02");
    expect(resolveCalendarMonth(2014, 8, "Africa/Cairo").endExclusive).toBe("2014-08-31T21:00:00.000Z");
    expect(resolveCalendarMonth(2008, 6, "Africa/Casablanca").endExclusive).toBe("2008-06-30T23:00:00.000Z");
    expect(resolveCalendarMonth(2026, 12, "Europe/London").endExclusive).toBe("2027-01-01T00:00:00.000Z");
    expect(resolveRollingWindow("2026-06-29T12:00:00.000Z", 28, "UTC")).toMatchObject({
      startInclusive: "2026-06-01T12:00:00.000Z",
      endExclusive: "2026-06-29T12:00:00.000Z",
    });
  });

  it("uses only the latest correction for a stable evidence lineage", () => {
    const result = evaluateChallenge("owner-1", definition, [
      outdoor({ evidenceId: "activity-1-r1", lineageId: "activity-1", correctionVersion: 1, value: 1200 }),
      outdoor({ evidenceId: "activity-1-r2", lineageId: "activity-1", correctionVersion: 2, value: 100 }),
    ], "2026-06");
    expect(result.progress.value).toBe(100);
    expect(result.progress.evidenceIds).toEqual(["activity-1-r2"]);
  });

  it("selects correction and revocation deterministically regardless of input order", () => {
    const corrected = outdoor({ lineageId: "stable", correctionVersion: 2, sourceCursor: "2026-06-02T00:00:00Z", value: 800 });
    const revoked = outdoor({ lineageId: "stable", correctionVersion: 2, sourceCursor: "2026-06-02T00:00:00Z", qualificationStatus: "revoked", value: 0 });
    const first = evaluateChallenge("owner-1", definition, [corrected, revoked], "2026-06");
    const second = evaluateChallenge("owner-1", definition, [revoked, corrected], "2026-06");
    expect(first.progress.status).toBe("revoked");
    expect(second.progress.status).toBe("revoked");
    expect(first.progress.evidenceIds).toEqual(second.progress.evidenceIds);
  });

  it("marks a dependent progress revoked when the latest lineage revision is revoked", () => {
    const result = evaluateChallenge("owner-1", definition, [
      outdoor({ evidenceId: "activity-1-r2", lineageId: "activity-1", correctionVersion: 2, qualificationStatus: "revoked" }),
    ], "2026-06");
    expect(result.progress.status).toBe("revoked");
    expect(result.reason).toBe("activity_revoked");
  });

  it("replaces a rebucketed correction rather than coexisting in the contribution set", () => {
    const result = evaluateChallenge("owner-1", definition, [
      outdoor({ evidenceId: "activity-1-r1", lineageId: "activity-1", correctionVersion: 1, windowBucketKey: "2026-05" }),
      outdoor({ evidenceId: "activity-1-r2", lineageId: "activity-1", correctionVersion: 2, windowBucketKey: "2026-06" }),
    ], "2026-06");
    expect(result.progress.evidenceIds).toEqual(["activity-1-r2"]);
  });
  it("allows one activity to progress multiple definitions without duplicate contribution", () => {
    const distance: ChallengeDefinition = {
      ...definition,
      definitionId: "distance",
      family: "hiking_distance",
      unit: "kilometres",
      target: 10,
      eligibility: { ...definition.eligibility, purpose: "eligible_real_outdoor", requiredQualificationRuleVersion: "canonical-activity-v1" },
    };
    const elevation = evaluateChallenge("owner-1", definition, [outdoor(), outdoor()], "2026-06");
    const distanceResult = evaluateChallenge("owner-1", distance, [outdoor({ qualificationPurpose: "eligible_real_outdoor", qualificationRuleVersion: "canonical-activity-v1" })], "lifetime");
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
      qualificationPurpose: "expedition_only",
      qualificationRuleVersion: "expedition-consequence-v1",
      expeditionStageCompleted: true,
      value: 5000,
    })], "expedition-1");
    expect(result.progress.status).toBe("unavailable");
    expect(result.progress.value).toBe(0);
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
      qualificationPurpose: "canonical",
      qualificationRuleVersion: "canonical-qualification-v1",
      provenanceHash: "sha256:canonical-mountain-1",
    })], "2026-06-15");
    expect(result.reason).toBe("unavailable");
    expect(result.award).toBeNull();
  });

  it("uses one aggregate identity while exposing stable contribution identities", () => {
    const window = resolveCalendarMonth(2026, 6, "Europe/London");
    const first = evaluateChallenge("owner-1", definition, [
      outdoor({ evidenceId: "a", windowBucketKey: window.windowKey, qualificationPurpose: "eligible_real_elevation" }),
    ], window);
    const second = evaluateChallenge("owner-1", definition, [
      outdoor({ evidenceId: "a", windowBucketKey: window.windowKey, qualificationPurpose: "eligible_real_elevation" }),
      outdoor({ evidenceId: "b", windowBucketKey: window.windowKey, qualificationPurpose: "eligible_real_elevation" }),
    ], window);
    expect(first.progress.progressIdentity).toBe(second.progress.progressIdentity);
    expect(first.progress.contributionIdentities).toEqual([
      "owner-1:monthly-elevation-1000:challenge-domain-v1:monthly-elevation-v1:2026-06:a",
    ]);
    expect(second.progress.contributionIdentities).toContain(
      "owner-1:monthly-elevation-1000:challenge-domain-v1:monthly-elevation-v1:2026-06:b",
    );
  });

  it("requires an explicit evidence bucket for resolved windows", () => {
    const window = resolveCalendarMonth(2026, 6, "Europe/London");
    const result = evaluateChallenge("owner-1", definition, [
      outdoor({ qualificationPurpose: "eligible_real_elevation" }),
    ], window);
    expect(["unavailable", "outside_window"]).toContain(result.reason);
    expect(result.acceptedEvidenceIds).toEqual([]);
  });

  it("keeps a non-repeatable award identity independent of later evidence", () => {
    const achievement = STAGE_8_ACHIEVEMENTS[1];
    const first = evaluateAchievement("owner-1", achievement, [
      outdoor({ evidenceId: "a", value: 1000 }),
    ], "2026-06-15T10:00:00.000Z");
    const later = evaluateAchievement("owner-1", achievement, [
      outdoor({ evidenceId: "a", value: 1000 }),
      outdoor({ evidenceId: "b", value: 1000 }),
    ], "2026-06-16T10:00:00.000Z");
    expect(first.award?.awardIdentity).toBe(later.award?.awardIdentity);
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
      .toBe("unavailable");
    expect(evaluateAchievement("owner-1", expedition, [outdoor({
      evidenceClass: "simulated_expedition",
      qualificationStatus: "pending",
    })], "2026-06-15").reason).toBe("unavailable");
    expect(evaluateAchievement("owner-1", expedition, [outdoor({
      evidenceClass: "simulated_expedition",
      qualificationStatus: "revoked",
      expeditionStageCompleted: true,
    })], "2026-06-15").reason).toBe("unavailable");
    expect(evaluateAchievement("owner-1", expedition, [outdoor({
      ownerUserId: "owner-2",
      evidenceClass: "simulated_expedition",
      expeditionStageCompleted: true,
    })], "2026-06-15").reason).toBe("unavailable");
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
    })], "2026-06-15").reason).toBe("unavailable");
    expect(evaluateAchievement("owner-1", training, [outdoor({
      sourceType: "training_session",
      evidenceClass: "indoor",
      qualificationPurpose: "training",
      qualificationRuleVersion: "training-v1",
      trainingBlockCompleted: true,
    })], "2026-06-15").award).toBeNull();
  });
});