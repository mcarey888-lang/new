import { describe, expect, it } from "vitest";
import type { EvidenceReference } from "./challengeDomain";
import { evaluateRank } from "./rankEvaluator";
import { RANK_EVIDENCE_CONTRACT } from "./rankEvaluator";
import type { RankSignal, RankSignalAvailability } from "./rankDomain";

const available = Object.fromEntries(
  ["eligibleActivities", "eligibleElevation", "distinctMountains", "summitCompletions", "activeWeeks", "expeditionMilestones"]
    .map((signal) => [signal, "available"]),
) as Record<RankSignal, RankSignalAvailability>;

const evidence = (id: string, overrides: Partial<EvidenceReference> = {}): EvidenceReference => ({
  evidenceId: id,
  lineageId: id,
  ownerUserId: "owner",
  sourceType: "canonical_activity",
  sourceId: id,
  activityId: id,
  evidenceClass: "trusted_gps_outdoor",
  occurredAt: "2026-01-05T12:00:00Z",
  qualificationStatus: "eligible",
  qualificationPurpose: RANK_EVIDENCE_CONTRACT.outdoor.purpose,
  qualificationRuleVersion: RANK_EVIDENCE_CONTRACT.outdoor.ruleVersion,
  value: 120,
  mountainId: "mountain-1",
  ...overrides,
});

describe("SummitReady rank evaluator", () => {
  it("does not fabricate Trailhead from no evidence", () => {
    const result = evaluateRank({ ownerUserId: "owner", evidence: [], signalAvailability: available });
    expect(result.currentRank).toBeNull();
    expect(result.nextRank).toBe("Trailhead");
    expect(result.progress).toBe(0);
  });

  it("requires multiple legitimate signals for Trailhead", () => {
    const result = evaluateRank({
      ownerUserId: "owner",
      evidence: [
        evidence("activity"),
        evidence("elevation", {
          activityId: "activity",
          qualificationPurpose: RANK_EVIDENCE_CONTRACT.elevation.purpose,
          qualificationRuleVersion: RANK_EVIDENCE_CONTRACT.elevation.ruleVersion,
        }),
      ],
      signalAvailability: available,
    });
    expect(result.currentRank).toBe("Trailhead");
    expect(result.nextRank).toBe("Hillwalker");
  });

  it("excludes manual, indoor, simulated, pending, cross-owner, and unprovenanced summit evidence", () => {
    const result = evaluateRank({
      ownerUserId: "owner",
      evidence: [
        evidence("manual", { evidenceClass: "manual_outdoor" }),
        evidence("indoor", { evidenceClass: "indoor" }),
        evidence("sim", { evidenceClass: "simulated_expedition", expeditionStageCompleted: true }),
        evidence("pending", { qualificationStatus: "pending" }),
        evidence("other", { ownerUserId: "other" }),
        evidence("summit-without-proof", { evidenceClass: "canonical_summit", summitCompleted: true }),
      ],
      signalAvailability: available,
    });
    expect(result.eligibleEvidenceIds).toEqual([]);
    expect(result.excludedEvidence).toHaveLength(6);
  });

  it("uses the authoritative correction and revocation, regardless of arrival order", () => {
    const original = evidence("original", { lineageId: "lineage", value: 1000, correctionVersion: 1 });
    const corrected = evidence("corrected", { lineageId: "lineage", value: 0, correctionVersion: 2, qualificationStatus: "revoked" });
    const first = evaluateRank({ ownerUserId: "owner", evidence: [original, corrected], signalAvailability: available });
    const second = evaluateRank({ ownerUserId: "owner", evidence: [corrected, original], signalAvailability: available });
    expect(first).toEqual(second);
    expect(first.eligibleEvidenceIds).toEqual([]);
  });

  it("surfaces unavailable mandatory producers and blocks promotion", () => {
    const result = evaluateRank({
      ownerUserId: "owner",
      evidence: [evidence("activity", { value: 100 })],
      signalAvailability: { ...available, eligibleElevation: "unavailable" },
    });
    expect(result.promotionBlocked).toBe(true);
    expect(result.blockedReasons).toContain("metres of eligible elevation is unavailable");
    expect(result.nextRequirements.find((item) => item.signal === "eligibleElevation")?.status).toBe("unavailable");
  });

  it("marks degraded evidence rather than promoting on an uncertain signal", () => {
    const result = evaluateRank({
      ownerUserId: "owner",
      evidence: [evidence("activity", { value: 100 })],
      signalAvailability: { ...available, eligibleElevation: "degraded" },
    });
    expect(result.promotionBlocked).toBe(true);
    expect(result.nextRequirements.find((item) => item.signal === "eligibleElevation")?.status).toBe("degraded");
  });

  it("does not promote when a degraded producer meets its numeric threshold", () => {
    const result = evaluateRank({
      ownerUserId: "owner",
      evidence: [
        evidence("activity"),
        evidence("elevation", {
          activityId: "activity",
          qualificationPurpose: RANK_EVIDENCE_CONTRACT.elevation.purpose,
          qualificationRuleVersion: RANK_EVIDENCE_CONTRACT.elevation.ruleVersion,
          value: 100,
        }),
      ],
      signalAvailability: { ...available, eligibleElevation: "degraded" },
    });
    expect(result.currentRank).toBeNull();
    expect(result.promotionBlocked).toBe(true);
    expect(result.nextRequirements.find((item) => item.signal === "eligibleElevation")?.status).toBe("degraded");
  });

  it("fails closed when runtime input omits a producer availability", () => {
    const incomplete = { ...available } as Partial<Record<RankSignal, RankSignalAvailability>>;
    delete incomplete.eligibleElevation;
    const result = evaluateRank({
      ownerUserId: "owner",
      evidence: [
        evidence("activity"),
        evidence("elevation", {
          activityId: "activity",
          qualificationPurpose: RANK_EVIDENCE_CONTRACT.elevation.purpose,
          qualificationRuleVersion: RANK_EVIDENCE_CONTRACT.elevation.ruleVersion,
          value: 100,
        }),
      ],
      signalAvailability: incomplete as Record<RankSignal, RankSignalAvailability>,
    });
    expect(result.currentRank).toBeNull();
    expect(result.nextRequirements.find((item) => item.signal === "eligibleElevation")?.status).toBe("unavailable");
  });

  it("rejects forged summit and expedition booleans on ordinary GPS evidence", () => {
    const result = evaluateRank({
      ownerUserId: "owner",
      evidence: [evidence("forged", {
        summitCompleted: true,
        expeditionStageCompleted: true,
        mountainId: "forged-mountain",
      })],
      signalAvailability: available,
    });
    expect(result.nextRequirements.find((item) => item.signal === "summitCompletions")?.value).toBeUndefined();
    expect(result.eligibleEvidenceIds).toEqual(["forged"]);
    expect(result.currentRank).toBeNull();
  });

  it("rejects generic values with the wrong qualification purpose", () => {
    const result = evaluateRank({
      ownerUserId: "owner",
      evidence: [evidence("wrong-purpose", {
        value: 10000,
        qualificationPurpose: "eligible_real_elevation",
        qualificationRuleVersion: "canonical-activity-v1",
      })],
      signalAvailability: available,
    });
    expect(result.currentRank).toBeNull();
    expect(result.eligibleEvidenceIds).toEqual([]);
  });
});