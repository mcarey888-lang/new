import { describe, it, expect, vi } from "vitest";
import { advanceAccountDeletion, type DeletionState } from "../services/accountDeletionFlow";
function fixture() {
  const state: DeletionState = { media: ["synthetic/photo", "synthetic/cover"], completed: [], providers: { revenuecat: "pending_review", firebase: "pending_review" } };
  const persisted: DeletionState[] = [];
  const ops = {
    save: vi.fn(async (value: DeletionState) => { persisted.push(structuredClone(value)); }),
    removeMedia: vi.fn(async (_path: string) => {}),
    removeRecords: vi.fn(async () => {}), removeIdentity: vi.fn(async () => {}),
    removeRevenueCat: vi.fn(async () => {}),
  };
  return { state, ops, persisted };
}
describe("synthetic erasure orchestration (no live providers/accounts)", () => {
  it("checks every media result before removing source rows", async () => {
    const { state, ops } = fixture();
    ops.removeMedia.mockRejectedValueOnce(new Error("storage outage"));
    await expect(advanceAccountDeletion(state, ops)).rejects.toThrow("storage outage");
    expect(state.media).toHaveLength(2);
    expect(ops.removeRecords).not.toHaveBeenCalled();
    expect(ops.removeIdentity).not.toHaveBeenCalled();
  });
  it("keeps a cover failure retryable without swallowing it", async () => {
    const { state, ops, persisted } = fixture();
    ops.removeMedia.mockResolvedValueOnce().mockRejectedValueOnce(new Error("cover failure"));
    await expect(advanceAccountDeletion(state, ops)).rejects.toThrow();
    expect(persisted.at(-1)?.media).toEqual(["synthetic/cover"]);
    await advanceAccountDeletion(state, ops);
    expect(ops.removeRecords).toHaveBeenCalledTimes(1);
  });
  it("does not remove identity if transactional row cleanup fails", async () => {
    const { state, ops } = fixture();
    ops.removeRecords.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(advanceAccountDeletion(state, ops)).rejects.toThrow();
    expect(ops.removeIdentity).not.toHaveBeenCalled();
    expect(state.completed).not.toContain("records");
  });
  it("resumes after identity failure and does not repeat completed row cleanup", async () => {
    const { state, ops } = fixture();
    ops.removeIdentity.mockRejectedValueOnce(new Error("Clerk unavailable"));
    await expect(advanceAccountDeletion(state, ops)).rejects.toThrow();
    await advanceAccountDeletion(state, ops);
    expect(ops.removeRecords).toHaveBeenCalledTimes(1);
    expect(ops.removeIdentity).toHaveBeenCalledTimes(2);
  });
  it("returns a partial outcome for external erasure, not full success", async () => {
    const { state, ops } = fixture();
    ops.removeRevenueCat.mockRejectedValueOnce(new Error("provider refused"));
    const result = await advanceAccountDeletion(state, ops);
    expect(result).toEqual({ accountDeleted: true, deleted: false, pendingProviders: ["revenuecat", "firebase"], retainedProviders: [] });
    expect(state.providers.revenuecat).toBe("pending_review");
  });
  it("reports complete only when every provider is resolved", async () => {
    const { state, ops } = fixture();
    state.providers.firebase = "deleted";
    expect((await advanceAccountDeletion(state, ops)).deleted).toBe(true);
    await advanceAccountDeletion(state, ops);
    expect(ops.removeIdentity).toHaveBeenCalledTimes(1);
    expect(ops.removeRevenueCat).toHaveBeenCalledTimes(1);
  });
  it("reports lawful retention separately instead of implying all provider data was erased", async () => {
    const { state, ops } = fixture();
    state.providers.firebase = "retained_lawfully";
    const result = await advanceAccountDeletion(state, ops);
    expect(result.deleted).toBe(false);
    expect(result.pendingProviders).toEqual([]);
    expect(result.retainedProviders).toEqual(["firebase"]);
  });
});
