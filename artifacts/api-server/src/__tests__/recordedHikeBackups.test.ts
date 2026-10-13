import { beforeEach,afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { PgDialect } from "drizzle-orm/pg-core";
const store = vi.hoisted(() => new Map<string, any>());
vi.mock("@clerk/express", () => ({
  getAuth: (req: any) => ({ userId: req.headers["x-test-user"] ?? null }),
  requireAuth: () => (_req: any, res: any) => res.redirect("/"),
}));
vi.mock("@workspace/db", async () => {
  const schema=await vi.importActual<typeof import("@workspace/db/schema")>("@workspace/db/schema");
  const db: any = {
    transaction: async (fn:any)=>fn(db),
    execute: async()=>[],
    insert: () => ({ values: (value: any) => ({ onConflictDoUpdate: () => {
      const save = () => {
        const key = `${value.ownerUserId}:${value.hikeId}`;
        const existing = store.get(key);
        if (!value.deletedAt && existing && (existing.deletedAt || existing.revision > value.revision)) return [];
        store.set(key, { ...value, updatedAt: new Date() });
        return [{ revision: value.revision }];
      };
      return { returning: async () => save(), then: (resolve: any) => resolve(save()) };
    } }) }),
    select: () => ({ from: (table:any) => ({ where: (clause: any) => {
      const { params } = new PgDialect().sqlToQuery(clause);
      const rows=table===schema.activityPublications?[]:[...store.values()].filter(row => row.ownerUserId === params[0]);
      return Object.assign(rows,{limit:async()=>rows,orderBy:()=>({limit:async()=>rows})});
    } }) }),
    delete: (table: any) => ({ where: async (clause: any) => {
      if (table !== schema.recordedHikeBackups) return;
      const { params } = new PgDialect().sqlToQuery(clause);
      store.delete(`${params[0]}:${params[1]}`);
    } }),
  };
  return {...schema,db};
});
import router from "../routes/recorded-hikes";

const recording = {
  hikeId: "one", revision: "2026-10-11T20:00:00.000Z",
  snapshot: { id: "one", name: "Test hike", date: "2026-10-11T18:00:00.000Z",
    distance: 2.2, elevationGain: 1670, timeTaken: 66, notes: "Original",
    trackPoints: [{ lat: 53, lon: -2, alt: 200, ts: 1000, altAcc: null }] },
};
async function request(method: string, path: string, owner?: string, body?: unknown, selectedRouter = router) {
  const app = express();
  app.use(express.json({limit:"48mb"})); app.use(selectedRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const address = server.address() as { port: number };
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method, redirect: "manual",
      headers: { "Content-Type": "application/json", ...(owner ? { "x-test-user": owner } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}

describe("private recorded hike backups", () => {
  beforeEach(() => { store.clear(); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("CLERK_SECRET_KEY", "test-present-key"); });
  afterEach(()=>vi.unstubAllEnvs());
  it("returns JSON 401, not a sign-in redirect, and never writes anonymously", async () => {
    const response = await request("PUT", "/recorded-hikes", undefined, recording);
    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(store.size).toBe(0);
  });
  it("preserves the raw trace and gives an exact private backup acknowledgement", async () => {
    const response = await request("PUT", "/recorded-hikes", "user-a", recording);
    expect(await response.json()).toEqual({ ok: true, hikeId: "one", revision: recording.revision });
    expect(store.get("user-a:one").snapshot.trackPoints).toEqual(recording.snapshot.trackPoints);
  });
  it("isolates list, save and deletion even when two users use the same hike ID", async () => {
    await request("PUT", "/recorded-hikes", "user-a", recording);
    await request("PUT", "/recorded-hikes", "user-b", { ...recording, snapshot: { ...recording.snapshot, name: "Other" } });
    const list = await (await request("GET", "/recorded-hikes", "user-b")).json() as {backups: Array<{snapshot:{name:string}}>};
    expect(list.backups).toHaveLength(1);
    expect(list.backups[0].snapshot.name).toBe("Other");
    await request("DELETE", "/recorded-hikes/one", "user-b");
    expect(store.has("user-a:one")).toBe(true);
    expect(store.get("user-b:one").deletedAt).toBeInstanceOf(Date);
    expect(store.get("user-b:one").snapshot).toEqual({});
  });
  it("refuses stale revisions rather than overwriting a reviewed recording", async () => {
    await request("PUT", "/recorded-hikes", "user-a", recording);
    const response = await request("PUT", "/recorded-hikes", "user-a", { ...recording, revision: "2026-10-11T19:00:00.000Z" });
    expect(response.status).toBe(409);
    expect(store.get("user-a:one").revision).toBe(recording.revision);
  });
  it("retains a deletion tombstone and refuses stale AND newer offline resurrection", async () => {
    await request("PUT", "/recorded-hikes", "user-a", recording);
    expect((await request("DELETE", "/recorded-hikes/one", "user-a")).status).toBe(204);
    for (const revision of [recording.revision, "2027-10-11T20:00:00.000Z"]) {
      expect((await request("PUT", "/recorded-hikes", "user-a", { ...recording, revision })).status).toBe(409);
    }
    const data = await (await request("GET", "/recorded-hikes", "user-a")).json() as { backups: any[] };
    expect(data.backups[0].deletedAt).toBeTruthy();
    expect(data.backups[0].snapshot).toBeNull();
  });
  it("rejects identity mismatches and invalid coordinates", async () => {
    expect((await request("PUT", "/recorded-hikes", "user-a", { ...recording, hikeId: "other" })).status).toBe(400);
    expect((await request("PUT", "/recorded-hikes", "user-a", { ...recording, snapshot: { ...recording.snapshot, trackPoints: [{ lat: 99, lon: 0 }] } })).status).toBe(400);
    expect(store.size).toBe(0);
  });
  it("accepts a full-day recording with independent raw evidence without truncation or a 12MB rejection", async () => {
    const points=Array.from({length:43201},(_,i)=>({
      lat:53.12345678901234,lon:-2.123456789012345,alt:300.1234567890123,
      ts:1791864000000+i*2000,acc:10.12345678901234,altAcc:5.123456789012345,
    }));
    const rawGPSFixes=points.map(point=>({...point,source:"background",acceptedForTrace:true}));
    const payload={...recording,snapshot:{...recording.snapshot,trackPoints:points,rawGPSFixes}};
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeGreaterThan(12*1024*1024);
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThan(48*1024*1024);
    expect((await request("PUT","/recorded-hikes","user-a",payload)).status).toBe(200);
    expect(store.get("user-a:one").snapshot.trackPoints).toHaveLength(43201);
    expect(store.get("user-a:one").snapshot.rawGPSFixes).toHaveLength(43201);
    expect(store.get("user-a:one").snapshot.elevationGain).toBe(1670);
  });
  it("fails closed when production authentication is not configured", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "");
    vi.resetModules();
    const freshRouter = (await import("../routes/recorded-hikes")).default;
    expect((await request("PUT", "/recorded-hikes", "user-a", recording, freshRouter)).status).toBe(503);
    expect(store.size).toBe(0);
  });
});
