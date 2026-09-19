import {
  canonicalEvidenceStoragePlan,
  canonicalSourceIdentity,
  type CanonicalActivityAdapterOutput,
  type CanonicalActivityLinkInput,
  type ExploreHikeAdapterInput,
  type PersistedCanonicalEvidenceType,
} from "./canonicalActivityContracts";

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
