import type { SummitGoal } from "@/context/AppContext";
import type {
  ReadinessTarget,
  ReadinessTargetFactName,
  ReadinessTargetFactProvenance,
} from "./readinessV2";

export type TargetDemandSource =
  | "sde_verified"
  | "approved_route"
  | "goal_metadata";

export type VerifiedSdeTargetFacts = {
  mountainId: string;
  routeId?: string | null;
  distanceKm?: number | null;
  ascentM?: number | null;
  expectedDurationMinutes?: number | null;
  terrainTags?: readonly string[] | null;
  summitDate?: string | null;
};

export type ApprovedRouteTargetFacts = {
  mountainId?: string | null;
  routeId: string;
  distanceKm?: number | null;
  ascentM?: number | null;
  expectedDurationMinutes?: number | null;
  terrainTags?: readonly string[] | null;
  summitDate?: string | null;
};

export type ReleasedGoalTargetMetadata = {
  mountainId?: string | null;
  routeId?: string | null;
  mountainName?: string | null;
  distanceKm?: number | null;
  ascentM?: number | null;
  expectedDurationMinutes?: number | null;
  terrainTags?: readonly string[] | null;
  summitDate?: string | null;
};

export type TargetDemandSources = {
  sde?: VerifiedSdeTargetFacts | null;
  approvedRoute?: ApprovedRouteTargetFacts | null;
  goal?: ReleasedGoalTargetMetadata | null;
};

export type TargetDemandResolution = {
  target: ReadinessTarget;
  source: "sde_verified" | "approved_route" | "goal_metadata" | "unknown";
  unknownFacts: ReadinessTargetFactName[];
  warnings: string[];
};

const FACTS: ReadonlyArray<ReadinessTargetFactName> = [
  "mountainId",
  "routeId",
  "distanceKm",
  "ascentM",
  "expectedDurationMinutes",
  "terrainTags",
  "summitDate",
];

function stableId(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function positive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function tags(value: readonly string[] | null | undefined): readonly string[] | null {
  if (!value) return null;
  const normalized = [...new Set(value.filter(tag => typeof tag === "string" && tag.trim()).map(tag => tag.trim()))];
  return normalized.length ? normalized : null;
}

function date(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

function provenance(
  source: ReadinessTargetFactProvenance["source"],
): ReadinessTargetFactProvenance {
  return {
    source,
    confidence: source === "sde_verified" ? "verified" : source === "approved_route" ? "approved" : source === "goal_metadata" ? "fallback" : "unknown",
  };
}

function goalMetadataFromSummitGoal(goal: Pick<
  SummitGoal,
  "mountainName" | "summitDate" | "distance" | "elevationGain" | "targetMountain" | "virtualExpeditionProvenance"
>): ReleasedGoalTargetMetadata {
  const target = goal.targetMountain;
  const provenanceData = goal.virtualExpeditionProvenance;
  return {
    mountainId: provenanceData?.targetMountainSource?.startsWith("sde:")
      ? provenanceData.targetMountainSource.slice(4)
      : null,
    routeId: provenanceData?.selectedTargetRouteIdentityKey ?? null,
    mountainName: goal.mountainName,
    distanceKm: positive(target?.totalDistance) ?? positive(goal.distance),
    ascentM: positive(target?.totalElevationGain) ?? positive(goal.elevationGain),
    expectedDurationMinutes: null,
    terrainTags: null,
    summitDate: date(goal.summitDate),
  };
}

export function releasedGoalMetadataFromSummitGoal(
  goal: Pick<
    SummitGoal,
    "mountainName" | "summitDate" | "distance" | "elevationGain" | "targetMountain" | "virtualExpeditionProvenance"
  >,
): ReleasedGoalTargetMetadata {
  return goalMetadataFromSummitGoal(goal);
}

/**
 * Resolve each target fact independently. This is intentionally synchronous and
 * accepts already-verified facts from an API/cache boundary; it never performs
 * name lookup, fuzzy matching, geography inference, or SDE writes.
 */
export function resolveReadinessTargetDemand(
  sources: TargetDemandSources,
): TargetDemandResolution {
  const sde = sources.sde ?? null;
  const route = sources.approvedRoute ?? null;
  const goal = sources.goal ?? null;
  const provenanceMap: Partial<Record<ReadinessTargetFactName, ReadinessTargetFactProvenance>> = {};
  const unknownFacts: ReadinessTargetFactName[] = [];
  const warnings: string[] = [];

  const target: ReadinessTarget = {};
  const choose = <T>(
    fact: ReadinessTargetFactName,
    values: ReadonlyArray<{ value: T | null; source: TargetDemandResolution["source"] }>,
    normalize: (value: T | null) => T | null,
  ): void => {
    for (const candidate of values) {
      const value = normalize(candidate.value);
      if (value !== null) {
        (target as Record<string, unknown>)[fact] = value;
        provenanceMap[fact] = provenance(candidate.source);
        return;
      }
    }
    provenanceMap[fact] = provenance("unknown");
    unknownFacts.push(fact);
  };

  choose("mountainId", [
    { value: sde?.mountainId ?? null, source: "sde_verified" },
    { value: route?.mountainId ?? null, source: "approved_route" },
    { value: goal?.mountainId ?? null, source: "goal_metadata" },
  ], stableId);
  choose("routeId", [
    { value: sde?.routeId ?? null, source: "sde_verified" },
    { value: route?.routeId ?? null, source: "approved_route" },
    { value: goal?.routeId ?? null, source: "goal_metadata" },
  ], stableId);
  choose("distanceKm", [
    { value: sde?.distanceKm ?? null, source: "sde_verified" },
    { value: route?.distanceKm ?? null, source: "approved_route" },
    { value: goal?.distanceKm ?? null, source: "goal_metadata" },
  ], positive);
  choose("ascentM", [
    { value: sde?.ascentM ?? null, source: "sde_verified" },
    { value: route?.ascentM ?? null, source: "approved_route" },
    { value: goal?.ascentM ?? null, source: "goal_metadata" },
  ], positive);
  choose("expectedDurationMinutes", [
    { value: sde?.expectedDurationMinutes ?? null, source: "sde_verified" },
    { value: route?.expectedDurationMinutes ?? null, source: "approved_route" },
    { value: goal?.expectedDurationMinutes ?? null, source: "goal_metadata" },
  ], positive);
  choose("terrainTags", [
    { value: sde?.terrainTags ?? null, source: "sde_verified" },
    { value: route?.terrainTags ?? null, source: "approved_route" },
    { value: goal?.terrainTags ?? null, source: "goal_metadata" },
  ], tags);
  choose("summitDate", [
    { value: sde?.summitDate ?? null, source: "sde_verified" },
    { value: route?.summitDate ?? null, source: "approved_route" },
    { value: goal?.summitDate ?? null, source: "goal_metadata" },
  ], date);

  target.provenance = provenanceMap;
  if (!target.mountainId && !target.routeId) {
    warnings.push("No stable mountain or route identity is available.");
  }
  if (unknownFacts.includes("distanceKm")) warnings.push("Verified target distance is unavailable.");
  if (unknownFacts.includes("ascentM")) warnings.push("Verified target ascent is unavailable.");

  const firstSource = FACTS
    .map(fact => provenanceMap[fact]?.source)
    .find((source): source is TargetDemandResolution["source"] => source !== undefined && source !== "unknown")
    ?? "unknown";
  return { target, source: firstSource, unknownFacts, warnings };
}
