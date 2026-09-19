import type {
  CanonicalActivityIngestionResult,
  CanonicalActivityInput,
} from "./canonicalActivity";
import {
  canonicalActivityBridgeEnabled,
  ingestCanonicalActivityWithClient,
} from "./canonicalActivity";
import {
  ingestManualTrainingCompletionWithClient,
  manualTrainingCanonicalAdapterEnabled,
  type ManualTrainingCompletion,
} from "./manualTrainingCanonicalAdapter";
import {
  canonicalizeExploreHikeWithClient,
  exploreHikeCanonicalAdapterEnabled,
  type ExploreHikeCanonicalAdapterInput,
  type ExploreHikeCanonicalizationResult,
} from "./exploreHikeCanonicalAdapter";
import type { CanonicalActivityLinkInput } from "./canonicalActivityContracts";

type CanonicalActivityDbClient = Parameters<
  typeof ingestCanonicalActivityWithClient
>[0];

export type DevelopmentTrackedActivityInput = {
  ownerUserId: string;
  localActivityId: string;
  occurredAt: Date;
  durationSeconds?: number;
  distanceKm?: number;
  recordedAscentM?: number;
  descentM?: number;
  rawGpsTrack?: unknown[];
  elevationProfile?: unknown[];
  plannedHillName?: string;
  plannedRouteName?: string;
  trainingPlanId?: string;
  trainingSessionId?: string;
  expeditionId?: string;
  expeditionStageId?: string;
  canonicalHillId?: string;
  canonicalRouteId?: string;
};

export type DevelopmentCanonicalActivationInput = {
  ownerUserId?: string;
  tracked?: DevelopmentTrackedActivityInput;
  manualTraining?: ManualTrainingCompletion;
  exploreHike?: ExploreHikeCanonicalAdapterInput & {
    /**
     * Reuse the tracked activity only when the caller has explicitly joined
     * the local ExploreHike record to that physical activity.
     */
    reuseTrackedActivity?: boolean;
  };
};

export type DevelopmentCanonicalActivationResult =
  | {
      status: "disabled";
      reason: "environment" | "canonical_bridge";
      paths: readonly string[];
    }
  | {
      status: "activated";
      tracked?: CanonicalActivityIngestionResult;
      manualTraining?: Awaited<
        ReturnType<typeof ingestManualTrainingCompletionWithClient>
      >;
      exploreHike?: ExploreHikeCanonicalizationResult;
    };

export interface DevelopmentActivationDependencies {
  ingestTracked(
    client: CanonicalActivityDbClient,
    input: CanonicalActivityInput,
  ): Promise<CanonicalActivityIngestionResult>;
  ingestManual(
    client: CanonicalActivityDbClient,
    input: ManualTrainingCompletion,
  ): Promise<Awaited<ReturnType<typeof ingestManualTrainingCompletionWithClient>>>;
  canonicalizeExplore(
    client: CanonicalActivityDbClient,
    ownerUserId: string,
    input: ExploreHikeCanonicalAdapterInput,
  ): Promise<ExploreHikeCanonicalizationResult>;
}

const defaultDevelopmentActivationDependencies: DevelopmentActivationDependencies = {
  ingestTracked: ingestCanonicalActivityWithClient,
  ingestManual: ingestManualTrainingCompletionWithClient,
  canonicalizeExplore: canonicalizeExploreHikeWithClient,
};

/**
 * C03 is deliberately a test/development-only activation boundary. Production
 * defaults stay untouched even when an adapter-specific flag is accidentally
 * set.
 */
export function developmentCanonicalActivationEnabled(): boolean {
  const environment = process.env.NODE_ENV;
  return (
    (environment === "test" || environment === "development") &&
    process.env.CANONICAL_ACTIVITY_DEVELOPMENT_ACTIVATION === "true"
  );
}

function trackedPrimaryContext(
  input: DevelopmentTrackedActivityInput,
): CanonicalActivityInput["primaryContext"] {
  if (input.trainingSessionId || input.trainingPlanId) return "training";
  if (input.expeditionId || input.expeditionStageId) return "expedition";
  return "free_hike";
}

function trackedLinks(
  input: DevelopmentTrackedActivityInput,
): CanonicalActivityLinkInput[] {
  return [
    ...(input.trainingPlanId
      ? [{ linkType: "training_plan" as const, targetId: input.trainingPlanId }]
      : []),
    ...(input.trainingSessionId
      ? [{ linkType: "training_session" as const, targetId: input.trainingSessionId }]
      : []),
    ...(input.expeditionId
      ? [{
          linkType: "expedition" as const,
          targetId: input.expeditionId,
          metadata: { simulatedCompletion: true },
        }]
      : []),
    ...(input.expeditionStageId
      ? [{
          linkType: "expedition_stage" as const,
          targetId: input.expeditionStageId,
          metadata: { simulatedCompletion: true },
        }]
      : []),
    ...(input.canonicalHillId
      ? [{ linkType: "canonical_hill" as const, targetId: input.canonicalHillId }]
      : []),
    ...(input.canonicalRouteId
      ? [{ linkType: "canonical_route" as const, targetId: input.canonicalRouteId }]
      : []),
  ];
}

export function developmentTrackedCanonicalInput(
  input: DevelopmentTrackedActivityInput,
): CanonicalActivityInput {
  return {
    ownerUserId: input.ownerUserId,
    sourceType: "tracked_hill_session",
    sourceId: input.localActivityId,
    sourceVersion: "development-c03-v1",
    primaryContext: trackedPrimaryContext(input),
    activityKind: "outdoor_hike",
    occurredAt: input.occurredAt,
    durationSeconds: input.durationSeconds,
    distanceKm: input.distanceKm,
    recordedAscentM: input.recordedAscentM,
    descentM: input.descentM,
    lifecycle: "synced",
    evidenceState: "recorded_unverified",
    visibility: "private",
    sourceSnapshot: {
      localActivityId: input.localActivityId,
      plannedHillName: input.plannedHillName ?? null,
      plannedRouteName: input.plannedRouteName ?? null,
      offlineLocalUuid: input.localActivityId,
    },
    evidence: [
      ...(input.rawGpsTrack
        ? [{ evidenceType: "gps_track" as const, payload: input.rawGpsTrack }]
        : []),
      ...(input.elevationProfile
        ? [{
            evidenceType: "elevation_profile" as const,
            payload: input.elevationProfile,
          }]
        : []),
    ],
    links: trackedLinks(input),
  };
}

export async function activateCanonicalDevelopmentPathsWithClient(
  client: CanonicalActivityDbClient,
  input: DevelopmentCanonicalActivationInput,
  dependencies: DevelopmentActivationDependencies =
    defaultDevelopmentActivationDependencies,
): Promise<DevelopmentCanonicalActivationResult> {
  if (!developmentCanonicalActivationEnabled()) {
    return {
      status: "disabled",
      reason: "environment",
      paths: [],
    };
  }
  if (input.tracked && !canonicalActivityBridgeEnabled()) {
    return {
      status: "disabled",
      reason: "canonical_bridge",
      paths: [],
    };
  }

  const tracked = input.tracked
    ? await dependencies.ingestTracked(
        client,
        developmentTrackedCanonicalInput(input.tracked),
      )
    : undefined;

  const manualTraining = input.manualTraining
    ? await dependencies.ingestManual(client, input.manualTraining)
    : undefined;

  let exploreHike: ExploreHikeCanonicalizationResult | undefined;
  if (input.exploreHike) {
    const ownerUserId =
      input.ownerUserId
      ?? input.tracked?.ownerUserId
      ?? input.manualTraining?.ownerUserId;
    if (!ownerUserId) {
      throw new Error("Development ExploreHike activation requires an owner");
    }
    const exploreInput = { ...input.exploreHike };
    if (
      exploreInput.reuseTrackedActivity &&
      tracked &&
      "activity" in tracked
    ) {
      exploreInput.existingCanonicalActivityId = tracked.activity.id;
    }
    delete exploreInput.reuseTrackedActivity;
    exploreHike = await dependencies.canonicalizeExplore(
      client,
      ownerUserId,
      exploreInput,
    );
  }

  return {
    status: "activated",
    tracked,
    manualTraining,
    exploreHike,
  };
}

export function developmentAdapterFlags(): {
  activation: boolean;
  bridge: boolean;
  manualTraining: boolean;
  exploreHike: boolean;
} {
  return {
    activation: developmentCanonicalActivationEnabled(),
    bridge: canonicalActivityBridgeEnabled(),
    manualTraining: manualTrainingCanonicalAdapterEnabled(),
    exploreHike: exploreHikeCanonicalAdapterEnabled(),
  };
}