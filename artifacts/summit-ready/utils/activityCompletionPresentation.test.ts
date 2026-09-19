import { describe, expect, it } from "vitest";
import { buildActivityCompletionPresentation } from "./activityCompletionPresentation";

const availableBank = {
  status: "available" as const,
  lifetimeAscentM: 4_280,
  periodAscentM: 700,
  creditedActivities: 8,
  everestEquivalent: 0.5,
  recentCredits: [{
    activityId: "activity-1",
    revision: 1,
    status: "credited" as const,
    creditedAscentM: 700,
    evidenceClass: "quality_accepted" as const,
    ruleVersion: "elevation-bank-v1",
    effectiveAt: "2026-09-20T10:00:00.000Z",
  }],
};

function base(overrides: Partial<Parameters<typeof buildActivityCompletionPresentation>[0]> = {}) {
  return buildActivityCompletionPresentation({
    activityId: "activity-1",
    title: "Tryfan Ridge",
    distanceKm: 6.4,
    ascentM: 704,
    durationSecs: 10_260,
    isOffline: false,
    ...overrides,
  });
}

describe("activity completion presentation", () => {
  it("prioritises the physical activity and shows a credited Elevation Bank result", () => {
    expect(base({ elevationBank: availableBank })).toMatchObject({
      title: "Tryfan Ridge",
      metrics: { distanceKm: 6.4, ascentM: 704, durationSecs: 10_260 },
      elevationBank: {
        status: "credited",
        creditedAscentM: 700,
        lifetimeAscentM: 4_280,
        everestEquivalent: 0.5,
      },
    });
  });

  it("supports Training, Expedition, and multi-context without turning simulation into a summit", () => {
    const presentation = base({
      trainingSessionKey: "week-2-session-1",
      expeditionId: "expedition-1",
      expeditionStageName: "North Ridge stage",
    });
    expect(presentation.training).toEqual({
      status: "linked",
      sessionKey: "week-2-session-1",
    });
    expect(presentation.expedition).toMatchObject({
      status: "simulated",
      stageName: "North Ridge stage",
      simulatedPercent: 0,
      completedStageCount: 0,
      totalStageCount: 0,
      nextStageName: null,
      isComplete: false,
    });
    expect(presentation).not.toHaveProperty("realSummit");
  });

  it("hides unavailable/ineligible bank values and preserves offline completion", () => {
    expect(base({
      activityId: "manual-1",
      ascentM: 0,
      isOffline: true,
      elevationBank: {
        status: "unavailable",
        reason: "development_dependency_unavailable",
      },
    })).toMatchObject({
      elevationBank: { status: "unavailable" },
      sync: "saved_locally",
      training: { status: "not_linked" },
      expedition: { status: "not_linked" },
    });
  });

  it("matches the stable local source ID without fuzzy title or metric matching", () => {
    const presentation = base({
      activityId: "local-source-uuid",
      elevationBank: {
        ...availableBank,
        recentCredits: [{
          ...availableBank.recentCredits[0],
          activityId: "canonical-db-uuid",
          sourceId: "local-source-uuid",
        }],
      },
    });
    expect(presentation.elevationBank).toMatchObject({
      status: "credited",
      creditedAscentM: 700,
    });
    expect(base({
      activityId: "different-source",
      elevationBank: {
        ...availableBank,
        recentCredits: [{
          ...availableBank.recentCredits[0],
          activityId: "canonical-db-uuid",
          sourceId: "local-source-uuid",
        }],
      },
    }).elevationBank.status).toBe("pending");
  });

  it("does not duplicate the summary when a retry has no matching effective credit", () => {
    const first = base({ elevationBank: availableBank });
    const retry = base({
      elevationBank: {
        ...availableBank,
        recentCredits: [],
      },
    });
    expect(first.title).toBe(retry.title);
    expect(first.elevationBank.status).toBe("credited");
    expect(retry.elevationBank.status).toBe("pending");
  });

  it("keeps missing recorded metrics honest without inventing values", () => {
    expect(base({
      distanceKm: null,
      ascentM: undefined,
      durationSecs: null,
      isOffline: true,
      elevationBank: { status: "unavailable", reason: "offline" },
    })).toMatchObject({
      metrics: { distanceKm: 0, ascentM: 0, durationSecs: 0 },
      elevationBank: { status: "unavailable" },
      sync: "saved_locally",
    });
  });

  it("carries a completed Expedition state without offering a next stage", () => {
    const presentation = base({
      expeditionId: "expedition-complete",
      expeditionStageName: "Summit stage",
      expeditionProgress: {
        mode: "expedition",
        status: "completed",
        expeditionId: "expedition-complete",
        challengeId: null,
        challengeName: "Summit",
        targetMountainName: "Summit",
        progress: {
          targetSimulatedElevationM: 1000,
          currentSimulatedElevationM: 1000,
          simulatedPercent: 1,
          completedStageCount: 2,
          totalStageCount: 2,
          currentStageIndex: null,
          nextStageIndex: null,
          isComplete: true,
        },
        stages: [],
        nextStage: null,
        summit: { eligible: true, transitionState: "ready", completionAwarded: false },
        availability: "ready",
      },
    });
    expect(presentation.expedition).toMatchObject({
      status: "simulated",
      simulatedPercent: 1,
      completedStageCount: 2,
      totalStageCount: 2,
      nextStageName: null,
      isComplete: true,
    });
  });
});
