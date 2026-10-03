import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MountainLookupResponse } from "./mountainDetailPresentation";
import type { MountainParkingOption } from "./mountainParkingOptions";
import { mapExploreRoute, selectCanonicalRoute, type CanonicalRouteRecord } from "./routeIntelligence";
import { routeEligibility } from "./routeEligibility";

export interface MountainCacheRequest {
  name: string;
  region?: string;
  country?: string;
  catalogueId?: string;
  discoveryId?: string;
}
export interface MountainPageCache {
  lookup: MountainLookupResponse;
  description: string | null;
  savedAt: number;
}
export interface MountainRoutePackage {
  schemaVersion: 1;
  ownerUserId: string;
  record: CanonicalRouteRecord;
  parkingOptions: readonly MountainParkingOption[];
  savedAt: number;
  sizeBytes: number;
}

const queues = new Map<string, Promise<unknown>>();
async function mutate<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
  queues.set(key, next);
  try { return await next; }
  finally { if (queues.get(key) === next) queues.delete(key); }
}
export function mountainPageCacheKey(request: MountainCacheRequest): string {
  // All location and catalogue context participates. Never match by name alone.
  return `mountain_hub_public_v1:${encodeURIComponent(JSON.stringify([
    request.name, request.region ?? "", request.country ?? "",
    request.catalogueId ?? "", request.discoveryId ?? "",
  ]))}`;
}
export async function readMountainPageCache(request: MountainCacheRequest): Promise<MountainPageCache | null> {
  const key = mountainPageCacheKey(request);
  await queues.get(key)?.catch(() => {});
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as MountainPageCache;
    if (typeof value.lookup?.mountainName !== "string" || !value.lookup.mountainName.trim() ||
        !Number.isFinite(value.savedAt) ||
        (value.lookup.routes !== undefined && !Array.isArray(value.lookup.routes))) return null;
    return { ...value, description: typeof value.description === "string" ? value.description : null };
  } catch { return null; }
}
export async function writeMountainPageCache(
  request: MountainCacheRequest, lookup: MountainLookupResponse, description?: string | null,
): Promise<void> {
  const key = mountainPageCacheKey(request);
  await mutate(key, async () => {
    const raw = await AsyncStorage.getItem(key);
    let previous: MountainPageCache | null = null;
    try { previous = raw ? JSON.parse(raw) : null; } catch { /* Replace corrupt public cache. */ }
    const value: MountainPageCache = {
      lookup,
      description: description === undefined ? previous?.description ?? null : description,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(value));
  });
}
export function mountainRoutePackageKey(owner: string, routeId: string): string {
  if (!owner.trim() || !routeId.trim()) throw new Error("A signed-in owner and route identity are required.");
  return `mountain_route_data_v1:${encodeURIComponent(owner)}:${encodeURIComponent(routeId)}`;
}
function usableRecord(record: CanonicalRouteRecord): boolean {
  try {
    const result = selectCanonicalRoute({
      routeId: record.route.version.routeId,
      mountainId: record.mountain.id,
      candidates: [record],
    });
    return routeEligibility(mapExploreRoute(result)).isNavigable;
  } catch { return false; }
}
export async function readMountainRoutePackage(
  owner: string, routeId: string, mountainId: string, expectedVersion?: string,
): Promise<MountainRoutePackage | null> {
  const key = mountainRoutePackageKey(owner, routeId);
  await queues.get(key)?.catch(() => {});
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as MountainRoutePackage;
    if (value.schemaVersion !== 1 || value.ownerUserId !== owner ||
        value.record?.route?.version?.routeId !== routeId ||
        value.record?.mountain?.id !== mountainId ||
        value.record?.route?.version?.mountainId !== mountainId ||
        (expectedVersion && value.record.route.version.version !== expectedVersion) ||
        !Number.isFinite(value.savedAt) || !Number.isFinite(value.sizeBytes) ||
        !Array.isArray(value.parkingOptions) || !usableRecord(value.record)) return null;
    return value;
  } catch { return null; }
}
export async function saveMountainRoutePackage(
  owner: string, record: CanonicalRouteRecord, parkingOptions: readonly MountainParkingOption[] = [],
): Promise<MountainRoutePackage> {
  const snapshot = JSON.parse(JSON.stringify(record)) as CanonicalRouteRecord;
  const parkingSnapshot = JSON.parse(JSON.stringify(parkingOptions)) as MountainParkingOption[];
  if (!usableRecord(snapshot)) {
    throw new Error("This route has no eligible, licensed geometry. A route guide cannot be downloaded as a mapped route.");
  }
  const key = mountainRoutePackageKey(owner, snapshot.route.version.routeId);
  return mutate(key, async () => {
    const value: MountainRoutePackage = {
      schemaVersion: 1, ownerUserId: owner, record: snapshot, parkingOptions: parkingSnapshot,
      savedAt: Date.now(), sizeBytes: 0,
    };
    // UTF-8 byte count, without depending on a browser-only TextEncoder.
    for (let i = 0; i < 3; i++) {
      value.sizeBytes = encodeURIComponent(JSON.stringify(value)).replace(/%[0-9A-F]{2}/g, "x").length;
    }
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return JSON.parse(JSON.stringify(value)) as MountainRoutePackage;
  });
}
export async function removeMountainRoutePackage(owner: string, routeId: string): Promise<void> {
  const key = mountainRoutePackageKey(owner, routeId);
  await mutate(key, () => AsyncStorage.removeItem(key));
}