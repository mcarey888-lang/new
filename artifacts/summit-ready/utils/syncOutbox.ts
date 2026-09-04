import AsyncStorage from "@react-native-async-storage/async-storage";
import { tokenBelongsToUser } from "./authRequest";

export const LEGACY_SYNC_OUTBOX_KEY = "summitready_sync_outbox_v1";
const mutations = new Map<string, Promise<unknown>>();

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
  return serializeOutboxMutation(userId, async () => {
  const stored = await readOutbox(userId);
  const current = stored.filter(item => item.ownerUserId === userId);
  if (current.length === 0) return;
  // Unknown/unowned records are deliberately retained but never sent.
  const remaining: SyncOutboxItem[] = stored.filter(item => item.ownerUserId !== userId);
  for (const item of current) {
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");
      // getToken is live: a Clerk account switch can occur while it is pending.
      // Never authorize an old user's queued payload with a new user's token.
      if (!tokenBelongsToUser(token, userId)) {
        throw new Error("Authentication identity changed");
      }
      const res = await fetch(item.url, {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(item.body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      remaining.push({
        ...item,
        state: "failed",
        attempts: item.attempts + 1,
        updatedAt: Date.now(),
      });
    }
  }
  await AsyncStorage.setItem(syncOutboxKey(userId), JSON.stringify(remaining));
  });
}