import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const STORAGE_PREFIX = "summitready_clerk_v2_";
const STORAGE_TIMEOUT_MS = 2000;
const trackedKeys = new Set<string>();

// expo-secure-store is unavailable on web — fall back to in-memory storage so
// Clerk initialises cleanly in web previews without crashing.
const memStore = new Map<string, string>();

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function withStorageTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("SecureStore operation timed out")),
      STORAGE_TIMEOUT_MS,
    );
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

export const clerkTokenCache = {
  getToken: async (key: string): Promise<string | null> => {
    trackedKeys.add(key);
    if (Platform.OS === "web") return memStore.get(key) ?? null;
    try {
      return await withStorageTimeout(
        SecureStore.getItemAsync(storageKey(key), OPTS),
      );
    } catch {
      void SecureStore.deleteItemAsync(storageKey(key), OPTS).catch(() => {});
      return null;
    }
  },

  saveToken: async (key: string, token: string): Promise<void> => {
    trackedKeys.add(key);
    if (Platform.OS === "web") { memStore.set(key, token); return; }
    try {
      await withStorageTimeout(
        SecureStore.setItemAsync(storageKey(key), token, OPTS),
      );
    } catch {
      // Store failed (e.g. device has no passcode set); fall back to memory.
      memStore.set(key, token);
    }
  },

  clearToken: async (key: string): Promise<void> => {
    memStore.delete(key);
    trackedKeys.delete(key);
    if (Platform.OS === "web") return;
    try {
      await withStorageTimeout(
        SecureStore.deleteItemAsync(storageKey(key), OPTS),
      );
    } catch {}
  },

  clearAll: async (): Promise<void> => {
    const keys = [...trackedKeys];
    if (Platform.OS !== "web") {
      await Promise.allSettled(
        keys.map((k) =>
          withStorageTimeout(
            SecureStore.deleteItemAsync(storageKey(k), OPTS),
          ).catch(() => {}),
        ),
      );
    }
    memStore.clear();
    trackedKeys.clear();
  },
};
