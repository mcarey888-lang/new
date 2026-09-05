import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { selectBatchKeys } from "@/utils/hikeReliability";

export const ACTIVE_HIKE_KEY = "summitready_active_hike_session";
export const HIKE_LOCATION_TASK = "hike-location-task";

type ActiveHikeIdentity = {
  routeId?: string;
};

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
      const raw = await AsyncStorage.getItem(ACTIVE_HIKE_KEY);
      if (raw) routeId = (JSON.parse(raw) as ActiveHikeIdentity).routeId;
    } catch {}
  }

  // Remove the producer's source record first so any in-flight callback exits.
  await AsyncStorage.removeItem(ACTIVE_HIKE_KEY).catch(() => {});
  await stopBackgroundLocationTask();

  if (!routeId) return;
  try {
    const queuedKeys = selectBatchKeys(await AsyncStorage.getAllKeys(), routeId);
    if (queuedKeys.length > 0) await AsyncStorage.multiRemove(queuedKeys);
  } catch {}
}