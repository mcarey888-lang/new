import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { selectBatchKeys } from "@/utils/hikeReliability";

export const ACTIVE_HIKE_KEY = "summitready_active_hike_session";
const ACTIVE_HIKE_OWNER_KEY = "summitready_active_hike_owner_v1";
export const HIKE_LOCATION_TASK = "hike-location-task";

type ActiveHikeIdentity = {
  routeId?: string;
  userId?: string;
};

export function activeHikeKey(userId: string): string {
  return `${ACTIVE_HIKE_KEY}_${userId}`;
}

export async function writeActiveHike(checkpoint: ActiveHikeIdentity): Promise<void> {
  if (!checkpoint.userId) {
    await AsyncStorage.setItem(ACTIVE_HIKE_KEY, JSON.stringify(checkpoint));
    return;
  }
  await AsyncStorage.multiSet([
    [activeHikeKey(checkpoint.userId), JSON.stringify(checkpoint)],
    [ACTIVE_HIKE_OWNER_KEY, checkpoint.userId],
  ]);
}

export async function readActiveHike<T extends ActiveHikeIdentity>(userId: string): Promise<T | null> {
  const namespaced = await AsyncStorage.getItem(activeHikeKey(userId));
  if (namespaced) return JSON.parse(namespaced) as T;

  // One-time migration for checkpoints created before per-user namespacing.
  const legacy = await AsyncStorage.getItem(ACTIVE_HIKE_KEY);
  if (!legacy) return null;
  const checkpoint = JSON.parse(legacy) as T;
  if (checkpoint.userId !== userId) return null;
  await writeActiveHike(checkpoint);
  await AsyncStorage.removeItem(ACTIVE_HIKE_KEY);
  return checkpoint;
}

export async function readBackgroundActiveHike<T extends ActiveHikeIdentity>(): Promise<T | null> {
  const ownerUserId = await AsyncStorage.getItem(ACTIVE_HIKE_OWNER_KEY);
  if (ownerUserId) return readActiveHike<T>(ownerUserId);
  const legacy = await AsyncStorage.getItem(ACTIVE_HIKE_KEY);
  return legacy ? JSON.parse(legacy) as T : null;
}

export async function clearActiveHike(userId?: string): Promise<void> {
  if (!userId) {
    await AsyncStorage.removeItem(ACTIVE_HIKE_KEY);
    return;
  }
  const ownerUserId = await AsyncStorage.getItem(ACTIVE_HIKE_OWNER_KEY);
  const keys = [activeHikeKey(userId)];
  if (ownerUserId === userId) keys.push(ACTIVE_HIKE_OWNER_KEY);
  await AsyncStorage.multiRemove(keys);
}

async function stopBackgroundLocationTask(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Location = await import("expo-location");
    const isRunning = await Location.hasStartedLocationUpdatesAsync(HIKE_LOCATION_TASK)
      .catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(HIKE_LOCATION_TASK).catch(() => {});
    }
  } catch {
    // The checkpoint is still removed even if the native task is unavailable.
  }
}

export async function discardActiveHike(
  checkpoint?: ActiveHikeIdentity | null,
): Promise<void> {
  let routeId = checkpoint?.routeId;
  if (!routeId) {
    try {
      const storedCheckpoint = checkpoint?.userId
        ? await readActiveHike<ActiveHikeIdentity>(checkpoint.userId)
        : await readBackgroundActiveHike<ActiveHikeIdentity>();
      if (storedCheckpoint) routeId = storedCheckpoint.routeId;
    } catch {}
  }

  // Remove the producer's source record first so any in-flight callback exits.
  await clearActiveHike(checkpoint?.userId).catch(() => {});
  await stopBackgroundLocationTask();

  if (!routeId) return;
  try {
    const queuedKeys = selectBatchKeys(await AsyncStorage.getAllKeys(), routeId);
    if (queuedKeys.length > 0) await AsyncStorage.multiRemove(queuedKeys);
  } catch {}
}