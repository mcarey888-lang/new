import { describe, expect, it } from "vitest";
import {
  CanonicalActivityLinkError,
  assertCanonicalActivityOwner,
  planCanonicalActivityLinks,
} from "../services/canonicalActivityLinks";
import {
  sdeMountainTarget,
  sdeRouteTarget,
} from "../services/canonicalActivityContracts";

const activityId = "activity-uuid";
const ownerUserId = "owner-a";

function request(links: Parameters<typeof planCanonicalActivityLinks>[0]["links"]) {
  return { activityId, ownerUserId, links };
}

describe("canonical contribution-link planning", () => {
  it("plans multiple independent purposes for one activity without copying it", () => {
    const plan = planCanonicalActivityLinks(request([
      { linkType: "training_plan", targetId: "plan-1" },
      { linkType: "training_session", targetId: "session-1" },
      { linkType: "expedition", targetId: "expedition-1" },
      { linkType: "challenge", targetId: "challenge-1" },
      {
        linkType: "canonical_hill",
        targetId: sdeMountainTarget("f5dd0ef8-7c31-4af4-a9ed-e264753b39c6"),
      },
      {
        linkType: "canonical_route",
        targetId: sdeRouteTarget("dobih:route/crib-goch", "v2"),
      },
    ]));

    expect(plan).toEqual({
      activityId,
      ownerUserId,
      links: expect.arrayContaining([
        { linkType: "training_plan", targetId: "plan-1" },
        { linkType: "training_session", targetId: "session-1" },
        { linkType: "expedition", targetId: "expedition-1" },
        { linkType: "challenge", targetId: "challenge-1" },
      ]),
    });
    expect(plan.links).toHaveLength(6);
  });

  it("deduplicates retries by the persisted activity/link/target key", () => {
    const plan = planCanonicalActivityLinks(request([
      { linkType: "training_session", targetId: "session-1" },
      { linkType: "training_session", targetId: "session-1", metadata: { retry: 2 } },
      { linkType: "expedition_stage", targetId: "stage-1" },
      { linkType: "expedition_stage", targetId: "stage-1" },
    ]));

    expect(plan.links).toEqual([
      { linkType: "training_session", targetId: "session-1" },
      { linkType: "expedition_stage", targetId: "stage-1" },
    ]);
  });

  it("accepts legacy non-SDE targets and validates SDE target type", () => {
    expect(planCanonicalActivityLinks(request([
      { linkType: "canonical_hill", targetId: "legacy-hill-7" },
      { linkType: "canonical_route", targetId: "legacy-route-8" },
    ])).links).toHaveLength(2);

    expect(() => planCanonicalActivityLinks(request([{
      linkType: "challenge",
      targetId: sdeMountainTarget("f5dd0ef8-7c31-4af4-a9ed-e264753b39c6"),
    }]))).toThrow(CanonicalActivityLinkError);
  });

  it("rejects malformed and unknown targets", () => {
    expect(() => planCanonicalActivityLinks(request([{
      linkType: "canonical_route",
      targetId: "sde:unknown:route",
    }]))).toThrow(/Unknown Summit Data Engine/);
    expect(() => planCanonicalActivityLinks(request([{
      linkType: "canonical_route",
      targetId: " ",
    }]))).toThrow(/Invalid canonical link target/);
  });

  it("cannot make an Expedition link imply real summit completion", () => {
    expect(() => planCanonicalActivityLinks(request([{
      linkType: "expedition_stage",
      targetId: "stage-1",
      metadata: { realSummitCompletion: true },
    }]))).toThrow(/cannot imply real summit/);
    expect(planCanonicalActivityLinks(request([{
      linkType: "expedition_stage",
      targetId: "stage-1",
      metadata: { simulatedCompletion: true },
    }])).links).toHaveLength(1);
  });
});

describe("canonical contribution-link owner guard", () => {
  it("accepts the owning activity", () => {
    expect(() => assertCanonicalActivityOwner(
      { id: activityId, ownerUserId },
      ownerUserId,
      activityId,
    )).not.toThrow();
  });

  it("rejects missing and cross-owner activities without leaking existence", () => {
    for (const activity of [
      undefined,
      { id: activityId, ownerUserId: "owner-b" },
      { id: "other-activity", ownerUserId },
    ]) {
      expect(() => assertCanonicalActivityOwner(activity, ownerUserId, activityId))
        .toThrow("not available to this owner");
    }
  });
});