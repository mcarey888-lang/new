export interface BackupReceiptActivity {
  id: string;
  backupRevision?: string;
  backedUpRevision?: string;
  syncState?: "local_only" | "queued" | "synced";
}
/** Exact revision ACK only. A newer local edit is never declared synced by
 * an older receipt; private backup does not assert canonical credit. */
export function reconcileBackupReceipts<T extends BackupReceiptActivity>(
  hikes: T[], receipts: Record<string,string>,
): T[] {
  let changed = false;
  const next = hikes.map(hike => {
    if (!hike.backupRevision || receipts[hike.id] !== hike.backupRevision ||
      hike.backedUpRevision === hike.backupRevision) return hike;
    changed = true;
    return {...hike,backedUpRevision:hike.backupRevision,syncState:"synced" as const};
  });
  return changed ? next : hikes;
}
