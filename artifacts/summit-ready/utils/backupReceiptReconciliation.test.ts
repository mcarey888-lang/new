import { describe,it,expect } from "vitest";
import { reconcileBackupReceipts } from "./backupReceiptReconciliation";
describe("durable exact-version private backup reconciliation",()=>{
  it("persists acknowledgement without advancing or re-uploading the evidence revision",()=>{
    const hikes=[{id:"a",backupRevision:"new",syncState:"queued" as const}];
    expect(reconcileBackupReceipts(hikes,{a:"new"})).toEqual([
      {id:"a",backupRevision:"new",backedUpRevision:"new",syncState:"synced"}]);
  });
  it("does not declare an edited hike synced from an older receipt",()=>{
    const hikes=[{id:"a",backupRevision:"new",syncState:"queued" as const}];
    expect(reconcileBackupReceipts(hikes,{a:"old"})).toBe(hikes);
  });
  it("does not rewrite already acknowledged rows or unversioned legacy hikes",()=>{
    const hikes=[{id:"a",backupRevision:"new",backedUpRevision:"new"},{id:"legacy"}];
    expect(reconcileBackupReceipts(hikes,{a:"new",legacy:"old"})).toBe(hikes);
  });
});
