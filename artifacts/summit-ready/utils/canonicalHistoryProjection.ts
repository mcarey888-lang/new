export type HistoryContext = "training" | "expeditions" | "mountains_free_hike";

export type LegacyHistoryItem = {
  legacyKey: string;
  title: string;
  occurredAt: string;
  canonicalActivityId?: string | null;
};

export type CanonicalHistoryItem = {
  id: string;
  sourceId: string;
  title: string;
  occurredAt: string;
  matchedContexts: readonly HistoryContext[];
  evidenceState: string;
  lifecycle: string;
};

export type CanonicalHistoryResponse = {
  status: "active" | "shadowed" | "unavailable";
  reason?: string | null;
  items: readonly CanonicalHistoryItem[];
};

export type HistoryDisplayItem =
  | (CanonicalHistoryItem & { kind: "canonical"; legacyKey?: never })
  | (LegacyHistoryItem & { kind: "legacy" });

export function buildPrivateHistoryDisplay(input: {
  legacy: readonly LegacyHistoryItem[];
  canonical: CanonicalHistoryResponse;
  filter?: HistoryContext | "all";
}): {
  status: "canonical" | "legacy_fallback";
  reason?: string;
  items: readonly HistoryDisplayItem[];
} {
  if (input.canonical.status !== "active") {
    return {
      status: "legacy_fallback",
      reason: input.canonical.reason ?? "canonical_history_unavailable",
      items: input.legacy.map((item) => ({ ...item, kind: "legacy" as const })),
    };
  }
  const selectedFilter = input.filter;
  // The active canonical set is the identity authority even when a context
  // filter hides a row. A linked legacy copy must not reappear as a duplicate
  // merely because its canonical activity is outside the selected context.
  const activeCanonicalIds = new Set(input.canonical.items.map((item) => item.id));
  const filtered = selectedFilter && selectedFilter !== "all"
    ? input.canonical.items.filter((item) => item.matchedContexts.includes(selectedFilter))
    : input.canonical.items;
  const preservedLegacy = input.legacy.filter((item) =>
    !item.canonicalActivityId || !activeCanonicalIds.has(item.canonicalActivityId),
  );
  return {
    status: "canonical",
    items: [
      ...filtered.map((item) => ({ ...item, kind: "canonical" as const })),
      ...preservedLegacy.map((item) => ({ ...item, kind: "legacy" as const })),
    ].sort((left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    ),
  };
}