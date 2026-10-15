import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), release: vi.fn(), connect: vi.fn(),
}));
vi.mock("@workspace/db", () => ({ pool: { connect: mocks.connect } }));
import { promotionGroups, promotionPlan, runArtworkPromotion } from "../services/artwork/artworkPromotion.js";
import { artworkPromotionRouter } from "../routes/artwork-promotion.js";

let rows: { slug: string; data: string; cached_at: string }[];
beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
  mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
  mocks.query.mockImplementation(async (sql: string, args?: unknown[]) => {
    if (sql.includes("current_database")) return { rows: [{ name: "test_database" }] };
    if (sql.startsWith("SELECT id")) return { rows: promotionGroups.map(group => ({ id: group.id })) };
    if (sql.startsWith("SELECT slug")) return { rows: [...rows] };
    if (sql.startsWith("INSERT INTO")) rows.push({
      slug: args![0] as string, data: args![1] as string, cached_at: args![2] as string,
    });
    return { rows: [] };
  });
});

describe("approved artwork metadata promotion", () => {
  it("packages exactly the existing 33 groups / 99 records, with approved review state", () => {
    expect(promotionGroups).toHaveLength(33);
    expect(new Set(promotionGroups.flatMap(group => group.records.map(row => row.slug))).size).toBe(99);
    for (const group of promotionGroups) {
      const review = group.records.find(row => row.slug.startsWith("hero-review:"))!;
      expect(JSON.parse(review.data).status).toBe("approved");
      expect(group.records).toHaveLength(3);
    }
  });
  it("previews without mutations", async () => {
    const result = await runArtworkPromotion();
    expect(result.recordsToInsert).toBe(99);
    expect(result.applied).toBe(false);
    expect(mocks.query.mock.calls.some(([sql]) => /INSERT|UPDATE|DELETE|LOCK TABLE/.test(sql))).toBe(false);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it("inserts original metadata and timestamps, then preserves everything on a repeat run", async () => {
    const plan = await runArtworkPromotion();
    const applied = await runArtworkPromotion({ planId: plan.planId });
    expect(applied.insertedRecords).toBe(99);
    for (const record of promotionGroups.flatMap(group => group.records)) {
      expect(rows.find(row => row.slug === record.slug)).toEqual({
        slug: record.slug, data: record.data, cached_at: record.cachedAt,
      });
    }
    const repeat = await runArtworkPromotion();
    expect(repeat.mountainsPreserved).toBe(33);
    expect((await runArtworkPromotion({ planId: repeat.planId })).insertedRecords).toBe(0);
    expect(rows).toHaveLength(99);
  });
  it("preserves a whole mountain when even a partial/rejected target decision exists", () => {
    const first = promotionGroups[0];
    const result = promotionPlan([{
      slug: `hero-review:v1:${first.id}`, data: '{"status":"rejected"}', cached_at: "2026-10-15",
    }], "test_database");
    expect(result.items[0].action).toBe("preserve");
    expect(result.recordsToInsert).toBe(96);
  });
  it("also preserves alternate name approvals for the same mountain ID", () => {
    const result = promotionPlan([{
      slug: "hero-approved:v1:another-name", data: JSON.stringify({ mountainId: promotionGroups[0].id }), cached_at: "2026-10-15",
    }], "test_database");
    expect(result.items[0].action).toBe("preserve");
  });
  it("rejects stale previews before inserting and rolls back", async () => {
    const preview = await runArtworkPromotion();
    rows.push({ slug: promotionGroups[0].records[0].slug, data: "{}", cached_at: "2026-10-15" });
    await expect(runArtworkPromotion({ planId: preview.planId })).rejects.toThrow("Preview again");
    expect(mocks.query).toHaveBeenCalledWith("ROLLBACK");
    expect(rows).toHaveLength(1);
  });
  it("refuses a target missing original mountain IDs", async () => {
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes("current_database") ? [{ name: "test_database" }] : [],
    }));
    await expect(runArtworkPromotion()).rejects.toThrow("all 33 original mountain IDs");
    expect(mocks.query).toHaveBeenCalledWith("ROLLBACK");
  });
  it("rolls back on database write failure and releases the client", async () => {
    const preview = await runArtworkPromotion();
    const original = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async (sql, args) => {
      if (sql.startsWith("INSERT")) throw new Error("simulated database failure");
      return original(sql, args);
    });
    await expect(runArtworkPromotion({ planId: preview.planId })).rejects.toThrow("simulated");
    expect(mocks.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.release).toHaveBeenCalledTimes(2);
  });
});

async function withApi(run: (url: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.log = { error: vi.fn(), info: vi.fn() } as never; next(); });
  app.use("/import", artworkPromotionRouter);
  const server: Server = await new Promise(resolve => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    await run(`http://127.0.0.1:${(server.address() as { port: number }).port}/import`);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

it("requires admin authentication and explicit approval before any mutation", async () => {
  vi.stubEnv("ADMIN_API_KEY", "test-only-artwork-key");
  try {
    await withApi(async url => {
      expect((await fetch(url)).status).toBe(401);
      expect(mocks.connect).not.toHaveBeenCalled();
      const headers = { "x-vx-admin-key": "test-only-artwork-key", "Content-Type": "application/json" };
      expect((await fetch(url, { method: "POST", headers, body: "{}" })).status).toBe(400);
      expect(mocks.connect).not.toHaveBeenCalled();
      const response = await fetch(url, { headers });
      expect(response.headers.get("cache-control")).toBe("no-store");
      const plan = await response.json() as { planId: string; recordsToInsert: number };
      expect(plan.recordsToInsert).toBe(99);
      const applied = await fetch(url, { method: "POST", headers, body: JSON.stringify({
        planId: plan.planId, backupConfirmed: true, confirmation: "IMPORT APPROVED ARTWORK",
      }) });
      expect(applied.status).toBe(200);
      expect((await applied.json() as { insertedRecords: number }).insertedRecords).toBe(99);
    });
  } finally {
    vi.unstubAllEnvs();
  }
});
