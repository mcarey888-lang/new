import { describe, expect, it } from "vitest";
import { createChallengeProjection } from "./challengeProjection";
import { deriveStage8Consequence } from "./stage8Consequence";

describe("Stage 8 consequence derivation", () => {
  it("confirms only transitions caused by the current evidence", () => {
    const before = createChallengeProjection("owner");
    const after = {
      ...before,
      progress: {
        "owner:def:challenge-domain-v1:rule:window": {
          ownerUserId: "owner", definitionId: "def", definitionVersion: "challenge-domain-v1",
          windowKey: "window", status: "completed" as const, value: 1, target: 1,
          evidenceIds: ["current"], evaluationVersion: "rule", correctionVersion: 0,
          progressIdentity: "owner:def:challenge-domain-v1:rule:window",
        },
      },
    };
    expect(deriveStage8Consequence("current", before, after, { def: "Current challenge" }, {}, false))
      .toMatchObject({ status: "confirmed", challengeTitles: ["Current challenge"] });
    expect(deriveStage8Consequence("current", after, after, { def: "Current challenge" }, {}, false))
      .toMatchObject({ status: "unavailable", challengeTitles: [], achievementTitles: [] });
  });

  it("does not repeat unrelated prior awards", () => {
    const before = createChallengeProjection("owner");
    const award = {
      awardIdentity: "owner:prior:challenge-domain-v1:rule", ownerUserId: "owner",
      achievementId: "prior", achievementVersion: "challenge-domain-v1" as const,
      status: "confirmed" as const, evidenceIds: ["old"], earnedAt: "2026-01-01",
      ruleVersion: "rule", correctionVersion: 0,
    };
    const after = { ...before, awards: { [award.awardIdentity]: award } };
    expect(deriveStage8Consequence("current", after, after, {}, { prior: "Prior" }, false).achievementTitles).toEqual([]);
  });
});