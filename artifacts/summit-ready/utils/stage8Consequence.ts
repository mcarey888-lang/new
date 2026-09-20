import type { ChallengeProjection } from "./challengeProjection";

export type Stage8Consequence = {
  evidenceId: string;
  status: "confirmed" | "pending" | "unavailable" | "not_linked";
  challengeTitles: readonly string[];
  achievementTitles: readonly string[];
};

export function deriveStage8Consequence(
  evidenceId: string,
  before: ChallengeProjection,
  after: ChallengeProjection,
  challengeTitles: Readonly<Record<string, string>>,
  achievementTitles: Readonly<Record<string, string>>,
  qualificationPending: boolean,
  currentEvidenceIds: readonly string[] = [evidenceId],
): Stage8Consequence {
  const challenges = Object.entries(after.progress)
    .filter(([identity, progress]) =>
      progress.status === "completed" && before.progress[identity]?.status !== "completed" &&
      currentEvidenceIds.some((evidenceId) => progress.evidenceIds.includes(evidenceId)))
    .map(([identity]) => challengeTitles[identity.split(":")[1]])
    .filter((title): title is string => Boolean(title));
  const achievements = Object.values(after.awards)
    .filter((award) => award.status === "confirmed" &&
      award.evidenceIds.some((evidenceId) => currentEvidenceIds.includes(evidenceId)) &&
      !Object.values(before.awards).some((old) => old.awardIdentity === award.awardIdentity && old.status === "confirmed"))
    .map((award) => achievementTitles[award.achievementId])
    .filter((title): title is string => Boolean(title));
  return {
    evidenceId,
    status: challenges.length || achievements.length ? "confirmed" : qualificationPending ? "pending" : "unavailable",
    challengeTitles: challenges,
    achievementTitles: achievements,
  };
}