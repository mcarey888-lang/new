import type { CanonicalRouteRecord } from "./routeIntelligence";

export interface MountainHazardNote {
  label: string;
  routeName: string;
  sourceName: string;
  sourceUrl?: string;
  retrievedAt?: string;
  confidence: "Sourced note" | "Needs review";
}
/** Route facts retain their evidence; a plain AI string is not a hazard assessment. */
export function mountainHazardNotes(record: CanonicalRouteRecord | null): MountainHazardNote[] {
  if (!record?.facts) return [];
  return [record.facts.terrain, record.facts.technicalCharacter].flatMap(fact => {
    if (!fact || typeof fact.value !== "string" || !fact.value.trim() ||
        !fact.source?.provider?.trim()) return [];
    const source = fact.source;
    let sourceUrl: string | undefined;
    try {
      const url = new URL(source.sourceUrl ?? "");
      if (url.protocol === "https:" || url.protocol === "http:") sourceUrl = url.toString();
    } catch { /* Publisher attribution remains visible without inventing a URL. */ }
    return [{
      label: fact.value.trim(), routeName: record.route.canonicalName,
      sourceName: source.provider,
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(source.retrievedAt && Number.isFinite(Date.parse(source.retrievedAt)) ? { retrievedAt: source.retrievedAt } : {}),
      confidence: source.qaFlags?.length ? "Needs review" as const : "Sourced note" as const,
    }];
  });
}