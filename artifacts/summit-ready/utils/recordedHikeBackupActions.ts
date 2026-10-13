import type { ExploreHike } from "../context/AppContext";
import { activityApiBase } from "./activityServiceOrigin";
import { reconcileBackupReceipts } from "./backupReceiptReconciliation";
import { privateRecordedHikeBackup } from "./recordedHikeRecovery";
import { enqueueSyncPending, readPrivateHikeReceipts, readOutbox, retrySyncOutbox } from "./syncOutbox";

export interface RecordingBackupStore {
  exclusive<T>(operation: () => Promise<T>): Promise<T>;
  assertOwner(): void;
  read(): ExploreHike[];
  write(hikes: ExploreHike[]): Promise<void>;
}
/** Both automatic and manual ACK handling use this exact durable metadata
 * operation. It never allocates a revision or enqueues evidence. */
export async function reconcileRecordingBackups(owner: string, store: RecordingBackupStore): Promise<void> {
  await store.exclusive(async () => {
    store.assertOwner();
    const receipts = await readPrivateHikeReceipts(owner);
    store.assertOwner();
    const current = store.read();
    const next = reconcileBackupReceipts(current, receipts);
    if (next !== current) await store.write(next);
  });
}
export async function backUpCurrentRecording(
  owner: string, id: string, store: RecordingBackupStore, getToken: () => Promise<string|null>,
): Promise<boolean> {
  await store.exclusive(async () => {
    store.assertOwner();
    const current = store.read();
    const hike = current.find(item => item.id === id);
    if (!hike) throw new Error("This recording is no longer available.");
    // Only an unversioned legacy recording needs a revision allocated here.
    const versioned = hike.backupRevision ? hike : {...hike,backupRevision:new Date().toISOString()};
    if (versioned !== hike) await store.write(current.map(item=>item.id===id?versioned:item));
    store.assertOwner();
    // Snapshot and enqueue while the same owner/library write lock is held,
    // never from a stale panel prop after an audience or evidence edit.
    await enqueueSyncPending(owner,{id:`private-hike:${id}`,kind:"private-hike",method:"PUT",
      url:`${activityApiBase}/recorded-hikes`,body:privateRecordedHikeBackup(versioned)});
  });
  await retrySyncOutbox(owner,getToken);
  // A cached receipt is not proof that this explicit retry succeeded, notably
  // when the server now rejects a recording deleted on another device.
  if ((await readOutbox(owner)).some(item=>item.id===`private-hike:${id}`)) return false;
  await reconcileRecordingBackups(owner,store);
  store.assertOwner();
  const current = store.read().find(item=>item.id===id);
  return Boolean(current?.backupRevision && current.backedUpRevision===current.backupRevision);
}
