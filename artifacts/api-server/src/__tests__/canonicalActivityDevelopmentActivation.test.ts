import { afterEach, describe, expect, it } from "vitest";
import { canonicalActivityPayloadHash, type CanonicalActivityIngestionResult, type CanonicalActivityInput } from "../services/canonicalActivity";
import { canonicalEvidenceStoragePlan } from "../services/canonicalActivityContracts";
import {
  activateCanonicalDevelopmentPathsWithClient,
  type DevelopmentActivationDependencies,
  developmentAdapterFlags,
  developmentCanonicalActivationEnabled,
  developmentTrackedCanonicalInput,
} from "../services/canonicalActivityDevelopmentActivation";
import { manualTrainingCanonicalInput } from "../services/manualTrainingCanonicalAdapter";
import { planExploreHikeCanonicalization } from "../services/exploreHikeCanonicalAdapter";

const originalNodeEnv = process.env.NODE_ENV;
const originalActivation =
  process.env.CANONICAL_ACTIVITY_DEVELOPMENT_ACTIVATION;
const originalBridge = process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED;
const originalManual = process.env.CANONICAL_MANUAL_TRAINING_ADAPTER_ENABLED;
const originalExplore = process.env.CANONICAL_EXPLORE_HIKE_ADAPTER_ENABLED;

afterEach(() => {
  for (const [key, value] of [
    ["NODE_ENV", originalNodeEnv],
    ["CANONICAL_ACTIVITY_DEVELOPMENT_ACTIVATION", originalActivation],
    ["CANONICAL_ACTIVITY_BRIDGE_ENABLED", originalBridge],
    ["CANONICAL_MANUAL_TRAINING_ADAPTER_ENABLED", originalManual],
    ["CANONICAL_EXPLORE_HIKE_ADAPTER_ENABLED", originalExplore],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const tracked = {
  ownerUserId: "owner-a",
  localActivityId: "11111111-1111-4111-8111-111111111111",
  occurredAt: new Date("2026-09-19T10:00:00.000Z"),
  durationSeconds: 3600,
  distanceKm: 9,
  recordedAscentM: 700,
  trainingPlanId: "plan-1",
  trainingSessionId: "session-2",
  expeditionId: "expedition-1",
  expeditionStageId: "stage-3",
  canonicalHillId: "hill-1",
  canonicalRouteId: "route-1",
  rawGpsTrack: [{ lat: 54.5, lon: -3 }],
};

function fakeDependencies() {
  let nextId = 1;
  const rows = new Map<string, {
    id: string;
    ownerUserId: string;
    sourceType: string;
    sourceId: string;
    sourcePayloadHash: string;
    recordedAscentM?: number;
    evidenceState?: string;
    evidenceTypes: string[];
    links: Array<{ linkType: string; targetId: string; metadata?: Record<string, unknown> }>;
  }>();
  const conflicts: Array<{ activityId: string; incomingPayloadHash: string }> = [];
  const activity = (row: (typeof rows extends Map<string, infer R> ? R : never)) =>
    row as unknown as CanonicalActivityIngestionResult["activity"];
  const ingest = async (_client: unknown, input: CanonicalActivityInput): Promise<CanonicalActivityIngestionResult> => {
    const key = `${input.ownerUserId}:${input.sourceType}:${input.sourceId}`;
    const hash = canonicalActivityPayloadHash(input);
    const existing = rows.get(key);
    if (existing) {
      if (existing.sourcePayloadHash === hash) return { status: "deduplicated", activity: activity(existing) };
      conflicts.push({ activityId: existing.id, incomingPayloadHash: hash });
      return { status: "conflict", activity: activity(existing) };
    }
    const row = {
      id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
      ownerUserId: input.ownerUserId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourcePayloadHash: hash,
      recordedAscentM: input.recordedAscentM,
      evidenceState: input.evidenceState,
      evidenceTypes: (input.evidence ?? []).map((item) => item.evidenceType),
      links: [...(input.links ?? [])],
    };
    rows.set(key, row);
    return { status: "created", activity: activity(row) };
  };
  const dependencies: DevelopmentActivationDependencies = {
    ingestTracked: ingest,
    ingestManual: async (_client, input) => ingest(_client, manualTrainingCanonicalInput(input)),
    canonicalizeExplore: async (_client, ownerUserId, input) => {
      const plan = planExploreHikeCanonicalization(input);
      if (plan.mode === "reuse") {
        const row = [...rows.values()].find((candidate) =>
          candidate.id === plan.canonicalActivityId && candidate.ownerUserId === ownerUserId);
        if (!row) throw new Error("owner mismatch");
        row.links.push(...plan.links);
        return { status: "reused", canonicalActivityId: row.id };
      }
      const output = plan.output;
      const result = await ingest(_client, {
        ownerUserId,
        sourceType: output.source.sourceType,
        sourceId: output.source.sourceId,
        sourceVersion: output.sourceVersion,
        primaryContext: output.primaryContext,
        activityKind: output.activityKind,
        occurredAt: output.occurredAt,
        durationSeconds: output.durationSeconds,
        distanceKm: output.distanceKm,
        recordedAscentM: output.recordedAscentM,
        evidenceState: canonicalEvidenceStoragePlan(input.evidenceClassification).evidenceState,
        evidence: output.evidence?.map((item) => ({
          evidenceType: item.evidenceType,
          payload: item.payload,
        })),
        links: output.links,
      });
      return { status: result.status, activity: result.activity };
    },
  };
  return { dependencies, rows, conflicts };
}

describe("Stage 4 development activation boundary", () => {
  it("requires both test/development environment and explicit activation", () => {
    process.env.NODE_ENV = "production";
    process.env.CANONICAL_ACTIVITY_DEVELOPMENT_ACTIVATION = "true";
    expect(developmentCanonicalActivationEnabled()).toBe(false);

    process.env.NODE_ENV = "test";
    delete process.env.CANONICAL_ACTIVITY_DEVELOPMENT_ACTIVATION;
    expect(developmentCanonicalActivationEnabled()).toBe(false);

    process.env.CANONICAL_ACTIVITY_DEVELOPMENT_ACTIVATION = "true";
    expect(developmentCanonicalActivationEnabled()).toBe(true);
  });

  it("keeps every adapter default-off and exposes the activation matrix", () => {
    process.env.NODE_ENV = "test";
    process.env.CANONICAL_ACTIVITY_DEVELOPMENT_ACTIVATION = "true";
    delete process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED;
    delete process.env.CANONICAL_MANUAL_TRAINING_ADAPTER_ENABLED;
    delete process.env.CANONICAL_EXPLORE_HIKE_ADAPTER_ENABLED;
    expect(developmentAdapterFlags()).toEqual({
      activation: true,
      bridge: false,
      manualTraining: false,
      exploreHike: false,
    });
  });

  it("builds one stable tracked identity with explicit multi-context links", () => {
    const first = developmentTrackedCanonicalInput(tracked);
    const retry = developmentTrackedCanonicalInput({ ...tracked });

    expect(first.sourceType).toBe("tracked_hill_session");
    expect(first.sourceId).toBe("11111111-1111-4111-8111-111111111111");
    expect(first.sourceId).toBe(retry.sourceId);
    expect(first.visibility).toBe("private");
    expect(first.sourceSnapshot).toMatchObject({
      offlineLocalUuid: "11111111-1111-4111-8111-111111111111",
    });
    expect(first.links).toEqual(expect.arrayContaining([
      { linkType: "training_plan", targetId: "plan-1" },
      { linkType: "training_session", targetId: "session-2" },
      {
        linkType: "expedition",
        targetId: "expedition-1",
        metadata: { simulatedCompletion: true },
      },
      {
        linkType: "expedition_stage",
        targetId: "stage-3",
        metadata: { simulatedCompletion: true },
      },
    ]));
  });

  it("does not infer context from names or metrics", () => {
    const input = developmentTrackedCanonicalInput({
      ...tracked,
      trainingPlanId: undefined,
      trainingSessionId: undefined,
      expeditionId: undefined,
      expeditionStageId: undefined,
      plannedHillName: "Everest",
      recordedAscentM: 8849,
    });
    expect(input.primaryContext).toBe("free_hike");
    expect(input.links).toEqual([
      { linkType: "canonical_hill", targetId: "hill-1" },
      { linkType: "canonical_route", targetId: "route-1" },
    ]);
  });

  it("runs every C03 path through an injected end-to-end development harness", async () => {
    process.env.NODE_ENV = "test";
    process.env.CANONICAL_ACTIVITY_DEVELOPMENT_ACTIVATION = "true";
    process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED = "true";
    process.env.CANONICAL_MANUAL_TRAINING_ADAPTER_ENABLED = "true";
    process.env.CANONICAL_EXPLORE_HIKE_ADAPTER_ENABLED = "true";
    const harness = fakeDependencies();
    const client = {} as never;
    const activate = async (input: Parameters<typeof activateCanonicalDevelopmentPathsWithClient>[1]) => {
      const result = await activateCanonicalDevelopmentPathsWithClient(client, input, harness.dependencies);
      if (result.status !== "activated") throw new Error(`activation disabled: ${result.reason}`);
      return result;
    };

    const free = await activate({
      tracked: { ...tracked, ownerUserId: "owner-a", localActivityId: "22222222-2222-4222-8222-222222222222" },
    });
    const training = await activate({
      tracked: {
        ...tracked,
        ownerUserId: "owner-a",
        localActivityId: "33333333-3333-4333-8333-333333333333",
        expeditionId: undefined,
        expeditionStageId: undefined,
      },
    });
    const expedition = await activate({
      tracked: {
        ...tracked,
        ownerUserId: "owner-a",
        localActivityId: "44444444-4444-4444-8444-444444444444",
        trainingPlanId: undefined,
        trainingSessionId: undefined,
      },
    });
    const manual = await activate({
      ownerUserId: "owner-a",
      manualTraining: {
        ownerUserId: "owner-a",
        completionId: "55555555-5555-4555-8555-555555555555",
        completedAt: tracked.occurredAt,
        activityKind: "hill_repetitions",
        estimatedAscentM: 420,
        sourceSnapshot: { targetReps: 6 },
      },
    });
    const distinctExplore = await activate({
      ownerUserId: "owner-a",
      exploreHike: {
        exploreHikeId: "66666666-6666-4666-8666-666666666666",
        occurredAt: tracked.occurredAt,
        activityKind: "outdoor_hike",
        recordedAscentM: 300,
        evidenceClassification: "gps_recorded",
        sourceSnapshot: { route: "distinct" },
      },
    });
    const reusedTracked = await activate({
      ownerUserId: "owner-a",
      tracked: { ...tracked, ownerUserId: "owner-a", localActivityId: "77777777-7777-4777-8777-777777777777" },
      exploreHike: {
        exploreHikeId: "88888888-8888-4888-8888-888888888888",
        occurredAt: tracked.occurredAt,
        activityKind: "outdoor_hike",
        evidenceClassification: "gps_recorded",
        sourceSnapshot: { route: "same physical hike" },
        reuseTrackedActivity: true,
      },
    });

    expect(free.tracked?.status).toBe("created");
    expect(training.tracked?.activity.id).not.toBe(free.tracked?.activity.id);
    expect(expedition.tracked?.activity.id).not.toBe(training.tracked?.activity.id);
    expect(manual.manualTraining?.status).toBe("created");
    expect(distinctExplore.exploreHike?.status).toBe("created");
    expect(reusedTracked.exploreHike).toEqual({
      status: "reused",
      canonicalActivityId: reusedTracked.tracked?.activity.id,
    });
    expect(harness.rows.get("owner-a:training_manual:55555555-5555-4555-8555-555555555555")?.evidenceTypes)
      .toEqual(["manual_estimate"]);
    expect(harness.rows.get("owner-a:tracked_hill_session:44444444-4444-4444-8444-444444444444")?.links)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          linkType: "expedition",
          metadata: { simulatedCompletion: true },
        }),
      ]));
    expect(harness.rows.get("owner-a:tracked_hill_session:77777777-7777-4777-8777-777777777777")?.links)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ linkType: "canonical_route", targetId: "route-1" }),
      ]));
  });

  it("proves delayed UUID retry, retained conflict, and owner separation", async () => {
    process.env.NODE_ENV = "development";
    process.env.CANONICAL_ACTIVITY_DEVELOPMENT_ACTIVATION = "true";
    process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED = "true";
    const harness = fakeDependencies();
    const client = {} as never;
    const activate = async (input: Parameters<typeof activateCanonicalDevelopmentPathsWithClient>[1]) => {
      const result = await activateCanonicalDevelopmentPathsWithClient(client, input, harness.dependencies);
      if (result.status !== "activated") throw new Error(`activation disabled: ${result.reason}`);
      return result;
    };
    const base = {
      ...tracked,
      trainingPlanId: undefined,
      trainingSessionId: undefined,
      expeditionId: undefined,
      expeditionStageId: undefined,
      localActivityId: "99999999-9999-4999-8999-999999999999",
    };
    const first = await activate({ tracked: base });
    const retry = await activate({ tracked: { ...base } });
    const conflict = await activate({ tracked: { ...base, recordedAscentM: 999 } });
    const otherOwner = await activate({ tracked: { ...base, ownerUserId: "owner-b" } });

    expect(first.tracked?.status).toBe("created");
    expect(retry.tracked?.status).toBe("deduplicated");
    expect(conflict.tracked?.status).toBe("conflict");
    expect(otherOwner.tracked?.status).toBe("created");
    expect(first.tracked?.activity.id).toBe(retry.tracked?.activity.id);
    expect(first.tracked?.activity.id).not.toBe(otherOwner.tracked?.activity.id);
    expect(harness.conflicts).toHaveLength(1);
    expect(harness.rows).toHaveLength(2);
    expect(harness.rows.get("owner-a:tracked_hill_session:99999999-9999-4999-8999-999999999999")?.recordedAscentM)
      .toBe(700);
  });
});