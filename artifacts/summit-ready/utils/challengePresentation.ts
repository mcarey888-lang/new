import type { AchievementDefinition, ChallengeDefinition } from "./challengeDomain";

export type LocalChallengePresentation = {
  challengeId: string;
  progress: number;
  target: number;
  completed: boolean;
  pending?: boolean;
};

export type LocalAchievementPresentation = {
  achievementId: string;
  status: "confirmed" | "pending";
};

export type ChallengePresentation = {
  status: "confirmed" | "pending" | "empty";
  challenges: readonly {
    definition: ChallengeDefinition;
    progress: LocalChallengePresentation | null;
  }[];
  achievements: readonly {
    definition: AchievementDefinition;
    state: "confirmed" | "pending" | "locked";
  }[];
};

export function buildChallengePresentation(input: {
  challengeDefinitions: readonly ChallengeDefinition[];
  achievementDefinitions: readonly AchievementDefinition[];
  localChallenges?: readonly LocalChallengePresentation[];
  localAchievements?: readonly LocalAchievementPresentation[];
}): ChallengePresentation {
  const localChallenges = input.localChallenges ?? [];
  const localAchievements = input.localAchievements ?? [];
  const challengeById = new Map(localChallenges.map((challenge) => [challenge.challengeId, challenge]));
  const achievementById = new Map(localAchievements.map((achievement) => [achievement.achievementId, achievement]));
  const challenges = input.challengeDefinitions.map((definition) => ({
    definition,
    progress: challengeById.get(definition.definitionId) ?? null,
  }));
  const achievements: ChallengePresentation["achievements"] = input.achievementDefinitions.map((definition) => ({
    definition,
    state: achievementById.get(definition.achievementId)?.status ?? "locked" as const,
  }));
  const hasConfirmed = localChallenges.some((challenge) => challenge.completed || challenge.progress > 0) ||
    localAchievements.some((achievement) => achievement.status === "confirmed");
  const hasPending = localChallenges.some((challenge) => challenge.pending) ||
    localAchievements.some((achievement) => achievement.status === "pending");
  return {
    status: hasConfirmed ? "confirmed" : hasPending ? "pending" : "empty",
    challenges,
    achievements,
  };
}