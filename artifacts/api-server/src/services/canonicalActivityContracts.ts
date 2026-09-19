export const BUILT_IN_CANONICAL_SOURCE_TYPES = [
  "tracked_hill_session",
  "training_manual",
  "explore_hike",
] as const;

export type BuiltInCanonicalSourceType =
  (typeof BUILT_IN_CANONICAL_SOURCE_TYPES)[number];
export type ExternalCanonicalSourceType =
  | `provider:${string}`
  | `import:${string}`;
export type CanonicalSourceType =
  | BuiltInCanonicalSourceType
  | ExternalCanonicalSourceType
  | (string & {});

export interface CanonicalSourceIdentity {
  sourceType: CanonicalSourceType;
  sourceId: string;
}

export type CanonicalActivityLinkType =
  | "training_plan"
  | "training_session"
  | "expedition"
  | "expedition_stage"
  | "canonical_hill"
  | "canonical_route"
  | "community_route"
  | "challenge";

export interface CanonicalActivityLinkInput {
  linkType: CanonicalActivityLinkType;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export type CanonicalEvidenceClassification =
  | "gps_recorded"
  | "estimated_manual"
  | "indoor_training"
  | "unavailable_untrusted";

export type PersistedCanonicalEvidenceType =
  | "gps_track"
  | "elevation_profile"
  | "manual_estimate"
  | "source_snapshot";

export type PersistedCanonicalEvidenceState =
  | "unverified_manual"
  | "recorded_unverified"
  | "quality_accepted"
  | "verified_activity"
  | "verified_summit_ascent"
  | "competition_eligible";

export interface CanonicalEvidenceStoragePlan {
  evidenceState: PersistedCanonicalEvidenceState;
  allowedEvidenceTypes: readonly PersistedCanonicalEvidenceType[];
  classificationMarkerRequired: boolean;
}

export interface CanonicalAdapterEvidenceInput {
  classification: CanonicalEvidenceClassification;
  evidenceType: PersistedCanonicalEvidenceType;
  payload: unknown;
  capturedAt?: Date;
}

export interface CanonicalActivityAdapterOutput {
  source: CanonicalSourceIdentity;
  sourceVersion?: string;
  primaryContext:
    | "training"
    | "expedition"
    | "free_hike"
    | "mountain_simulation";
  activityKind: string;
  occurredAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  distanceKm?: number;
  recordedAscentM?: number;
  validatedAscentM?: number;
  descentM?: number;
  sourceSnapshot?: Record<string, unknown>;
  evidence?: CanonicalAdapterEvidenceInput[];
  links?: CanonicalActivityLinkInput[];
}

export interface TrainingManualAdapterInput {
  completionId: string;
  trainingPlanId?: string;
  trainingSessionId: string;
  completedAt: Date;
  activityKind: string;
  durationSeconds?: number;
  estimatedAscentM?: number;
  sourceSnapshot: Record<string, unknown>;
}

export interface ExploreHikeAdapterInput {
  exploreHikeId: string;
  occurredAt: Date;
  activityKind: string;
  durationSeconds?: number;
  distanceKm?: number;
  recordedAscentM?: number;
  evidenceClassification: CanonicalEvidenceClassification;
  sourceSnapshot: Record<string, unknown>;
}

/**
 * Adapters translate one legacy/local source into the canonical write contract.
 * Ownership is deliberately absent: API routes attach the verified Clerk owner.
 */
export interface CanonicalActivityAdapter<TInput> {
  readonly sourceType: CanonicalSourceType;
  adapt(input: TInput): CanonicalActivityAdapterOutput;
}

const SOURCE_TYPE_PATTERN = /^[a-z][a-z0-9._:-]{0,63}$/;
const EXTERNAL_NAMESPACE_PATTERN =
  /^(provider|import):([a-z0-9](?:[a-z0-9._-]{0,62}))$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SOURCE_ID_LENGTH = 256;
const MAX_LINK_TARGET_LENGTH = 256;

function requireStableIdentifier(
  value: string,
  label: string,
  maxLength: number,
): string {
  if (
    value.length === 0
    || value.length > maxLength
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

export function canonicalSourceIdentity(
  sourceType: CanonicalSourceType,
  sourceId: string,
): CanonicalSourceIdentity {
  if (!SOURCE_TYPE_PATTERN.test(sourceType)) {
    throw new Error("Invalid canonical source type");
  }
  return {
    sourceType,
    sourceId: requireStableIdentifier(
      sourceId,
      "canonical source ID",
      MAX_SOURCE_ID_LENGTH,
    ),
  };
}

export function externalCanonicalSourceType(
  kind: "provider" | "import",
  provider: string,
): ExternalCanonicalSourceType {
  const normalizedProvider = provider.toLowerCase();
  const sourceType = `${kind}:${normalizedProvider}`;
  if (!EXTERNAL_NAMESPACE_PATTERN.test(sourceType)) {
    throw new Error("Invalid external canonical source namespace");
  }
  return sourceType as ExternalCanonicalSourceType;
}

export function classifyCanonicalSourceType(
  sourceType: CanonicalSourceType,
):
  | { kind: "built_in"; sourceType: BuiltInCanonicalSourceType }
  | { kind: "provider" | "import"; provider: string }
  | { kind: "legacy"; sourceType: string } {
  if ((BUILT_IN_CANONICAL_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
    return {
      kind: "built_in",
      sourceType: sourceType as BuiltInCanonicalSourceType,
    };
  }
  const external = EXTERNAL_NAMESPACE_PATTERN.exec(sourceType);
  if (external) {
    return { kind: external[1] as "provider" | "import", provider: external[2] };
  }
  if (!SOURCE_TYPE_PATTERN.test(sourceType)) {
    throw new Error("Invalid canonical source type");
  }
  // Existing Phase 1 API values remain valid even when they predate this list.
  return { kind: "legacy", sourceType };
}

export function canonicalSourceIdentityKey(
  identity: CanonicalSourceIdentity,
): string {
  const validated = canonicalSourceIdentity(
    identity.sourceType,
    identity.sourceId,
  );
  return `source:${encodeURIComponent(validated.sourceType)}:${encodeURIComponent(validated.sourceId)}`;
}

export function parseCanonicalSourceIdentityKey(
  value: string,
): CanonicalSourceIdentity {
  const match = /^source:([^:]+):(.+)$/.exec(value);
  if (!match) throw new Error("Invalid canonical source identity key");
  try {
    return canonicalSourceIdentity(
      decodeURIComponent(match[1]),
      decodeURIComponent(match[2]),
    );
  } catch {
    throw new Error("Invalid canonical source identity key");
  }
}

export function sdeMountainTarget(mountainId: string): string {
  if (!UUID_PATTERN.test(mountainId)) {
    throw new Error("Invalid Summit Data Engine mountain ID");
  }
  return `sde:mountain:${mountainId.toLowerCase()}`;
}

export function parseSdeMountainTarget(
  targetId: string,
): { mountainId: string } {
  const match = /^sde:mountain:([0-9a-f-]+)$/i.exec(targetId);
  if (!match || !UUID_PATTERN.test(match[1])) {
    throw new Error("Invalid Summit Data Engine mountain target");
  }
  return { mountainId: match[1].toLowerCase() };
}

export function sdeRouteTarget(identityKey: string, version: string): string {
  const stableIdentityKey = requireStableIdentifier(
    identityKey,
    "Summit Data Engine route identity key",
    160,
  );
  const stableVersion = requireStableIdentifier(
    version,
    "Summit Data Engine route version",
    48,
  );
  const target =
    `sde:route:${encodeURIComponent(stableIdentityKey)}@${encodeURIComponent(stableVersion)}`;
  if (target.length > MAX_LINK_TARGET_LENGTH) {
    throw new Error("Summit Data Engine route target is too long");
  }
  return target;
}

export function parseSdeRouteTarget(
  targetId: string,
): { identityKey: string; version: string } {
  const match = /^sde:route:([^@]+)@(.+)$/.exec(targetId);
  if (!match) throw new Error("Invalid Summit Data Engine route target");
  try {
    const identityKey = decodeURIComponent(match[1]);
    const version = decodeURIComponent(match[2]);
    requireStableIdentifier(
      identityKey,
      "Summit Data Engine route identity key",
      160,
    );
    requireStableIdentifier(version, "Summit Data Engine route version", 48);
    return { identityKey, version };
  } catch {
    throw new Error("Invalid Summit Data Engine route target");
  }
}

export function validateCanonicalLinkTarget(
  link: CanonicalActivityLinkInput,
): CanonicalActivityLinkInput {
  const targetId = requireStableIdentifier(
    link.targetId,
    "canonical link target",
    MAX_LINK_TARGET_LENGTH,
  );
  if (targetId.startsWith("sde:mountain:")) {
    if (link.linkType !== "canonical_hill") {
      throw new Error("Summit Data Engine mountain targets require canonical_hill links");
    }
    parseSdeMountainTarget(targetId);
  } else if (targetId.startsWith("sde:route:")) {
    if (link.linkType !== "canonical_route") {
      throw new Error("Summit Data Engine route targets require canonical_route links");
    }
    parseSdeRouteTarget(targetId);
  } else if (targetId.startsWith("sde:")) {
    throw new Error("Unknown Summit Data Engine link target");
  }
  return { ...link, targetId };
}

export const CANONICAL_EVIDENCE_STORAGE: Readonly<
  Record<CanonicalEvidenceClassification, CanonicalEvidenceStoragePlan>
> = {
  gps_recorded: {
    evidenceState: "recorded_unverified",
    allowedEvidenceTypes: ["gps_track", "elevation_profile", "source_snapshot"],
    classificationMarkerRequired: false,
  },
  estimated_manual: {
    evidenceState: "unverified_manual",
    allowedEvidenceTypes: ["manual_estimate", "source_snapshot"],
    classificationMarkerRequired: false,
  },
  indoor_training: {
    evidenceState: "unverified_manual",
    allowedEvidenceTypes: ["source_snapshot"],
    classificationMarkerRequired: true,
  },
  unavailable_untrusted: {
    evidenceState: "unverified_manual",
    allowedEvidenceTypes: ["source_snapshot"],
    classificationMarkerRequired: true,
  },
};

export function canonicalEvidenceStoragePlan(
  classification: CanonicalEvidenceClassification,
): CanonicalEvidenceStoragePlan {
  return CANONICAL_EVIDENCE_STORAGE[classification];
}

export function validateAdapterOutput(
  output: CanonicalActivityAdapterOutput,
): CanonicalActivityAdapterOutput {
  canonicalSourceIdentity(output.source.sourceType, output.source.sourceId);
  if (!output.activityKind || output.activityKind !== output.activityKind.trim()) {
    throw new Error("Invalid canonical activity kind");
  }
  if (Number.isNaN(output.occurredAt.getTime())) {
    throw new Error("Invalid canonical activity occurrence time");
  }
  if (
    output.startedAt
    && output.endedAt
    && output.endedAt < output.startedAt
  ) {
    throw new Error("Canonical activity end time precedes start time");
  }
  for (const evidence of output.evidence ?? []) {
    const plan = canonicalEvidenceStoragePlan(evidence.classification);
    if (!plan.allowedEvidenceTypes.includes(evidence.evidenceType)) {
      throw new Error(
        `Evidence type ${evidence.evidenceType} is incompatible with ${evidence.classification}`,
      );
    }
  }
  for (const link of output.links ?? []) {
    validateCanonicalLinkTarget(link);
  }
  return output;
}
