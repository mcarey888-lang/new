import { beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
} }));
import { enqueueSyncPending, privateHikeBackupStatus, retrySyncOutbox, readOutbox } from "./syncOutbox";
const token = (owner: string) => `header.${btoa(JSON.stringify({ sub: owner }))}.signature`;
const body = { hikeId: "recorded-hike", revision: "2026-10-11T20:00:00.000Z", snapshot: { id: "recorded-hike" } };
const item = { id: "private-hike:recorded-hike", kind: "private-hike" as const, method: "PUT" as const, url: "/api/recorded-hikes", body };

describe("private recorded hike upload acknowledgements", () => {
  beforeEach(() => { storage.clear(); vi.unstubAllGlobals(); });
  it("records a receipt only for the exact acknowledged hike and revision", async () => {
    const fetcher = vi.fn(async (_url: string, _options: RequestInit) => new Response(JSON.stringify({ ok: true, hikeId: body.hikeId, revision: body.revision }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    await enqueueSyncPending("user-a", item);
    await retrySyncOutbox("user-a", async () => token("user-a"));
    expect((await privateHikeBackupStatus("user-a", body.hikeId, body.revision)).state).toBe("synced");
    expect(fetcher.mock.calls[0][1]).toEqual(expect.objectContaining({ redirect: "error" }));
    expect((await privateHikeBackupStatus("user-b", body.hikeId, body.revision)).state).toBe("not_queued");
  });
  it("never treats a redirected HTML homepage as a saved hike", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Homepage</html>", { status: 200 })));
    await enqueueSyncPending("user-a", item);
    await retrySyncOutbox("user-a", async () => token("user-a"));
    expect((await privateHikeBackupStatus("user-a", body.hikeId, body.revision)).state).toBe("failed");
  });
  it("retains the upload and reports an actionable sign-in failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":"Authentication required"}', { status: 401 })));
    await enqueueSyncPending("user-a", item);
    await retrySyncOutbox("user-a", async () => token("user-a"));
    const status = await privateHikeBackupStatus("user-a", body.hikeId, body.revision);
    expect(status.state).toBe("failed");
    expect(status.error).toContain("Sign in again");
  });
  it("rejects missing or wrong revision acknowledgements", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, hikeId: body.hikeId, revision: "older" }))));
    await enqueueSyncPending("user-a", item);
    await retrySyncOutbox("user-a", async () => token("user-a"));
    expect((await privateHikeBackupStatus("user-a", body.hikeId, body.revision)).state).toBe("failed");
  });
  it("does not send another account's token or auto-publish legacy community uploads", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await enqueueSyncPending("user-a", item);
    await enqueueSyncPending("user-a", { ...item, id: "public-route", kind: "community-route", method: "POST" });
    await retrySyncOutbox("user-a", async () => token("user-b"));
    expect(fetcher).not.toHaveBeenCalled();
    expect((await privateHikeBackupStatus("user-a", body.hikeId, body.revision)).state).toBe("failed");
  });
  it("clears the receipt only after private backup deletion is acknowledged", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, hikeId: body.hikeId, revision: body.revision }))));
    await enqueueSyncPending("user-a", item);
    await retrySyncOutbox("user-a", async () => token("user-a"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await enqueueSyncPending("user-a", { ...item, kind: "private-hike-delete", method: "DELETE" });
    await retrySyncOutbox("user-a", async () => token("user-a"));
    expect((await privateHikeBackupStatus("user-a", body.hikeId, body.revision)).state).toBe("not_queued");
  });
});

describe("canonical one-shot acknowledgement contract",()=>{
  beforeEach(()=>{storage.clear();vi.unstubAllGlobals();});
  const canonical={id:"canonical-activity:recorded-hike",kind:"canonical-activity" as const,method:"POST" as const,
    url:"/api/explore-hike/canonicalize",body:{exploreHikeId:"recorded-hike"}};
  it.each(["created","deduplicated","reused","ingested"])("accepts one-shot %s without re-reading the body",async status=>{
    const response=new Response(JSON.stringify({status,canonicalActivityId:"canonical-1"}));
    vi.stubGlobal("fetch",vi.fn(async()=>response));
    await enqueueSyncPending("user-a",canonical);
    await retrySyncOutbox("user-a",async()=>token("user-a"));
    expect(response.bodyUsed).toBe(true);
    expect(await readOutbox("user-a")).toEqual([]);
  });
  it("keeps disabled canonical processing distinct from a successful private backup",async()=>{
    vi.stubGlobal("fetch",vi.fn(async(url:string)=>new Response(JSON.stringify(url.endsWith("/canonicalize")?
      {status:"disabled"}:{ok:true,hikeId:body.hikeId,revision:body.revision}))));
    await enqueueSyncPending("user-a",item);
    await enqueueSyncPending("user-a",canonical);
    await retrySyncOutbox("user-a",async()=>token("user-a"));
    expect((await privateHikeBackupStatus("user-a",body.hikeId,body.revision)).state).toBe("synced");
    expect(await readOutbox("user-a")).toEqual([expect.objectContaining({kind:"canonical-activity",state:"failed",lastError:expect.stringContaining("disabled")})]);
  });
  it.each([
    {status:"conflict",canonicalActivityId:"canonical-1"},
    {status:"created",canonicalActivityId:""},
    {status:"created",canonicalActivityId:"canonical-1",exploreHikeId:"other"},
    {status:"created",canonicalActivityId:"canonical-1",ownerUserId:"user-b"},
  ])("refuses wrong or incomplete canonical identities %#",async ack=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify(ack))));
    await enqueueSyncPending("user-a",canonical);
    await retrySyncOutbox("user-a",async()=>token("user-a"));
    expect((await readOutbox("user-a"))[0].state).toBe("failed");
  });
  it("rejects a reused canonical ID different from the requested known identity",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response('{"status":"reused","canonicalActivityId":"wrong"}')));
    await enqueueSyncPending("user-a",{...canonical,body:{exploreHikeId:"recorded-hike",existingCanonicalActivityId:"expected"}});
    await retrySyncOutbox("user-a",async()=>token("user-a"));
    expect((await readOutbox("user-a"))[0].state).toBe("failed");
  });
});
