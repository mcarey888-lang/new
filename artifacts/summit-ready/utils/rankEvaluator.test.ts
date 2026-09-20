import { describe, expect, it } from "vitest";
import type { EvidenceReference } from "./challengeDomain";
import { evaluateRank } from "./rankEvaluator";

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
  value: 120,
  mountainId: "mountain-1",
  ...overrides,
});

describe("SummitReady rank evaluator", () => {
  it("does not fabricate Trailhead from no evidence", () => {
    const result = evaluateRank({ ownerUserId: "owner", evidence: [] });
    expect(result.currentRank).toBeNull();
    expect(result.nextRank).toBe("Trailhead");
    expect(result.progress).toBe(0);
  });

  it("requires multiple legitimate signals for Trailhead", () => {
    const result = evaluateRank({ ownerUserId: "owner", evidence: [evidence("activity")] });
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
    });
    expect(result.eligibleEvidenceIds).toEqual([]);
    expect(result.excludedEvidence).toHaveLength(6);
  });

  it("uses the authoritative correction and revocation, regardless of arrival order", () => {
    const original = evidence("original", { lineageId: "lineage", value: 1000, correctionVersion: 1 });
    const corrected = evidence("corrected", { lineageId: "lineage", value: 0, correctionVersion: 2, qualificationStatus: "revoked" });
    const first = evaluateRank({ ownerUserId: "owner", evidence: [original, corrected] });
    const second = evaluateRank({ ownerUserId: "owner", evidence: [corrected, original] });
    expect(first).toEqual(second);
    expect(first.eligibleEvidenceIds).toEqual([]);
  });

  it("surfaces unavailable mandatory producers and blocks promotion", () => {
    const result = evaluateRank({
      ownerUserId: "owner",
      evidence: [evidence("activity", { value: 100 })],
      signalAvailability: { eligibleElevation: "unavailable" },
    });
    expect(result.promotionBlocked).toBe(true);
    expect(result.blockedReasons).toContain("metres of eligible elevation is unavailable");
    expect(result.nextRequirements.find((item) => item.signal === "eligibleElevation")?.status).toBe("unavailable");
  });

  it("marks degraded evidence rather than promoting on an uncertain signal", () => {
    const result = evaluateRank({
      ownerUserId: "owner",
      evidence: [evidence("activity", { value: 100 })],
      signalAvailability: { eligibleElevation: "degraded" },
    });
    expect(result.promotionBlocked).toBe(true);
    expect(result.nextRequirements.find((item) => item.signal === "eligibleElevation")?.status).toBe("degraded");
  });
});