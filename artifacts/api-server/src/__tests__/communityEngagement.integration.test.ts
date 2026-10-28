import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
vi.mock("@clerk/express", () => ({ getAuth: (req: any) => ({ userId: req.get("x-test-user") ?? null }) }));
vi.mock("../services/communityAuthors", () => ({ getAuthor: async () => ({ name: "Test member", avatarUrl: null }) }));

// Explicitly opt in: this suite writes only uniquely named fixtures to the
// development database. It never connects to the engine or production.
describe.skipIf(process.env.RUN_COMMUNITY_DB_TESTS !== "1")("persistent community reactions", () => {
  let schema: typeof import("@workspace/db");
  let server: Server;
  let base: string;
  let ids: string[];
  let owner: string, other: string, third: string;
  const request = async (method: string, path: string, user?: string, text?: string, key?: string) => {
    const response = await fetch(base + path, {
      method, headers: { ...(user ? { "x-test-user": user } : {}),
        ...(text !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(key ? { "X-Idempotency-Key": key } : {}) },
      ...(text !== undefined ? { body: JSON.stringify({ text }) } : {}),
    });
    return { status: response.status, body: await response.json() as any };
  };
  beforeAll(async () => {
    schema = await import("@workspace/db");
    const { default: router } = await import("../routes/community-engagement");
    const app = express();
    app.use(express.json(), router);
    server = app.listen(0);
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  beforeEach(async () => {
    const prefix = `engagement-qa-${randomUUID()}`;
    owner = `${prefix}-owner`; other = `${prefix}-other`; third = `${prefix}-third`;
    ids = [`${prefix}-public`, `${prefix}-private`, `${prefix}-second`];
    await schema.db.insert(schema.communityPosts).values(ids.map((id, i) => ({
      id, ownerUserId: owner, kind: "story" as const, text: "Scoped test fixture",
      visibility: i === 1 ? "private" as const : "members" as const,
    })));
  });
  afterEach(async () => {
    if (ids) {
      await schema.db.delete(schema.communityReports).where(inArray(schema.communityReports.postId, ids));
      await schema.db.delete(schema.communityPosts).where(inArray(schema.communityPosts.id, ids));
    }
  });
  afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    if (schema) await schema.pool.end();
  });
  const path = (id: string) => `/community/posts/${id}`;

  it("requires sign-in and denies private posts without disclosing their comments", async () => {
    expect((await request("PUT", `${path(ids[0])}/like`)).status).toBe(401);
    expect((await request("GET", `${path(ids[0])}/comments`)).status).toBe(401);
    for (const [method, suffix] of [["PUT", "/like"], ["GET", "/comments"], ["POST", "/comments"]]) {
      expect((await request(method, path(ids[1]) + suffix, other, method === "POST" ? "private?" : undefined, "valid-key-123")).status).toBe(404);
    }
  });
  it("persists one like per member, supports retries and removes only your own like", async () => {
    const url = `${path(ids[0])}/like`;
    const simultaneous = await Promise.all([request("PUT", url, other), request("PUT", url, other), request("PUT", url, other)]);
    expect(simultaneous.every(r => r.status === 200 && r.body.likeCount === 1 && r.body.likedByMe)).toBe(true);
    expect((await request("PUT", url, owner)).body.likeCount).toBe(2);
    expect((await request("DELETE", url, other)).body).toMatchObject({ likeCount: 1, likedByMe: false });
    expect((await request("DELETE", url, other)).body.likeCount).toBe(1);
  });
  it("saves comments once, rejects changed retries, validates text and keeps keys account/post scoped", async () => {
    const url = `${path(ids[0])}/comments`;
    const key = "stable-comment-request";
    const saved = await Promise.all([request("POST", url, other, "  Good walk  ", key), request("POST", url, other, "Good walk", key)]);
    expect(saved.every(r => r.status === 201)).toBe(true);
    const comments = (await request("GET", url, owner)).body.comments;
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ text: "Good walk", ownerUserId: other });
    expect((await request("POST", url, other, "Changed", key)).status).toBe(409);
    expect((await request("POST", url, other, "  ", "blank-text-key")).status).toBe(400);
    expect((await request("POST", url, other, "x".repeat(601), "long-text-key")).status).toBe(400);
    expect((await request("POST", url, other, "no key")).status).toBe(400);
    expect((await request("POST", url, owner, "Owner reply", key)).status).toBe(201);
    expect((await request("POST", `${path(ids[2])}/comments`, other, "Different post", key)).status).toBe(201);
  });
  it("paginates equal timestamps without skipping or duplicating comments", async () => {
    const date = new Date();
    await schema.db.insert(schema.communityComments).values(Array.from({ length: 21 }, (_, i) => ({
      id: `${ids[0]}-${String(i).padStart(2, "0")}`, postId: ids[0], ownerUserId: other, text: `Reply ${i}`, createdAt: date,
    })));
    const first = (await request("GET", `${path(ids[0])}/comments`, owner)).body;
    expect(first.comments).toHaveLength(20);
    const next = (await request("GET", `${path(ids[0])}/comments?cursor=${first.nextCursor}`, owner)).body;
    expect(next.comments).toHaveLength(1); expect(next.nextCursor).toBeNull();
    expect(new Set([...first.comments, ...next.comments].map(c => c.id)).size).toBe(21);
    expect((await request("GET", `${path(ids[0])}/comments?cursor=broken`, owner)).status).toBe(400);
  });
  it("allows comment authors and post owners to delete, never unrelated members or another post", async () => {
    const url = `${path(ids[0])}/comments`;
    await request("POST", url, other, "Reply", "permission-delete-key");
    const id = (await request("GET", url, owner)).body.comments[0].id;
    expect((await request("DELETE", `${url}/${id}`, third)).status).toBe(404);
    expect((await request("DELETE", `${path(ids[2])}/comments/${id}`, owner)).status).toBe(404);
    expect((await request("DELETE", `${url}/${id}`, other)).status).toBe(200);
    await request("POST", url, other, "Another reply", "second-delete-key");
    const second = (await request("GET", url, owner)).body.comments[0].id;
    expect((await request("DELETE", `${url}/${second}`, owner)).status).toBe(200);
  });
  it("preserves microsecond cursor precision and shows a new reply immediately on long threads", async () => {
    await schema.db.execute(sql`
      INSERT INTO community_comments (id, post_id, owner_user_id, text, created_at)
      SELECT ${ids[0]} || '-micro-' || n, ${ids[0]}, ${other}, 'Reply ' || n,
        '2026-01-01T12:00:00.000100Z'::timestamptz + n * interval '1 microsecond'
      FROM generate_series(0, 20) AS n
    `);
    const first = (await request("GET", `${path(ids[0])}/comments`, owner)).body;
    const second = (await request("GET", `${path(ids[0])}/comments?cursor=${first.nextCursor}`, owner)).body;
    expect(first.comments).toHaveLength(20);
    expect(second.comments).toHaveLength(1);
    expect(new Set([...first.comments, ...second.comments].map(c => c.id)).size).toBe(21);
    await request("POST", `${path(ids[0])}/comments`, other, "Newest reply", "newest-reply-key");
    expect((await request("GET", `${path(ids[0])}/comments`, owner)).body.comments[0].text).toBe("Newest reply");
  });
  it("rechecks privacy and reports, and cascades engagement on parent deletion", async () => {
    const url = path(ids[0]);
    await request("PUT", `${url}/like`, other);
    await request("POST", `${url}/comments`, other, "Private after sharing", "privacy-change-key");
    await schema.db.update(schema.communityPosts).set({ visibility: "private" }).where(eq(schema.communityPosts.id, ids[0]));
    expect((await request("GET", `${url}/comments`, other)).status).toBe(404);
    expect((await request("PUT", `${url}/like`, other)).status).toBe(404);
    expect((await request("GET", `${url}/comments`, owner)).body.comments).toHaveLength(1);
    await schema.db.update(schema.communityPosts).set({ visibility: "members" }).where(eq(schema.communityPosts.id, ids[0]));
    await schema.db.insert(schema.communityReports).values({ id: randomUUID(), postId: ids[0], reporterUserId: third, targetOwnerUserId: owner });
    expect((await request("GET", `${url}/comments`, third)).status).toBe(404);
    expect((await request("PUT", `${url}/like`, third)).status).toBe(404);
    await schema.db.delete(schema.communityPosts).where(eq(schema.communityPosts.id, ids[0]));
    expect(await schema.db.select().from(schema.communityComments).where(eq(schema.communityComments.postId, ids[0]))).toHaveLength(0);
    expect(await schema.db.select().from(schema.communityLikes).where(eq(schema.communityLikes.postId, ids[0]))).toHaveLength(0);
  });
});
