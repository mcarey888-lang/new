export type ActivityLinked = { id: string; activityId?: string; sourceHikeId?: string };

export function stableActivityId(item: ActivityLinked, kind: string): string {
  return item.activityId ?? `${kind}:${item.id}`;
}

export function upsertByActivityId<T extends ActivityLinked>(
  items: T[],
  incoming: T,
): { items: T[]; id: string; inserted: boolean } {
  if (!incoming.activityId) {
    return { items: [incoming, ...items], id: incoming.id, inserted: true };
  }
  const existing = items.find(item => item.activityId === incoming.activityId);
  if (existing) return { items, id: existing.id, inserted: false };
  return { items: [incoming, ...items], id: incoming.id, inserted: true };
}

export function dedupeLinkedActivities<T extends ActivityLinked>(
  items: T[],
  kind: string,
): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = stableActivityId(item, kind);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeActivityKinds<A extends ActivityLinked, B extends ActivityLinked>(
  first: A[],
  second: B[],
): Array<A | B> {
  const seen = new Set<string>();
  const sourceIds = new Set([...first, ...second].map(item => item.id));
  return [...first, ...second].filter(item => {
    // Explicit legacy training copies are links, not extra activities.
    // Keep the original hike without changing either stored record.
    if (item.sourceHikeId && sourceIds.has(item.sourceHikeId)) return false;
    const key = item.activityId ?? `legacy:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}