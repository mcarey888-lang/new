import * as SecureStore from "expo-secure-store";

const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const trackedKeys = new Set<string>();

export const clerkTokenCache = {
  getToken: async (key: string): Promise<string | null> => {
    trackedKeys.add(key);
    try {
      return await SecureStore.getItemAsync(key, OPTS);
    } catch {
      await SecureStore.deleteItemAsync(key, OPTS);
      return null;
    }
  },
  saveToken: (key: string, token: string): Promise<void> => {
    trackedKeys.add(key);
    return SecureStore.setItemAsync(key, token, OPTS);
  },
  clearAll: async (): Promise<void> => {
    const keys = [...trackedKeys];
    await Promise.allSettled(keys.map((k) => SecureStore.deleteItemAsync(k, OPTS)));
    trackedKeys.clear();
  },
};
