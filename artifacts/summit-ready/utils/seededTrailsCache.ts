import type { Trail } from "@/constants/trailData";
import { readCache, writeCache } from "@/utils/asyncCache";

const CACHE_KEY = "summitready_seeded_trails_v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

function toTrail(row: Record<string, unknown>): Trail {
  return {
    id: row["id"] as string,
    name: row["name"] as string,
    location: row["location"] as string,
    distance: row["distance"] as number,
    elevationGain: row["elevationGain"] as number,
    estimatedTime: row["estimatedTime"] as string,
    difficulty: row["difficulty"] as Trail["difficulty"],
    terrain: row["terrain"] as Trail["terrain"],
    routeType: row["routeType"] as Trail["routeType"],
    bestFor: (row["bestFor"] as string[]) as Trail["bestFor"],
    description: row["description"] as string,
    trainingBenefits: (row["trainingBenefits"] as string[]) as Trail["trainingBenefits"],
    emoji: (row["emoji"] as string | undefined) ?? "🥾",
    lat: row["lat"] as number | undefined,
    lng: row["lng"] as number | undefined,
  };
}

export async function loadSeededTrails(): Promise<Trail[]> {
  const cached = await readCache<Trail[]>(CACHE_KEY, CACHE_TTL_MS);
  if (cached) return cached;
  return fetchAndCacheSeededTrails();
}

export async function fetchAndCacheSeededTrails(): Promise<Trail[]> {
  const res = await fetch(`${API_BASE}/seeded-trails`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`seeded-trails fetch failed: ${res.status}`);

  const data = (await res.json()) as { trails: Record<string, unknown>[] };
  const trails = data.trails.map(toTrail);

  await writeCache(CACHE_KEY, trails);

  return trails;
}

export async function clearSeededTrailsCache(): Promise<void> {
  const { clearCache } = await import("@/utils/asyncCache");
  await clearCache(CACHE_KEY);
}
