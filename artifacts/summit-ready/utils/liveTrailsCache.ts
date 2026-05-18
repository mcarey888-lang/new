import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Trail } from "@/constants/trailData";

export const LIVE_TRAILS_CACHE_KEY = "summitready_live_trails_v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface LiveTrailsCache {
  trails: Trail[];
  location: string;
  radius: number;
  cachedAt: number;
}

export function makeTrailId(name: string, location: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `live_${slug(name)}_${slug(location)}`;
}

export async function loadLiveTrailsCache(location: string, radius: number): Promise<Trail[] | null> {
  try {
    const raw = await AsyncStorage.getItem(LIVE_TRAILS_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as LiveTrailsCache;
    if (cache.location !== location || cache.radius !== radius) return null;
    if (Date.now() - cache.cachedAt > CACHE_TTL_MS) return null;
    return cache.trails;
  } catch {
    return null;
  }
}

export async function saveLiveTrailsCache(trails: Trail[], location: string, radius: number): Promise<void> {
  try {
    const payload: LiveTrailsCache = { trails, location, radius, cachedAt: Date.now() };
    await AsyncStorage.setItem(LIVE_TRAILS_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

export async function clearLiveTrailsCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LIVE_TRAILS_CACHE_KEY);
  } catch {}
}

export async function getLiveTrailsCacheTimestamp(location: string, radius: number): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LIVE_TRAILS_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as LiveTrailsCache;
    if (cache.location !== location || cache.radius !== radius) return null;
    return cache.cachedAt;
  } catch {
    return null;
  }
}

export async function readLiveTrailsFromCache(): Promise<Trail[]> {
  try {
    const raw = await AsyncStorage.getItem(LIVE_TRAILS_CACHE_KEY);
    if (!raw) return [];
    const cache = JSON.parse(raw) as LiveTrailsCache;
    return cache.trails ?? [];
  } catch {
    return [];
  }
}
