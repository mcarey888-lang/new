import AsyncStorage from "@react-native-async-storage/async-storage";
import { tokenBelongsToUser } from "./authRequest";

export const LEGACY_SYNC_OUTBOX_KEY = "summitready_sync_outbox_v1";
const mutations = new Map<string, Promise<unknown>>();
const retries = new Map<string, Promise<void>>();

export function syncOutboxKey(userId: string): string {
  return `${LEGACY_SYNC_OUTBOX_KEY}_${userId}`;
}

export type SyncOutboxKind = "hill-session" | "community-route";
export interface SyncOutboxItem {
  ownerUserId: string;
  id: string;
  kind: SyncOutboxKind;
  url: string;
  method: "POST";
  body: unknown;
  state: "pending" | "failed";
  attempts: number;
  updatedAt: number;
}

async function readOutbox(userId: string): Promise<SyncOutboxItem[]> {
  const raw = await AsyncStorage.getItem(syncOutboxKey(userId));
  return raw ? JSON.parse(raw) as SyncOutboxItem[] : [];
}

export function serializeOutboxMutation<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  const previous = mutations.get(userId) ?? Promise.resolve();
  const next = previous.then(operation, operation);
  mutations.set(userId, next.catch(() => undefined));
  return next.finally(() => {
    if (mutations.get(userId) === next) mutations.delete(userId);
  });
}

export async function enqueueSyncFailure(
  userId: string,
  item: Omit<SyncOutboxItem, "ownerUserId" | "state" | "attempts" | "updatedAt">,
): Promise<void> {
  return serializeOutboxMutation(userId, async () => {
  const current = await readOutbox(userId);
  const existing = current.find(entry => entry.ownerUserId === userId && entry.id === item.id);
  const next: SyncOutboxItem = {
    ...item,
    ownerUserId: userId,
    state: "failed",
    attempts: (existing?.attempts ?? 0) + 1,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(
    syncOutboxKey(userId),
    JSON.stringify([next, ...current.filter(entry => entry.ownerUserId !== userId || entry.id !== item.id)]),
  );
  });
}

export async function enqueueSyncPending(
  userId: string,
  item: Omit<SyncOutboxItem, "ownerUserId" | "state" | "attempts" | "updatedAt">,
): Promise<void> {
  return serializeOutboxMutation(userId, async () => {
  const current = await readOutbox(userId);
  const existing = current.find(entry => entry.ownerUserId === userId && entry.id === item.id);
  const next: SyncOutboxItem = {
    ...item,
    ownerUserId: userId,
    state: "pending",
    attempts: existing?.attempts ?? 0,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(
    syncOutboxKey(userId),
    JSON.stringify([next, ...current.filter(entry => entry.ownerUserId !== userId || entry.id !== item.id)]),
  );
  });
}

export async function markSyncComplete(userId: string, id: string): Promise<void> {
  return serializeOutboxMutation(userId, async () => {
  const current = await readOutbox(userId);
  await AsyncStorage.setItem(
    syncOutboxKey(userId),
    JSON.stringify(current.filter(entry => entry.ownerUserId !== userId || entry.id !== id)),
  );
  });
}

export async function retrySyncOutbox(
  userId: string,
  getToken: () => Promise<string | null>,
): Promise<void> {
  const existingRetry = retries.get(userId);
  if (existingRetry) return existingRetry;

  const retry = (async () => {
    // Snapshot under the storage lock, then release it before any network work.
    const current = await serializeOutboxMutation(userId, async () => {
      const stored = await readOutbox(userId);
      return stored.filter(item => item.ownerUserId === userId);
    });
    if (current.length === 0) return;

    const outcomes = new Map<string, { updatedAt: number; succeeded: boolean }>();
    for (const item of current) {
      let succeeded = false;
      try {
        const token = await getToken();
        if (!token) throw new Error("Authentication required");
        if (!tokenBelongsToUser(token, userId)) {
          throw new Error("Authentication identity changed");
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8_000);
        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(item.body),
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          succeeded = true;
        } finally {
          clearTimeout(timeout);
        }
      } catch {
        succeeded = false;
      }
      outcomes.set(item.id, { updatedAt: item.updatedAt, succeeded });
    }

    // Reconcile under the lock. Never remove an item that was replaced with a
    // newer payload while its previous version was in flight.
    await serializeOutboxMutation(userId, async () => {
      const latest = await readOutbox(userId);
      const next = latest.flatMap(item => {
        if (item.ownerUserId !== userId) return [item];
        const outcome = outcomes.get(item.id);
        if (!outcome || outcome.updatedAt !== item.updatedAt) return [item];
        if (outcome.succeeded) return [];
        return [{
          ...item,
          state: "failed" as const,
          attempts: item.attempts + 1,
          updatedAt: Date.now(),
        }];
      });
      await AsyncStorage.setItem(syncOutboxKey(userId), JSON.stringify(next));
    });
  })();

  retries.set(userId, retry);
  return retry.finally(() => {
    if (retries.get(userId) === retry) retries.delete(userId);
  });
}