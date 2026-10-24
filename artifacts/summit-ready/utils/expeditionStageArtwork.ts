import { canonicalMountainImageUrl } from "./mountainHero";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalize = (value: string) => value.normalize("NFKD").replace(/\p{Diacritic}/gu, "")
  .toLowerCase().trim().replace(/\s+/g, " ");

/** A stage may describe a route, but generated artwork represents its mountain,
 * not proof of the ridge/path geometry. Never resolve by a loose nearby match. */
export async function expeditionStageArtwork(
  input: { name: string; latitude: number; longitude: number },
  apiBase: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const name = input.name.split(/\s+via\s+/i)[0]!.trim();
  if (!name || /\b(?:and|tour|traverse|circuit)\b|[&/]/i.test(name) ||
      !Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) ||
      Math.abs(input.latitude) > 90 || Math.abs(input.longitude) > 180) return null;
  const response = await fetch(`${apiBase}/mountain-discovery?q=${encodeURIComponent(name)}&limit=50`, { signal });
  if (!response.ok) throw new Error(`Mountain artwork identity lookup failed (${response.status})`);
  const data = await response.json() as {
    hasMore?: boolean;
    items?: { id: string; name: string; source: string; verificationStatus: string;
      latitude: number; longitude: number; region?: string; country?: string }[];
  };
  if (data.hasMore) return null;
  const matches = (data.items ?? []).filter(item => {
    // DoBIH catalogue entries retain "imported". This is only a candidate ID:
    // hero-status/request-hero enforce the server's canonical source-evidence
    // predicate before returning artwork or permitting any paid generation.
    if (!UUID.test(item.id) || item.source !== "catalogue" ||
        !["verified", "imported"].includes(item.verificationStatus) || normalize(item.name) !== normalize(name) ||
        !Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) return false;
    const dy = (item.latitude - input.latitude) * 111_320;
    const dx = (item.longitude - input.longitude) * 111_320 * Math.cos(input.latitude * Math.PI / 180);
    return Math.hypot(dx, dy) <= 2000;
  });
  if (matches.length !== 1) return null;
  const mountain = matches[0]!;
  return canonicalMountainImageUrl(apiBase, mountain.id, mountain.name,
    [mountain.region, mountain.country].filter(Boolean).join(", "));
}
