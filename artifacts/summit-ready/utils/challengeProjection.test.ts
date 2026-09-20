import { describe, expect, it } from "vitest";
import { createChallengeProjection, reduceChallengeProjection } from "./challengeProjection";
import type { ChallengeProgress } from "./challengeDomain";

const progress: ChallengeProgress = {
  ownerUserId: "owner-1",
  definitionId: "distance",
  definitionVersion: "challenge-domain-v1",
  windowKey: "lifetime",
  status: "active",
  value: 12,
  target: 100,
  evidenceIds: ["activity-1"],
  evaluationVersion: "distance-v1",
  correctionVersion: 0,
  progressIdentity: "owner-1:distance:challenge-domain-v1:lifetime:activity-1",
};

describe("offline challenge projection", () => {
  it("is user scoped, replay safe and correction aware", () => {
    let state = createChallengeProjection("owner-1");
    state = reduceChallengeProjection(state, { type: "apply_progress", ownerUserId: "owner-1", progress });
    state = reduceChallengeProjection(state, { type: "apply_progress", ownerUserId: "owner-1", progress });
    expect(Object.keys(state.progress)).toHaveLength(1);
    const crossOwner = reduceChallengeProjection(state, { type: "apply_progress", ownerUserId: "owner-2", progress: { ...progress, ownerUserId: "owner-2" } });
    expect(crossOwner).toBe(state);
    const stale = reduceChallengeProjection(state, { type: "revoke_progress", ownerUserId: "owner-1", progressIdentity: progress.progressIdentity, correctionVersion: -1 });
    expect(stale.progress[progress.progressIdentity].status).toBe("active");
    const revoked = reduceChallengeProjection(state, { type: "revoke_progress", ownerUserId: "owner-1", progressIdentity: progress.progressIdentity, correctionVersion: 1 });
    expect(revoked.progress[progress.progressIdentity].status).toBe("revoked");
  });
});