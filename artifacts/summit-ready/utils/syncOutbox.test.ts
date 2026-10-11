import { beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
} }));
import { enqueueSyncPending, privateHikeBackupStatus, retrySyncOutbox } from "./syncOutbox";
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
