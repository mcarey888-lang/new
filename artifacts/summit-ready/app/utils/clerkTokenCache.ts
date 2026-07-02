import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const trackedKeys = new Set<string>();

// expo-secure-store is unavailable on web — fall back to in-memory storage so
// Clerk initialises cleanly in web previews without crashing.
const memStore = new Map<string, string>();

export const clerkTokenCache = {
  getToken: async (key: string): Promise<string | null> => {
    trackedKeys.add(key);
    if (Platform.OS === "web") return memStore.get(key) ?? null;
    try {
      return await SecureStore.getItemAsync(key, OPTS);
    } catch {
      try { await SecureStore.deleteItemAsync(key, OPTS); } catch {}
      return null;
    }
  },

  saveToken: async (key: string, token: string): Promise<void> => {
    trackedKeys.add(key);
    if (Platform.OS === "web") { memStore.set(key, token); return; }
    try {
      await SecureStore.setItemAsync(key, token, OPTS);
    } catch {
      // Store failed (e.g. device has no passcode set); fall back to memory.
      memStore.set(key, token);
    }
  },

  clearAll: async (): Promise<void> => {
    const keys = [...trackedKeys];
    if (Platform.OS !== "web") {
      await Promise.allSettled(
        keys.map((k) =>
          SecureStore.deleteItemAsync(k, OPTS).catch(() => {}),
        ),
      );
    }
    memStore.clear();
    trackedKeys.clear();
  },
};
