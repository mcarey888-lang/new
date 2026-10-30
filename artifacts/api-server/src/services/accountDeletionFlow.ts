export type DeletionState = {
  media: string[];
  completed: string[];
  providers: Record<string, "pending_review" | "deleted" | "retained_lawfully">;
  erasureIdentifiers?: Record<string, string>;
  providerEvidence?: Record<string, { caseRef: string; basis?: string; reviewAfter?: string }>;
};
export type DeletionOperations = {
  save(state: DeletionState): Promise<void>;
  removeMedia(path: string): Promise<void>;
  removeRecords(): Promise<void>;
  removeIdentity(): Promise<void>;
  removeRevenueCat(): Promise<void>;
};
/** Checkpoint after each idempotent operation. Never report complete erasure
 * merely because the sign-in account was removed. Failed paths stay retryable. */
export async function advanceAccountDeletion(state: DeletionState, ops: DeletionOperations) {
  for (const path of [...state.media]) {
    await ops.removeMedia(path);
    state.media = state.media.filter(value => value !== path);
    await ops.save(state);
  }
  if (!state.completed.includes("records")) {
    await ops.removeRecords();
    state.completed.push("records"); await ops.save(state);
  }
  if (!state.completed.includes("identity")) {
    await ops.removeIdentity();
    state.completed.push("identity"); await ops.save(state);
  }
  if (state.providers.revenuecat === "pending_review") {
    try { await ops.removeRevenueCat(); state.providers.revenuecat = "deleted"; }
    catch { state.providers.revenuecat = "pending_review"; }
    await ops.save(state);
  }
  return {
    accountDeleted: true,
    deleted: Object.values(state.providers).every(status => status === "deleted"),
    pendingProviders: Object.keys(state.providers).filter(key => state.providers[key] === "pending_review"),
  };
}
