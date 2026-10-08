/** Mountain heights and route climbs are deliberately separate quantities. */
export type ExploreSort = "recommended" | "name_asc" | "summit_desc" | "summit_asc"
  | "ascent_desc" | "ascent_asc" | "time_asc" | "time_desc" | "difficulty_asc" | "difficulty_desc";

export interface ExploreFilters {
  kind: "all" | "mountains" | "routes";
  difficulty: "any" | "Easy" | "Moderate" | "Hard";
  summitMinM: number | null;
  summitMaxM: number | null;
  ascentMinM: number | null;
  ascentMaxM: number | null;
  timeMinMinutes: number | null;
  timeMaxMinutes: number | null;
}

export const DEFAULT_EXPLORE_FILTERS: ExploreFilters = {
  kind: "all", difficulty: "any", summitMinM: null, summitMaxM: null,
  ascentMinM: null, ascentMaxM: null, timeMinMinutes: null, timeMaxMinutes: null,
};

export const EXPLORE_SORT_LABELS: Record<ExploreSort, string> = {
  recommended: "Recommended",
  name_asc: "Name: A–Z",
  summit_desc: "Summit height: highest first",
  summit_asc: "Summit height: lowest first",
  ascent_desc: "Route ascent: most first",
  ascent_asc: "Route ascent: least first",
  time_asc: "Route time: shortest first",
  time_desc: "Route time: longest first",
  difficulty_asc: "Route difficulty: easiest first",
  difficulty_desc: "Route difficulty: hardest first",
};

export function activeExploreFilterCount(f: ExploreFilters): number {
  return Number(f.kind !== "all") + Number(f.difficulty !== "any")
    + Number(f.summitMinM != null || f.summitMaxM != null)
    + Number(f.ascentMinM != null || f.ascentMaxM != null)
    + Number(f.timeMinMinutes != null || f.timeMaxMinutes != null);
}

/** For a source-provided range, use its upper estimate rather than promise a shorter day. */
export function exploreDurationMinutes(value?: string | null): number | null {
  if (!value?.trim()) return null;
  if (/^\s*-/.test(value)) return null;
  const repeatedUnits = value.match(/^(.+?[a-z])\s*(?:–|—|-|to)\s*(.+[a-z])$/i);
  if (repeatedUnits) {
    const first = exploreDurationMinutes(repeatedUnits[1]), second = exploreDurationMinutes(repeatedUnits[2]);
    return first == null || second == null ? null : Math.max(first, second);
  }
  const text = value.toLowerCase().replace(/(\d+(?:\.\d+)?)\s*(?:–|—|-|to)\s*(\d+(?:\.\d+)?)/g, "$2");
  const units = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)(?=\s|\d|$|,)/g;
  let total = 0, found = false;
  for (const match of text.matchAll(units)) {
    found = true;
    total += Number(match[1]) * (match[2].startsWith("h") ? 60 : 1);
  }
  // A bare number or descriptive text is not a duration with known units.
  return found && Number.isFinite(total) && total >= 0 ? total : null;
}

export interface ExploreRouteTraits {
  name: string;
  location?: string | null;
  region?: string | null;
  difficulty?: string | null;
  elevationGain?: number | null;
  estimatedTime?: string | null;
}

const difficultyRank = (value?: string | null): number | null => {
  const rank = ["easy", "moderate", "hard"].indexOf(value?.toLowerCase() ?? "");
  return rank < 0 ? null : rank;
};

function inRange(value: number | null | undefined, min: number | null, max: number | null): boolean {
  if (min == null && max == null) return true;
  if (value == null || !Number.isFinite(value)) return false;
  return (min == null || value >= min) && (max == null || value <= max);
}

function compareKnown(a: number | null | undefined, b: number | null | undefined, descending: boolean): number {
  const knownA = a != null && Number.isFinite(a), knownB = b != null && Number.isFinite(b);
  if (!knownA || !knownB) return Number(knownB) - Number(knownA);
  return descending ? b! - a! : a! - b!;
}

export function filterExploreRoutes<T extends ExploreRouteTraits>(
  items: T[], query: string, filters: ExploreFilters, sort: ExploreSort,
): T[] {
  if (filters.kind === "mountains") return [];
  const term = query.trim().toLocaleLowerCase();
  return items.filter(item => {
    const text = [item.name, item.location, item.region].filter(Boolean).join(" ").toLocaleLowerCase();
    return (!term || text.includes(term))
      && (filters.difficulty === "any" || item.difficulty?.toLowerCase() === filters.difficulty.toLowerCase())
      && inRange(item.elevationGain, filters.ascentMinM, filters.ascentMaxM)
      && inRange(exploreDurationMinutes(item.estimatedTime), filters.timeMinMinutes, filters.timeMaxMinutes);
  }).sort((a, b) => {
    let result = 0;
    if (sort.startsWith("ascent_")) result = compareKnown(a.elevationGain, b.elevationGain, sort === "ascent_desc");
    if (sort.startsWith("time_")) result = compareKnown(exploreDurationMinutes(a.estimatedTime), exploreDurationMinutes(b.estimatedTime), sort === "time_desc");
    if (sort.startsWith("difficulty_")) result = compareKnown(difficultyRank(a.difficulty), difficultyRank(b.difficulty), sort === "difficulty_desc");
    return result || (sort === "recommended" ? 0 : a.name.localeCompare(b.name));
  });
}

/** Server-side mountain ordering/ranges apply before pagination, never to a loaded subset. */
export function mountainDiscoveryParameters(filters: ExploreFilters, sort: ExploreSort): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.summitMinM != null) params.set("summitMinM", String(filters.summitMinM));
  if (filters.summitMaxM != null) params.set("summitMaxM", String(filters.summitMaxM));
  params.set("sort", sort.startsWith("summit_") || sort === "name_asc" ? sort : "recommended");
  return params;
}
