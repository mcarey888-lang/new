const writes = new Map<string, Promise<unknown>>();

/** Read the latest library only after earlier mutations have durably finished. */
export async function serializeRecordedHikeWrite<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = writes.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(work);
  writes.set(key, next);
  try { return await next; } finally { if (writes.get(key) === next) writes.delete(key); }
}
