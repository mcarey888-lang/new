import { createHash } from "node:crypto";
import { z } from "zod";

export interface ParkingResearchTarget {
  mountainName: string;
  region: string;
  mountainId?: string;
  latitude?: number;
  longitude?: number;
}

export function parkingResearchKey(target: ParkingResearchTarget): string {
  const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  const identity = {
    name: normalize(target.mountainName), region: normalize(target.region),
    id: target.mountainId?.trim() ?? null,
    latitude: target.latitude === undefined ? null : target.latitude.toFixed(3),
    longitude: target.longitude === undefined ? null : target.longitude.toFixed(3),
  };
  return `parking-research:v1:${createHash("sha256").update(JSON.stringify(identity)).digest("hex")}`;
}

export function publicSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || !host.includes(".") ||
        host.endsWith(".local") || host.endsWith(".internal") || host === "localhost" ||
        /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

export const ParkingOptionSchema = z.object({
  id: z.string().min(1).max(180),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().min(1).max(700),
  sourceName: z.string().trim().min(1).max(160),
  sourceUrl: z.string().refine(value => publicSourceUrl(value) !== null),
  directionsQuery: z.string().trim().min(3).max(400)
    .refine(value => !/^-?\d+(\.\d+)?\s*,\s*-?\d/.test(value)),
  lastChecked: z.string().datetime(),
});
export type ParkingSuggestion = z.infer<typeof ParkingOptionSchema>;

export function specificParkingOption(option: Pick<ParkingSuggestion, "name" | "directionsQuery">): boolean {
  // A collection of roadside spaces is not a single destination a map can
  // resolve. Keep general roadside advice out of Get directions options.
  return !/\blay[- ]?bys\b|\broadside (?:spaces|parking)\b|\bparking (?:along|near)\b/i.test(option.name) &&
    !/-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+/.test(option.directionsQuery);
}

const ResearchSchema = z.object({
  options: z.array(ParkingOptionSchema.omit({ id: true, lastChecked: true })).max(4),
});

/** Only source URLs actually returned by web search may back a shared suggestion. */
export function parseParkingResearch(
  text: string, sources: readonly string[], now = new Date(),
): ParkingSuggestion[] {
  const canonical = (value: string) => {
    const valid = publicSourceUrl(value);
    if (!valid) return null;
    const url = new URL(valid);
    for (const key of [...url.searchParams.keys()]) if (key.startsWith("utm_")) url.searchParams.delete(key);
    return `${url.origin}${url.pathname.replace(/\/$/, "")}${url.search}`;
  };
  const allowed = new Set(sources.map(canonical).filter(Boolean));
  const research = ResearchSchema.parse(JSON.parse(text));
  const seen = new Set<string>();
  return research.options.flatMap(option => {
    const source = canonical(option.sourceUrl);
    const name = option.name.toLowerCase();
    if (!source || !allowed.has(source) || seen.has(name) || !specificParkingOption(option)) return [];
    seen.add(name);
    return [{
      ...option, sourceUrl: publicSourceUrl(option.sourceUrl)!,
      id: createHash("sha256").update(`${name}:${source}`).digest("hex").slice(0, 24),
      lastChecked: now.toISOString(),
    }];
  });
}

export function parkingResearchSources(output: unknown): string[] {
  const urls: string[] = [];
  if (!Array.isArray(output)) return urls;
  for (const item of output) {
    if (item?.type === "web_search_call" && Array.isArray(item.action?.sources)) {
      for (const source of item.action.sources) if (typeof source?.url === "string") urls.push(source.url);
    }
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const content of item.content) {
        if (!Array.isArray(content?.annotations)) continue;
        for (const citation of content.annotations) {
          if (citation?.type === "url_citation" && typeof citation.url === "string") urls.push(citation.url);
        }
      }
    }
  }
  return urls;
}
