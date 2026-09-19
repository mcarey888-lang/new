import type {
  CanonicalActivityInput,
  CanonicalActivityIngestionResult,
} from "./canonicalActivity";
import {
  canonicalSourceIdentity,
  canonicalEvidenceStoragePlan,
  type TrainingManualAdapterInput,
} from "./canonicalActivityContracts";
import { ingestCanonicalActivityWithClient } from "./canonicalActivity";

export interface ManualTrainingCompletion
  extends TrainingManualAdapterInput {
  ownerUserId: string;
}

export type ManualTrainingCanonicalIngestionResult =
  | { status: "disabled" }
  | CanonicalActivityIngestionResult;

export type ManualTrainingRetryDecision = "new" | "repeat" | "conflict";

export function manualTrainingRetryDecision(
  existing: { ownerUserId: string; sourcePayloadHash: string } | undefined,
  ownerUserId: string,
  incomingPayloadHash: string,
): ManualTrainingRetryDecision {
  if (!existing) return "new";
  if (existing.ownerUserId !== ownerUserId) return "new";
  return existing.sourcePayloadHash === incomingPayloadHash
    ? "repeat"
    : "conflict";
}

/**
 * Runtime activation is deliberately opt-in. The existing manual completion
 * route calls this adapter only when the flag and a stable completion ID exist.
 */
export function manualTrainingCanonicalAdapterEnabled(): boolean {
  return process.env.CANONICAL_MANUAL_TRAINING_ADAPTER_ENABLED === "true";
}

export function manualTrainingSourceSnapshot(input: {
  plannedHillName: string;
  hillId?: number;
  targetReps: number;
  estimatedGainPerRepM: number;
  estimatedTotalGainM: number;
  legacyTrackedHillSessionId: number;
}): Record<string, unknown> {
  return {
    plannedHillName: input.plannedHillName,
    hillId: input.hillId ?? null,
    targetReps: input.targetReps,
    estimatedGainPerRepM: input.estimatedGainPerRepM,
    estimatedTotalGainM: input.estimatedTotalGainM,
    legacyTrackedHillSessionId: input.legacyTrackedHillSessionId,
  };
}

export function manualTrainingCanonicalInput(
  completion: ManualTrainingCompletion,
): CanonicalActivityInput {
  const source = canonicalSourceIdentity(
    "training_manual",
    completion.completionId,
  );
  const evidencePlan = canonicalEvidenceStoragePlan("estimated_manual");

  return {
    ownerUserId: completion.ownerUserId,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    sourceVersion: "1",
    primaryContext: "training",
    activityKind: completion.activityKind,
    occurredAt: completion.completedAt,
    durationSeconds: completion.durationSeconds,
    recordedAscentM: completion.estimatedAscentM,
    lifecycle: "synced",
    evidenceState: evidencePlan.evidenceState,
    visibility: "private",
    sourceSnapshot: {
      ...completion.sourceSnapshot,
      evidenceClassification: "estimated_manual",
      canonicalEvidenceState: evidencePlan.evidenceState,
    },
    evidence: [{
      evidenceType: "manual_estimate",
      payload: {
        classification: "estimated_manual",
        estimatedAscentM: completion.estimatedAscentM ?? null,
        sourceSnapshot: completion.sourceSnapshot,
      },
    }],
    links: [
      ...(completion.trainingPlanId
        ? [{ linkType: "training_plan" as const, targetId: completion.trainingPlanId }]
        : []),
      ...(completion.trainingSessionId
        ? [{ linkType: "training_session" as const, targetId: completion.trainingSessionId }]
        : []),
    ],
  };
}

type CanonicalActivityDbClient = Parameters<
  typeof ingestCanonicalActivityWithClient
>[0];

/**
 * The manual completion route calls this inside its existing transaction.
 * Disabled mode is an explicit no-op so released legacy behavior is unchanged.
 */
export async function ingestManualTrainingCompletionWithClient(
  client: CanonicalActivityDbClient,
  completion: ManualTrainingCompletion,
): Promise<ManualTrainingCanonicalIngestionResult> {
  if (!manualTrainingCanonicalAdapterEnabled()) {
    return { status: "disabled" };
  }
  return ingestCanonicalActivityWithClient(
    client,
    manualTrainingCanonicalInput(completion),
  );
}
