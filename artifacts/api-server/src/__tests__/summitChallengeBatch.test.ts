import { describe, expect, it, vi } from "vitest";
import { APPROACH_NOTE, SUMMIT_CHALLENGE_BATCH, sourceArtworkId } from "../data/summitChallengeBatch";
import type { SignatureChallenge } from "@workspace/db";
vi.mock("@workspace/db", () => ({
  executeEngineReadOnlyQuery: vi.fn(async () => SUMMIT_CHALLENGE_BATCH.flatMap(challenge => challenge.stages.map(stage => ({
    id: stage.id, name: stage.name, country: "UK", region: challenge.region,
    latitude: 54, longitude: -2, elevationM: 900, status: "imported",
  })))),
}));
import { revisedSummitChallenge } from "../services/summitChallengeRevisions";

describe("owner-agreed summit challenge batch", () => {
  it.each([
    ["SIG024", "The Welsh Matterhorn", 2, 1160, 4.6, 1200, 1.7],
    ["SIG054", "The Lake District Mont Blanc", 3, 2400, 15.7, 2400, 9],
    ["SIG055", "The Yorkshire Kilimanjaro", 10, 4560, 50.7, 5000, 40],
  ])("preserves the supplied %s selections and separate totals", async (id, title, count, ascent, approach, referenceAscent, referenceApproach) => {
    const source = { challengeId: id, heroImage: `/api/artwork/image/${id}/hero`, approved: true } as SignatureChallenge;
    const before = JSON.stringify(source);
    const revised = await revisedSummitChallenge(source);
    if (!("stages" in revised)) throw new Error("Missing revision");
    expect(revised.challengeName).toBe(title);
    expect(revised.stages).toHaveLength(count as number);
    expect(revised.totalAscentM).toBe(ascent);
    expect(revised.approachDistanceKm).toBe(approach);
    expect(revised.reference.ascentM).toBe(referenceAscent);
    expect(revised.reference.approachDistanceKm).toBe(referenceApproach);
    expect(revised.selfPaced).toBe(true);
    expect(revised.recommendedDays).toBe(0);
    expect(revised.totalDistanceKm).toBeNull();
    expect(revised.exactUphillDistanceKm).toBeNull();
    expect(revised.stages.every(stage => stage.distanceKm === null && stage.exactUphillDistanceKm === null)).toBe(true);
    expect(revised.stages.map(stage => stage.catalogueMountain.id)).toEqual(
      SUMMIT_CHALLENGE_BATCH.find(challenge => challenge.sourceId === id)!.stages.map(stage => stage.id));
    expect(sourceArtworkId(revised.challengeId)).toBe(id);
    expect(JSON.stringify(source)).toBe(before);
    expect((await revisedSummitChallenge(source)).challengeId).toBe(revised.challengeId);
  });
  it("leaves unrelated entries unchanged and has no UK targets", async () => {
    const unrelated = { challengeId: "SIG001" } as SignatureChallenge;
    expect(await revisedSummitChallenge(unrelated)).toBe(unrelated);
    expect(new Set(SUMMIT_CHALLENGE_BATCH.map(challenge => challenge.challengeId)).size).toBe(3);
    expect(SUMMIT_CHALLENGE_BATCH.map(challenge => challenge.target)).toEqual(["Matterhorn", "Mont Blanc", "Kilimanjaro"]);
    expect(APPROACH_NOTE).toContain("Return walking is additional");
  });
});
