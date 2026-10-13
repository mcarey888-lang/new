import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import { PgDialect } from "drizzle-orm/pg-core";
const state = vi.hoisted(() => ({
  writes: [] as string[], rows: [{owner:"test-review-owner"}] as unknown[],
}));
vi.mock("@workspace/db", () => ({
  db: { execute: async (query: any) => {
    const text = new PgDialect().sqlToQuery(query).sql;
    state.writes.push(text);
    return { rows: state.rows };
  } },
}));
import router from "../routes/activity-review";
async function call(method: string, key?: string, body?: unknown) {
  const app = express();
  app.use(express.json(), (req, _res, next) => {
    (req as any).log = { error: vi.fn() }; next();
  }, router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const address = server.address() as {port:number};
    return await fetch(`http://127.0.0.1:${address.port}/activity-review${method==="PATCH"?"/owner/hike":""}`,{
      method,headers:{"Content-Type":"application/json",...(key?{"x-vx-admin-key":key}:{})},
      body:body?JSON.stringify(body):undefined,
    });
  } finally { await new Promise<void>(resolve => server.close(()=>resolve())); }
}
describe("app-owned trail review, never canonical promotion", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_API_KEY","test-review-key");
    state.writes=[]; state.rows=[{owner:"test-review-owner"}];
  });
  it("requires privileged authorization before reading or deciding", async () => {
    expect((await call("GET")).status).toBe(401);
    expect((await call("PATCH","wrong")).status).toBe(401);
    expect(state.writes).toEqual([]);
  });
  it("requires revision and explicit bounded review notes", async () => {
    expect((await call("PATCH","test-review-key",{status:"approved",evidenceRevision:"2026-10-13T12:00:00.000Z",reviewNotes:""})).status).toBe(400);
    expect(state.writes).toEqual([]);
  });
  it("guards the exact evidence version, deletion and allowed transitions", async () => {
    expect((await call("PATCH","test-review-key",{status:"approved",evidenceRevision:"2026-10-13T12:00:00.000Z",reviewNotes:"Review completed"})).status).toBe(200);
    const query=state.writes[0];
    expect(query).toContain("b.revision=s.evidence_revision");
    expect(query).toContain("b.deleted_at IS NULL");
    expect(query).toContain("s.status='in_review'");
    expect(query).not.toMatch(/\b(mountains|route_identities|route_definitions|route_facts|canonical_activities)\b/);
  });
  it("refuses stale evidence rather than optimistic approval", async () => {
    state.rows=[];
    expect((await call("PATCH","test-review-key",{status:"approved",evidenceRevision:"2026-10-13T12:00:00.000Z",reviewNotes:"Review completed"})).status).toBe(409);
  });
});
