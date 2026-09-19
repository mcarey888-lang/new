import type { CanonicalActivityLinkInput } from "./canonicalActivityContracts";

export type CanonicalHistoryFilter =
  | "all"
  | "training"
  | "expeditions"
  | "mountains_free_hike";

export interface CanonicalHistoryActivity {
  id: string;
  ownerUserId: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: string | null;
  primaryContext: "training" | "expedition" | "free_hike" | "mountain_simulation";
  activityKind: string;
  occurredAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  distanceKm: number | null;
  recordedAscentM: number | null;
  validatedAscentM: number | null;
  descentM: number | null;
  lifecycle: string;
  evidenceState: string;
  visibility: string;
  links?: readonly CanonicalActivityLinkInput[];
}

export interface CanonicalHistoryProjection extends CanonicalHistoryActivity {
  matchedContexts: readonly Exclude<CanonicalHistoryFilter, "all">[];
  links: readonly CanonicalActivityLinkInput[];
}

export interface CanonicalHistoryProjectionOptions {
  ownerUserId: string;
  filter?: CanonicalHistoryFilter;
}

const TRAINING_LINKS = new Set(["training_plan", "training_session"]);
const EXPEDITION_LINKS = new Set(["expedition", "expedition_stage"]);
const MOUNTAIN_FREE_HIKE_LINKS = new Set([
  "canonical_hill",
  "canonical_route",
  "community_route",
]);

function linkKey(link: CanonicalActivityLinkInput): string {
  return `${link.linkType}\u001f${link.targetId}`;
}

function contextMatches(
  activity: CanonicalHistoryActivity,
): Exclude<CanonicalHistoryFilter, "all">[] {
  const contexts = new Set<Exclude<CanonicalHistoryFilter, "all">>();
  const links = activity.links ?? [];

  if (
    activity.primaryContext === "training"
    || links.some((link) => TRAINING_LINKS.has(link.linkType))
  ) {
    contexts.add("training");
  }
  if (
    activity.primaryContext === "expedition"
    || links.some((link) => EXPEDITION_LINKS.has(link.linkType))
  ) {
    contexts.add("expeditions");
  }
  if (
    activity.primaryContext === "free_hike"
    || links.some((link) => MOUNTAIN_FREE_HIKE_LINKS.has(link.linkType))
  ) {
    contexts.add("mountains_free_hike");
  }

  return ["training", "expeditions", "mountains_free_hike"].filter(
    (context) => contexts.has(context as Exclude<CanonicalHistoryFilter, "all">),
  ) as Exclude<CanonicalHistoryFilter, "all">[];
}

function mergeCanonicalActivities(
  activities: readonly CanonicalHistoryActivity[],
  ownerUserId: string,
): CanonicalHistoryProjection[] {
  const byId = new Map<string, CanonicalHistoryProjection>();

  for (const activity of activities) {
    if (activity.ownerUserId !== ownerUserId || activity.lifecycle === "deleted") continue;
    const existing = byId.get(activity.id);
    if (!existing) {
      const links = [...(activity.links ?? [])];
      const merged = {
        ...activity,
        links,
        matchedContexts: [],
      } satisfies CanonicalHistoryProjection;
      merged.matchedContexts = contextMatches(merged);
      byId.set(activity.id, merged);
      continue;
    }

    const links = new Map(existing.links.map((link) => [linkKey(link), link]));
    for (const link of activity.links ?? []) links.set(linkKey(link), link);
    existing.links = [...links.values()];
    existing.matchedContexts = contextMatches(existing);
  }

  return [...byId.values()].sort(
    (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime(),
  );
}

export function projectCanonicalActivityHistory(
  activities: readonly CanonicalHistoryActivity[],
  options: CanonicalHistoryProjectionOptions,
): CanonicalHistoryProjection[] {
  if (!options.ownerUserId.trim()) {
    throw new Error("Canonical history owner is required");
  }

  const normalized = mergeCanonicalActivities(activities, options.ownerUserId);
  if (!options.filter || options.filter === "all") return normalized;
  return normalized.filter((activity) =>
    activity.matchedContexts.includes(options.filter as Exclude<CanonicalHistoryFilter, "all">),
  );
}

export interface LegacyHistoryEntry {
  legacyKey: string;
  ownerUserId: string;
  canonicalActivityId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
}

export type CanonicalHistoryMismatch =
  | {
      type: "legacy_missing_canonical";
      legacyKey: string;
    }
  | {
      type: "canonical_missing_legacy";
      canonicalActivityId: string;
    }
  | {
      type: "legacy_owner_mismatch";
      legacyKey: string;
      canonicalActivityId: string;
    }
  | {
      type: "legacy_source_mismatch";
      legacyKey: string;
      canonicalActivityId: string;
    }
  | {
      type: "legacy_duplicate_canonical";
      canonicalActivityId: string;
      legacyKeys: readonly string[];
    };

export interface CanonicalHistoryMismatchReport {
  checkedCanonicalActivityIds: readonly string[];
  checkedLegacyKeys: readonly string[];
  mismatches: readonly CanonicalHistoryMismatch[];
}

/**
 * Compares a canonical projection with a legacy read model without changing
 * either source. It intentionally reports ambiguity instead of fuzzy linking.
 */
export function compareCanonicalHistoryWithLegacy(
  canonical: readonly CanonicalHistoryProjection[],
  legacy: readonly LegacyHistoryEntry[],
  ownerUserId: string,
): CanonicalHistoryMismatchReport {
  const activeCanonical = canonical.filter((activity) => activity.lifecycle !== "deleted");
  const ownerCanonical = activeCanonical.filter((activity) => activity.ownerUserId === ownerUserId);
  const ownerLegacy = legacy.filter((entry) => entry.ownerUserId === ownerUserId);
  const canonicalById = new Map(activeCanonical.map((activity) => [activity.id, activity]));
  const legacyByCanonicalId = new Map<string, LegacyHistoryEntry[]>();
  const mismatches: CanonicalHistoryMismatch[] = [];

  for (const entry of ownerLegacy) {
    if (!entry.canonicalActivityId) {
      mismatches.push({
        type: "legacy_missing_canonical",
        legacyKey: entry.legacyKey,
      });
      continue;
    }

    const activity = canonicalById.get(entry.canonicalActivityId);
    if (!activity) {
      mismatches.push({
        type: "legacy_missing_canonical",
        legacyKey: entry.legacyKey,
      });
      continue;
    }
    if (activity.ownerUserId !== ownerUserId) {
      mismatches.push({
        type: "legacy_owner_mismatch",
        legacyKey: entry.legacyKey,
        canonicalActivityId: entry.canonicalActivityId,
      });
      continue;
    }

    const linked = legacyByCanonicalId.get(activity.id) ?? [];
    linked.push(entry);
    legacyByCanonicalId.set(activity.id, linked);

    if (
      (entry.sourceType !== undefined
        && entry.sourceType !== null
        && entry.sourceType !== activity.sourceType)
      || (entry.sourceId !== undefined
        && entry.sourceId !== null
        && entry.sourceId !== activity.sourceId)
    ) {
      mismatches.push({
        type: "legacy_source_mismatch",
        legacyKey: entry.legacyKey,
        canonicalActivityId: activity.id,
      });
    }
  }

  for (const activity of ownerCanonical) {
    const linked = legacyByCanonicalId.get(activity.id) ?? [];
    if (linked.length === 0) {
      mismatches.push({
        type: "canonical_missing_legacy",
        canonicalActivityId: activity.id,
      });
    } else if (linked.length > 1) {
      mismatches.push({
        type: "legacy_duplicate_canonical",
        canonicalActivityId: activity.id,
        legacyKeys: linked.map((entry) => entry.legacyKey),
      });
    }
  }

  return {
    checkedCanonicalActivityIds: ownerCanonical.map((activity) => activity.id),
    checkedLegacyKeys: ownerLegacy.map((entry) => entry.legacyKey),
    mismatches,
  };
}
