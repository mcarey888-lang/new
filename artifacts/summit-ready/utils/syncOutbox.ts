import AsyncStorage from "@react-native-async-storage/async-storage";
import { tokenBelongsToUser } from "./authRequest";

export const LEGACY_SYNC_OUTBOX_KEY = "summitready_sync_outbox_v1";
const mutations = new Map<string, Promise<unknown>>();
const retries = new Map<string, Promise<void>>();

export function syncOutboxKey(userId: string): string {
  return `${LEGACY_SYNC_OUTBOX_KEY}_${userId}`;
}

export type SyncOutboxKind = "hill-session" | "community-route" | "private-hike" | "private-hike-delete";
export interface SyncOutboxItem {
  ownerUserId: string;
  id: string;
  kind: SyncOutboxKind;
  url: string;
  method: "POST" | "PUT" | "DELETE";
  shareConsent?: boolean;
  lastError?: string;
  generation?: string;
  body: unknown;
  state: "pending" | "failed";
  attempts: number;
  updatedAt: number;
}

async function readOutbox(userId: string): Promise<SyncOutboxItem[]> {
  const raw = await AsyncStorage.getItem(syncOutboxKey(userId));
  return raw ? JSON.parse(raw) as SyncOutboxItem[] : [];
}

const receiptKey = (userId: string) => `summitready_private_hike_receipts_v1_${userId}`;
export async function privateHikeBackupStatus(userId: string, hikeId: string, revision: string) {
  const receipts = JSON.parse(await AsyncStorage.getItem(receiptKey(userId)) ?? "{}") as Record<string, string>;
  if (receipts[hikeId] === revision) return { state: "synced" as const };
  const item = (await readOutbox(userId)).find(entry =>
    entry.kind === "private-hike" && (entry.body as { hikeId?: string; revision?: string }).hikeId === hikeId &&
    (entry.body as { revision?: string }).revision === revision);
  return { state: item?.state ?? "not_queued", error: item?.lastError };
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
      generation: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
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

    const outcomes = new Map<string, { updatedAt: number; generation?: string; succeeded: boolean; error?: string; deletedHikeId?: string; receipt?: { hikeId: string; revision: string } }>();
    for (const item of current) {
      // Legacy auto-publication is not permission to share a private GPS trace.
      if (item.kind === "community-route" && !item.shareConsent) continue;
      let succeeded = false;
      let error: string | undefined;
      let receipt: { hikeId: string; revision: string } | undefined;
      let deletedHikeId: string | undefined;
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
            redirect: "error",
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(res.status === 401
              ? "Your sign-in could not be verified. Sign in again, then retry."
              : body.error ?? `Backup failed (HTTP ${res.status})`);
          }
          const acknowledgement = res.status === 204 ? null : await res.json();
          if (item.kind === "private-hike-delete") {
            if (res.status !== 204) throw new Error("Private backup deletion was not acknowledged");
            deletedHikeId = (item.body as { hikeId: string }).hikeId;
          } else
          if (item.kind === "private-hike") {
            const body = item.body as { hikeId: string; revision: string };
            if (acknowledgement?.ok !== true || acknowledgement.hikeId !== body.hikeId ||
                acknowledgement.revision !== body.revision) throw new Error("Private backup was not acknowledged");
            receipt = { hikeId: body.hikeId, revision: body.revision };
          } else if (acknowledgement?.ok !== true && !acknowledgement?.id &&
                     !acknowledgement?.activityId && !acknowledgement?.session) {
            throw new Error("The server did not acknowledge the recording");
          }
          succeeded = true;
        } finally {
          clearTimeout(timeout);
        }
      } catch (caught) {
        succeeded = false;
        error = caught instanceof Error ? caught.message : "Backup failed. Your phone copy is unchanged.";
      }
      outcomes.set(item.id, { updatedAt: item.updatedAt, generation: item.generation, succeeded, error, receipt, deletedHikeId });
    }

    // Reconcile under the lock. Never remove an item that was replaced with a
    // newer payload while its previous version was in flight.
    await serializeOutboxMutation(userId, async () => {
      const latest = await readOutbox(userId);
      const receipts = JSON.parse(await AsyncStorage.getItem(receiptKey(userId)) ?? "{}") as Record<string, string>;
      for (const item of latest) {
        const outcome = outcomes.get(item.id);
        if (outcome?.succeeded && outcome.updatedAt === item.updatedAt && outcome.generation === item.generation && outcome.receipt) {
          receipts[outcome.receipt.hikeId] = outcome.receipt.revision;
        }
        if (outcome?.succeeded && outcome.updatedAt === item.updatedAt && outcome.generation === item.generation && outcome.deletedHikeId) {
          delete receipts[outcome.deletedHikeId];
        }
      }
      await AsyncStorage.setItem(receiptKey(userId), JSON.stringify(receipts));
      const next = latest.flatMap(item => {
        if (item.ownerUserId !== userId) return [item];
        const outcome = outcomes.get(item.id);
        if (!outcome || outcome.updatedAt !== item.updatedAt || outcome.generation !== item.generation) return [item];
        if (outcome.succeeded) return [];
        return [{
          ...item,
          state: "failed" as const,
          attempts: item.attempts + 1,
          updatedAt: Date.now(),
          lastError: outcome.error,
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