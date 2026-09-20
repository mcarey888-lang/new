import type { AchievementAward, ChallengeProgress } from "./challengeDomain";

export interface ChallengeProjection {
  ownerUserId: string;
  progress: Record<string, ChallengeProgress>;
  awards: Record<string, AchievementAward>;
}

export type ChallengeProjectionAction =
  | { type: "apply_progress"; ownerUserId: string; progress: ChallengeProgress }
  | { type: "apply_award"; ownerUserId: string; award: AchievementAward }
  | { type: "revoke_progress"; ownerUserId: string; progressIdentity: string; correctionVersion: number }
  | { type: "revoke_award"; ownerUserId: string; awardIdentity: string; correctionVersion: number };

export function createChallengeProjection(ownerUserId: string): ChallengeProjection {
  return { ownerUserId, progress: {}, awards: {} };
}

export function reduceChallengeProjection(
  state: ChallengeProjection,
  action: ChallengeProjectionAction,
): ChallengeProjection {
  if (action.ownerUserId !== state.ownerUserId) return state;
  if (action.type === "apply_progress") {
    if (action.progress.ownerUserId !== state.ownerUserId) return state;
    const current = state.progress[action.progress.progressIdentity];
    if (current && current.correctionVersion > action.progress.correctionVersion) return state;
    return { ...state, progress: { ...state.progress, [action.progress.progressIdentity]: action.progress } };
  }
  if (action.type === "apply_award") {
    if (action.award.ownerUserId !== state.ownerUserId) return state;
    const current = state.awards[action.award.awardIdentity];
    if (current && current.correctionVersion > action.award.correctionVersion) return state;
    return { ...state, awards: { ...state.awards, [action.award.awardIdentity]: action.award } };
  }
  if (action.type === "revoke_progress") {
    const current = state.progress[action.progressIdentity];
    if (!current || current.correctionVersion > action.correctionVersion) return state;
    const revoked: ChallengeProgress = { ...current, status: "revoked", correctionVersion: action.correctionVersion };
    return { ...state, progress: { ...state.progress, [action.progressIdentity]: revoked } };
  }
  const current = state.awards[action.awardIdentity];
  if (!current || current.correctionVersion > action.correctionVersion) return state;
  const revoked: AchievementAward = { ...current, status: "revoked", correctionVersion: action.correctionVersion };
  return { ...state, awards: { ...state.awards, [action.awardIdentity]: revoked } };
}