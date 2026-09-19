import { describe, expect, it } from "vitest";
import {
  CANONICAL_QUALIFICATION_RULE_VERSION,
  evaluateCanonicalQualification,
  evaluateCanonicalQualifications,
  hasSdeReference,
  type QualificationEvaluatorActivity,
} from "../services/canonicalQualificationEvaluator";

const baseActivity: QualificationEvaluatorActivity = {
  id: "activity-1",
  lifecycle: "synced",
  evidenceClassification: "gps_recorded",
  evidenceState: "quality_accepted",
  recordedAscentM: 500,
  validatedAscentM: 480,
  links: [],
};

describe("canonical qualification evaluator", () => {
  it("accepts quality GPS evidence for personal history and readiness", () => {
    const history = evaluateCanonicalQualification(baseActivity, "personal_history");
    const readiness = evaluateCanonicalQualification(baseActivity, "readiness");
    expect(history.status).toBe("eligible");
    expect(history.persistablePurpose).toBe("personal_history");
    expect(readiness.status).toBe("eligible");
    expect(readiness.ruleVersion).toBe(CANONICAL_QUALIFICATION_RULE_VERSION);
    expect(readiness.creditedMetric).toBe(480);
  });

  it("keeps manual evidence pending and never upgrades its evidence class", () => {
    const result = evaluateCanonicalQualification({
      ...baseActivity,
      evidenceClassification: "estimated_manual",
      evidenceState: "unverified_manual",
    }, "readiness");
    expect(result.status).toBe("pending");
    expect(result.reasonCodes).toContain("manual_evidence_requires_rule");
    expect(result.evidenceClass).toBe("unverified_manual");
    expect(result.creditedMetric).toBeNull();
  });

  it("keeps indoor training pending and untrusted data out of readiness", () => {
    const indoor = evaluateCanonicalQualification({
      ...baseActivity,
      evidenceClassification: "indoor_training",
      evidenceState: "unverified_manual",
    }, "readiness");
    const untrusted = evaluateCanonicalQualification({
      ...baseActivity,
      evidenceClassification: "unavailable_untrusted",
      evidenceState: "unverified_manual",
    }, "readiness");
    expect(indoor.status).toBe("pending");
    expect(indoor.reasonCodes).toContain("indoor_evidence_requires_rule");
    expect(untrusted.status).toBe("ineligible");
    expect(untrusted.reasonCodes).toContain("unavailable_or_untrusted_evidence");
  });

  it("requires an Expedition link and keeps that purpose output-only", () => {
    const withoutLink = evaluateCanonicalQualification(
      baseActivity,
      "expedition_progress",
    );
    const withLink = evaluateCanonicalQualification({
      ...baseActivity,
      links: [{ linkType: "expedition_stage", targetId: "stage-1" }],
    }, "expedition_progress");
    expect(withoutLink.status).toBe("ineligible");
    expect(withoutLink.reasonCodes).toContain("missing_expedition_link");
    expect(withLink.status).toBe("eligible");
    expect(withLink.persistence).toBe("read_only_output");
    expect(withLink.persistablePurpose).toBeNull();
  });

  it("requires verified SDE-linked evidence for real summit evidence", () => {
    const result = evaluateCanonicalQualification({
      ...baseActivity,
      evidenceState: "verified_summit_ascent",
      links: [{
        linkType: "canonical_hill",
        targetId: "sde:mountain:f5dd0ef8-7c31-4af4-a9ed-e264753b39c6",
      }],
    }, "real_summit_evidence");
    expect(result.status).toBe("eligible");
    expect(result.persistablePurpose).toBe("real_summit_evidence");
  });

  it("strictly parses SDE references and requires matching link types", () => {
    const validMountain = {
      ...baseActivity,
      links: [{
        linkType: "canonical_hill" as const,
        targetId: "sde:mountain:f5dd0ef8-7c31-4af4-a9ed-e264753b39c6",
      }],
    };
    expect(hasSdeReference(validMountain)).toBe(true);
    expect(hasSdeReference({
      ...validMountain,
      links: [{
        linkType: "canonical_route",
        targetId: validMountain.links[0].targetId,
      }],
    })).toBe(false);
    expect(hasSdeReference({
      ...validMountain,
      links: [{
        linkType: "canonical_hill",
        targetId: "sde:mountain:not-a-uuid",
      }],
    })).toBe(false);
    expect(hasSdeReference({
      ...validMountain,
      links: [{
        linkType: "canonical_route",
        targetId: "sde:route:not-a-version",
      }],
    })).toBe(false);
  });

  it("requires a challenge link and never enables competitive output", () => {
    const challenge = evaluateCanonicalQualification({
      ...baseActivity,
      links: [{ linkType: "challenge", targetId: "challenge-1" }],
    }, "challenge_eligibility");
    const competitive = evaluateCanonicalQualification(baseActivity, "competitive_elevation");
    expect(challenge.status).toBe("eligible");
    expect(challenge.reasonCodes).toContain("purpose_is_output_only");
    expect(competitive.status).toBe("ineligible");
    expect(competitive.reasonCodes).toContain("competitive_evidence_not_enabled");
    expect(competitive.persistence).toBe("read_only_output");
  });

  it("returns deterministic, idempotent output with supersession metadata", () => {
    const first = evaluateCanonicalQualification(baseActivity, "readiness", {
      supersedesRuleVersions: ["s2-c05-v1", "s2-c04-v1"],
    });
    const second = evaluateCanonicalQualification(baseActivity, "readiness", {
      supersedesRuleVersions: ["s2-c04-v1", "s2-c05-v1"],
    });
    expect(first).toEqual(second);
    expect(first.supersessionKey).toBe(`activity-1:readiness:${CANONICAL_QUALIFICATION_RULE_VERSION}`);
    expect(first.supersedesRuleVersions).toEqual(["s2-c04-v1", "s2-c05-v1"]);
  });

  it("marks deleted or revoked activities revoked", () => {
    for (const change of [{ lifecycle: "deleted" as const }, { revoked: true }]) {
      const result = evaluateCanonicalQualification({
        ...baseActivity,
        ...change,
      }, "personal_history");
      expect(result.status).toBe("revoked");
      expect(result.creditedMetric).toBeNull();
    }
  });

  it("evaluates all requested purposes without persisting unsupported ones", () => {
    const results = evaluateCanonicalQualifications(baseActivity);
    expect(results).toHaveLength(7);
    expect(results.filter((result) => result.persistence === "phase1_compatible"))
      .toHaveLength(4);
    expect(results.find((result) => result.purpose === "challenge_eligibility")
      ?.persistablePurpose).toBeNull();
  });
});
