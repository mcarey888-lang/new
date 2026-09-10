import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const trackedKeys = new Set<string>();

// expo-secure-store is unavailable on web — fall back to in-memory storage so
// Clerk initialises cleanly in web previews without crashing. On native the
// same map is used as a fallback whenever the keychain itself is unavailable
// (e.g. no device passcode set), so a save that could not reach SecureStore is
// still readable for the lifetime of the process.
const memStore = new Map<string, string>();

export const clerkTokenCache = {
  getToken: async (key: string): Promise<string | null> => {
    trackedKeys.add(key);
    if (Platform.OS === "web") return memStore.get(key) ?? null;
    try {
      const stored = await SecureStore.getItemAsync(key, OPTS);
      // A miss is not an error: fall through to whatever saveToken may have
      // parked in memory after a failed keychain write.
      return stored ?? memStore.get(key) ?? null;
    } catch {
      // A read failure is usually transient — the keychain is not yet
      // available (the device has not been unlocked since boot, and OPTS is
      // AFTER_FIRST_UNLOCK), or the item is briefly locked. Deleting the item
      // here would sign the user out permanently in response to a temporary
      // condition, so leave it in place and let Clerk retry on the next read.
      return memStore.get(key) ?? null;
    }
  },

  saveToken: async (key: string, token: string): Promise<void> => {
    trackedKeys.add(key);
    if (Platform.OS === "web") { memStore.set(key, token); return; }
    try {
      await SecureStore.setItemAsync(key, token, OPTS);
      // Keep the in-memory copy in step so a later read failure can still be
      // served from memory rather than appearing as a signed-out session.
      memStore.set(key, token);
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
