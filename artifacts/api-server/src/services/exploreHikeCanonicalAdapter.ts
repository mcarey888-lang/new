import {
  canonicalEvidenceStoragePlan,
  canonicalSourceIdentity,
  type CanonicalActivityAdapterOutput,
  type CanonicalActivityLinkInput,
  type ExploreHikeAdapterInput,
  type PersistedCanonicalEvidenceType,
} from "./canonicalActivityContracts";
import {
  ingestCanonicalActivityWithClient,
  type CanonicalActivityIngestionResult,
} from "./canonicalActivity";
import { addCanonicalActivityLinksWithClient } from "./canonicalActivityLinks";

export interface ExploreHikeCanonicalAdapterInput extends ExploreHikeAdapterInput {
  /**
   * Set only when a trusted caller already knows the server canonical activity
   * for this physical hike. It is never inferred from metrics or display data.
   */
  existingCanonicalActivityId?: string;
  explicitLinks?: CanonicalActivityLinkInput[];
}

export type ExploreHikeCanonicalizationPlan =
  | {
      mode: "reuse";
      source: ReturnType<typeof canonicalSourceIdentity>;
      canonicalActivityId: string;
      links: CanonicalActivityLinkInput[];
    }
  | {
      mode: "ingest";
      output: CanonicalActivityAdapterOutput;
    };

export type ExploreHikeCanonicalizationResult =
  | { status: "disabled" }
  | { status: "reused"; canonicalActivityId: string }
  | ({ status: "created" | "deduplicated" | "conflict" } & Pick<CanonicalActivityIngestionResult, "activity">);

type CanonicalActivityDbClient = Parameters<
  typeof ingestCanonicalActivityWithClient
>[0];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateExplicitCanonicalActivityId(id: string): string {
  if (!UUID_PATTERN.test(id)) {
    throw new Error("Invalid existing canonical activity ID");
  }
  return id.toLowerCase();
}

function evidenceTypeFor(
  classification: ExploreHikeAdapterInput["evidenceClassification"],
): PersistedCanonicalEvidenceType {
  const plan = canonicalEvidenceStoragePlan(classification);
  return plan.allowedEvidenceTypes[0];
}

/**
 * Plans canonicalization for a new local ExploreHike record.
 *
 * This is deliberately a pure planner: callers decide when/how to dual-write,
 * and existing local AsyncStorage/history behavior remains authoritative.
 */
export function planExploreHikeCanonicalization(
  input: ExploreHikeCanonicalAdapterInput,
): ExploreHikeCanonicalizationPlan {
  const source = canonicalSourceIdentity("explore_hike", input.exploreHikeId);
  const links = input.explicitLinks ?? [];
  const sourceSnapshot = {
    ...input.sourceSnapshot,
    evidenceClassification: input.evidenceClassification,
  };

  if (input.existingCanonicalActivityId) {
    return {
      mode: "reuse",
      source,
      canonicalActivityId: validateExplicitCanonicalActivityId(
        input.existingCanonicalActivityId,
      ),
      links,
    };
  }

  return {
    mode: "ingest",
    output: {
      source,
      primaryContext: "free_hike",
      activityKind: input.activityKind,
      occurredAt: input.occurredAt,
      durationSeconds: input.durationSeconds,
      distanceKm: input.distanceKm,
      recordedAscentM: input.recordedAscentM,
      sourceSnapshot,
      evidence: [{
        classification: input.evidenceClassification,
        evidenceType: evidenceTypeFor(input.evidenceClassification),
        payload: sourceSnapshot,
      }],
      links,
    },
  };
}

export function exploreHikeCanonicalAdapterEnabled(): boolean {
  return process.env.CANONICAL_EXPLORE_HIKE_ADAPTER_ENABLED === "true";
}

/**
 * Authenticated server activation boundary for future/offline callers.
 * The mobile client is intentionally not wired here; disabled mode is a no-op.
 */
export async function canonicalizeExploreHikeWithClient(
  client: CanonicalActivityDbClient,
  ownerUserId: string,
  input: ExploreHikeCanonicalAdapterInput,
): Promise<ExploreHikeCanonicalizationResult> {
  if (!exploreHikeCanonicalAdapterEnabled()) return { status: "disabled" };

  const plan = planExploreHikeCanonicalization(input);
  if (plan.mode === "reuse") {
    await addCanonicalActivityLinksWithClient(client, {
      ownerUserId,
      activityId: plan.canonicalActivityId,
      links: plan.links,
    });
    return {
      status: "reused",
      canonicalActivityId: plan.canonicalActivityId,
    };
  }

  const output = plan.output;
  const canonical = await ingestCanonicalActivityWithClient(client, {
    ownerUserId,
    sourceType: output.source.sourceType,
    sourceId: output.source.sourceId,
    sourceVersion: output.sourceVersion,
    primaryContext: output.primaryContext,
    activityKind: output.activityKind,
    occurredAt: output.occurredAt,
    startedAt: output.startedAt,
    endedAt: output.endedAt,
    durationSeconds: output.durationSeconds,
    distanceKm: output.distanceKm,
    recordedAscentM: output.recordedAscentM,
    validatedAscentM: output.validatedAscentM,
    descentM: output.descentM,
    evidenceState: canonicalEvidenceStoragePlan(
      input.evidenceClassification,
    ).evidenceState,
    visibility: "private",
    sourceSnapshot: output.sourceSnapshot,
    evidence: output.evidence?.map((evidence) => ({
      evidenceType: evidence.evidenceType,
      payload: evidence.payload,
      capturedAt: evidence.capturedAt,
    })),
    links: output.links,
  });
  return { status: canonical.status, activity: canonical.activity };
}
