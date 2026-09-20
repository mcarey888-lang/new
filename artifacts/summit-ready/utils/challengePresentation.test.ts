import { describe, expect, it } from "vitest";
import { STAGE_8_ACHIEVEMENTS, STAGE_8_CHALLENGES } from "./challengeCatalogue";
import { buildChallengePresentation } from "./challengePresentation";

describe("challenge presentation adapter", () => {
  it("returns empty when no local consequence is known", () => {
    const result = buildChallengePresentation({
      challengeDefinitions: STAGE_8_CHALLENGES,
      achievementDefinitions: STAGE_8_ACHIEVEMENTS,
    });
    expect(result.status).toBe("empty");
    expect(result.challenges).toHaveLength(STAGE_8_CHALLENGES.length);
  });

  it("combines confirmed local challenges and achievements", () => {
    const result = buildChallengePresentation({
      challengeDefinitions: STAGE_8_CHALLENGES,
      achievementDefinitions: STAGE_8_ACHIEVEMENTS,
      localChallenges: [{ challengeId: STAGE_8_CHALLENGES[0].definitionId, progress: 1000, target: 1000, completed: true }],
      localAchievements: [{ achievementId: STAGE_8_ACHIEVEMENTS[0].achievementId, status: "confirmed" }],
    });
    expect(result.status).toBe("confirmed");
    expect(result.achievements[0].state).toBe("confirmed");
  });

  it("keeps offline pending state honest", () => {
    const result = buildChallengePresentation({
      challengeDefinitions: STAGE_8_CHALLENGES,
      achievementDefinitions: STAGE_8_ACHIEVEMENTS,
      localChallenges: [{ challengeId: STAGE_8_CHALLENGES[0].definitionId, progress: 0, target: 1000, completed: false, pending: true }],
      localAchievements: [{ achievementId: STAGE_8_ACHIEVEMENTS[0].achievementId, status: "pending" }],
    });
    expect(result.status).toBe("pending");
    expect(result.achievements[0].state).toBe("pending");
  });
});