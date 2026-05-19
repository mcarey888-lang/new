import AsyncStorage from "@react-native-async-storage/async-storage";

export interface StartPointOverride {
  name: string;
  postcode: string;
  directions: string;
  parkingNotes: string;
}

function key(hillName: string) {
  return `start_override:${hillName.trim().toLowerCase()}`;
}

export async function loadOverride(hillName: string): Promise<StartPointOverride | null> {
  try {
    const raw = await AsyncStorage.getItem(key(hillName));
    if (!raw) return null;
    return JSON.parse(raw) as StartPointOverride;
  } catch {
    return null;
  }
}

export async function saveOverride(hillName: string, override: StartPointOverride): Promise<void> {
  try {
    await AsyncStorage.setItem(key(hillName), JSON.stringify(override));
  } catch { /* ignore */ }
}

export async function clearOverride(hillName: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(hillName));
  } catch { /* ignore */ }
}
