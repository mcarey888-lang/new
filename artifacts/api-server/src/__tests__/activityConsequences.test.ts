import { describe, expect, it } from "vitest";
import {
  applyActivityConsequences,
  planActivityConsequences,
  type ConsequenceActivity,
} from "../services/activityConsequences";
import { evaluateCanonicalQualifications } from "../services/canonicalQualificationEvaluator";

const baseActivity: ConsequenceActivity = {
  id: "activity-1",
  ownerUserId: "owner-1",
  primaryContext: "free_hike",
  activityKind: "outdoor_hike",
  occurredAt: new Date("2026-09-19T10:00:00Z"),
  recordedAscentM: 700,
  validatedAscentM: 700,
  evidenceState: "quality_accepted",
  lifecycle: "synced",
  links: [],
};

function qualifications(activity: ConsequenceActivity) {
  return evaluateCanonicalQualifications({
    id: activity.id,
    lifecycle: activity.lifecycle as "synced",
    evidenceClassification: "gps_recorded",
    evidenceState: activity.evidenceState as "unverified_manual" | "recorded_unverified" | "quality_accepted" | "verified_activity" | "verified_summit_ascent" | "competition_eligible",
    recordedAscentM: activity.recordedAscentM,
    validatedAscentM: activity.validatedAscentM,
    links: activity.links,
  });
}

describe("activity consequence planning", () => {
  it("plans a Training-only activity without inventing readiness values", () => {
    const activity = {
      ...baseActivity,
      primaryContext: "training" as const,
      links: [{ linkType: "training_session" as const, targetId: "session-1" }],
    };
    const summary = planActivityConsequences({ activity, qualifications: qualifications(activity) });
    expect(summary.training).toMatchObject({
      sessionIds: ["session-1"],
      completion: "ready",
      readiness: "pending_legacy_rules",
    });
    expect(summary.effects.some((effect) => effect.kind === "training_completion")).toBe(true);
  });

  it("plans Expedition contributions as simulated only from explicit links and rules", () => {
    const activity = {
      ...baseActivity,
      primaryContext: "expedition" as const,
      links: [
        { linkType: "expedition" as const, targetId: "expedition-1" },
        { linkType: "expedition_stage" as const, targetId: "stage-1" },
      ],
    };
    const summary = planActivityConsequences({
      activity,
      qualifications: qualifications(activity),
      expeditionRule: {
        expeditionId: "expedition-1",
        runId: "run-1",
        stageKey: "stage-1",
        ruleVersion: "expedition-v1",
        scoreVersion: "score-v1",
        activityKind: "outdoor_hike",
        acceptedMetric: 700,
        acceptedElevationM: 700,
        allowedActivityKinds: ["outdoor_hike"],
        allowedEvidenceClasses: ["quality_accepted"],
      },
    });
    expect(summary.expedition).toMatchObject({
      stageIds: ["stage-1"],
      contribution: "ready",
      simulatedOnly: true,
    });
    expect(summary.effects).toContainEqual(expect.objectContaining({
      kind: "expedition_contribution",
      simulatedOnly: true,
    }));
  });

  it("plans Free Hike as a private evidence activity with no inferred context", () => {
    const summary = planActivityConsequences({
      activity: {
        ...baseActivity,
        links: [{ linkType: "canonical_route", targetId: "route-1" }],
      },
      qualifications: qualifications(baseActivity),
    });
    expect(summary.training.completion).toBe("not_linked");
    expect(summary.expedition.contribution).toBe("not_linked");
    expect(summary.mountainRoute).toMatchObject({
      targets: ["route-1"],
      evidenceRecorded: true,
      realSummitEligible: false,
    });
  });

  it("keeps one multi-context activity and one Elevation Bank effect", () => {
    const activity = {
      ...baseActivity,
      primaryContext: "training" as const,
      links: [
        { linkType: "training_session" as const, targetId: "session-1" },
        { linkType: "expedition_stage" as const, targetId: "stage-1" },
        { linkType: "challenge" as const, targetId: "challenge-1" },
        { linkType: "challenge" as const, targetId: "challenge-1" },
      ],
    };
    const summary = planActivityConsequences({ activity, qualifications: qualifications(activity) });
    expect(summary.effects.filter((effect) => effect.kind === "elevation_bank")).toHaveLength(1);
    expect(summary.effects.filter((effect) => effect.kind === "challenge_hook")).toHaveLength(1);
  });

  it("keeps manual and untrusted activities pending/ineligible", () => {
    const manual = {
      ...baseActivity,
      evidenceState: "unverified_manual" as const,
    };
    const manualSummary = planActivityConsequences({
      activity: manual,
      qualifications: evaluateCanonicalQualifications({
        id: manual.id,
        lifecycle: manual.lifecycle as "synced",
        evidenceClassification: "estimated_manual",
        evidenceState: manual.evidenceState,
        links: manual.links,
      }),
    });
    expect(manualSummary.elevationBank.status).not.toBe("eligible");
    expect(manualSummary.effects.some((effect) => effect.kind === "elevation_bank")).toBe(false);

    const untrusted = {
      ...baseActivity,
      evidenceState: "unverified_manual" as const,
    };
    const untrustedSummary = planActivityConsequences({
      activity: untrusted,
      qualifications: evaluateCanonicalQualifications({
        id: untrusted.id,
        lifecycle: untrusted.lifecycle as "synced",
        evidenceClassification: "unavailable_untrusted",
        evidenceState: untrusted.evidenceState,
        links: untrusted.links,
      }),
    });
    expect(untrustedSummary.elevationBank.status).not.toBe("eligible");
  });

  it("does not send verified summit evidence to the Elevation Bank", () => {
    const activity = {
      ...baseActivity,
      evidenceState: "verified_summit_ascent" as const,
      validatedAscentM: 1200,
    };
    const summary = planActivityConsequences({
      activity,
      qualifications: qualifications(activity),
    });
    expect(summary.elevationBank).toMatchObject({
      status: "ineligible",
      creditedAscentM: null,
    });
    expect(summary.effects.some((effect) => effect.kind === "elevation_bank")).toBe(false);
  });

  it("does not write an Expedition contribution for invalid ledger evidence", async () => {
    const activity = {
      ...baseActivity,
      primaryContext: "expedition" as const,
      links: [
        { linkType: "expedition" as const, targetId: "expedition-1" },
        { linkType: "expedition_stage" as const, targetId: "stage-1" },
      ],
    };
    const evaluated = qualifications(activity).map((qualification) =>
      qualification.purpose === "expedition_progress"
        ? {
            ...qualification,
            evidenceClass: "not-a-ledger-class" as unknown as "recorded_unverified",
            status: "eligible" as const,
          }
        : qualification,
    );
    let writes = 0;
    const result = await applyActivityConsequences({
      activity,
      qualifications: evaluated,
      expeditionRule: {
        expeditionId: "expedition-1",
        runId: "run-1",
        stageKey: "stage-1",
        ruleVersion: "expedition-v1",
        scoreVersion: "score-v1",
        activityKind: "outdoor_hike",
        acceptedMetric: 700,
        allowedActivityKinds: ["outdoor_hike"],
        allowedEvidenceClasses: ["not-a-ledger-class"],
      },
    }, {
      contributeExpedition: async () => {
        writes += 1;
        throw new Error("invalid evidence reached writer");
      },
    });
    expect(result.summary.expedition.contribution).toBe("pending_legacy_rule");
    expect(writes).toBe(0);
  });

  it("allows real-summit evidence only with explicit eligible qualification", () => {
    const activity = {
      ...baseActivity,
      evidenceState: "verified_summit_ascent" as const,
      validatedAscentM: 1200,
      links: [{ linkType: "canonical_hill" as const, targetId: "sde:mountain:11111111-1111-4111-8111-111111111111" }],
    };
    const all = qualifications(activity);
    const noReal = planActivityConsequences({
      activity,
      qualifications: all.filter((qualification) => qualification.purpose !== "real_summit_evidence"),
    });
    expect(noReal.mountainRoute.realSummitEligible).toBe(false);
    const explicit = planActivityConsequences({
      activity,
      qualifications: all.map((qualification) =>
        qualification.purpose === "real_summit_evidence"
          ? { ...qualification, status: "eligible" as const }
          : qualification,
      ),
    });
    expect(explicit.mountainRoute.realSummitEligible).toBe(true);
  });

  it("ignores qualifications replayed from another activity", () => {
    const activity = {
      ...baseActivity,
      evidenceState: "verified_summit_ascent" as const,
      validatedAscentM: 1200,
      links: [{ linkType: "canonical_hill" as const, targetId: "sde:mountain:11111111-1111-4111-8111-111111111111" }],
    };
    const foreign = qualifications(activity).map((qualification) => ({
      ...qualification,
      activityId: "different-activity",
      status: "eligible" as const,
    }));
    const summary = planActivityConsequences({ activity, qualifications: foreign });
    expect(summary.effects).toHaveLength(1);
    expect(summary.effects[0]).toMatchObject({
      kind: "mountain_route_evidence",
      realSummitEligible: false,
    });
    expect(summary.elevationBank.status).toBe("not_linked");
  });

  it("does not duplicate effect writes on retry", async () => {
    const activity = {
      ...baseActivity,
      links: [{ linkType: "training_session" as const, targetId: "session-1" }],
    };
    let calls = 0;
    const applied = new Set<string>();
    const writers = {
      completeTrainingSession: async ({ idempotencyKey }: { idempotencyKey: string }) => {
        calls += 1;
        if (applied.has(idempotencyKey)) return { status: "deduplicated" as const };
        applied.add(idempotencyKey);
        return { status: "completed" as const };
      },
      hasApplied: async (key: string) => applied.has(key),
      markApplied: async (key: string) => { applied.add(key); },
    };
    const input = { activity, qualifications: qualifications(activity) };
    await applyActivityConsequences(input, writers);
    await applyActivityConsequences(input, writers);
    expect(calls).toBe(1);
  });
});