import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq, notExists, or, sql } from "drizzle-orm";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { communityComments, communityLikes, communityPosts, communityReports, db } from "@workspace/db";
import { getAuthor } from "../services/communityAuthors";
import { communityEngagement } from "../services/communityEngagement";

const router = Router();
const writeLimiter = rateLimit({
  windowMs: 60 * 60_000, limit: 240, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => getAuth(req).userId ?? ipKeyGenerator(req.ip ?? "unknown"),
  message: { error: "Too many reactions. Please try again later." },
});
const commentLimiter = rateLimit({
  windowMs: 60 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => getAuth(req).userId ?? ipKeyGenerator(req.ip ?? "unknown"),
  message: { error: "Too many comments. Please try again later." },
});
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const postId = (req: Request) => String(req.params.id ?? "");
function member(req: Request, res: Response) {
  const id = getAuth(req).userId;
  if (!id) res.status(401).json({ error: "Unauthorized" });
  res.setHeader("Cache-Control", "private, no-store");
  return id;
}
async function readable(database: typeof db | Tx, id: string, userId: string, lock = false) {
  const query = database.select().from(communityPosts).where(and(
    eq(communityPosts.id, id),
    or(eq(communityPosts.ownerUserId, userId), eq(communityPosts.visibility, "members")),
    notExists(database.select({ id: communityReports.id }).from(communityReports).where(and(
      eq(communityReports.postId, id), eq(communityReports.reporterUserId, userId),
    ))),
  )).limit(1);
  return (lock ? await query.for("update") : await query)[0];
}
function notFound(res: Response) { res.status(404).json({ error: "Community post or comment not found" }); }

for (const method of ["put", "delete"] as const) {
  router[method]("/community/posts/:id/like", writeLimiter, async (req, res) => {
    const userId = member(req, res); if (!userId) return;
    const id = postId(req);
    const accessible = await db.transaction(async tx => {
      if (!await readable(tx, id, userId, true)) return false;
      if (method === "put") {
        await tx.insert(communityLikes).values({ postId: id, userId }).onConflictDoNothing();
      } else {
        await tx.delete(communityLikes).where(and(eq(communityLikes.postId, id), eq(communityLikes.userId, userId)));
      }
      return true;
    });
    if (!accessible) { notFound(res); return; }
    res.json((await communityEngagement([id], userId)).get(id));
  });
}

const cursorSchema = z.object({ at: z.string().datetime({ offset: true }), id: z.string().min(1).max(100) });
router.get("/community/posts/:id/comments", async (req, res) => {
  const userId = member(req, res); if (!userId) return;
  const id = postId(req);
  if (!await readable(db, id, userId)) { notFound(res); return; }
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (req.query.cursor !== undefined) {
    try {
      if (typeof req.query.cursor !== "string" || req.query.cursor.length > 512) throw new Error("bad cursor");
      cursor = cursorSchema.parse(JSON.parse(Buffer.from(req.query.cursor, "base64url").toString()));
    } catch { res.status(400).json({ error: "Invalid comment cursor" }); return; }
  }
  const rows = await db.select({
    id: communityComments.id, postId: communityComments.postId, text: communityComments.text,
    ownerUserId: communityComments.ownerUserId, createdAt: communityComments.createdAt,
    // Preserve PostgreSQL's microseconds in the cursor: JS Date truncation can
    // otherwise skip replies sharing a millisecond at a page boundary.
    cursorAt: sql<string>`to_char(${communityComments.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  }).from(communityComments).where(and(
    eq(communityComments.postId, id),
    cursor ? sql`(${communityComments.createdAt}, ${communityComments.id}) < (${cursor.at}::timestamptz, ${cursor.id}::text)` : undefined,
  )).orderBy(desc(communityComments.createdAt), desc(communityComments.id)).limit(21);
  const page = rows.slice(0, 20);
  const authors = new Map(await Promise.all([...new Set(page.map(c => c.ownerUserId))]
    .map(async authorId => [authorId, await getAuthor(authorId)] as const)));
  const last = page.at(-1);
  res.json({
    comments: page.map(({ cursorAt: _, ...c }) => ({ ...c, authorName: authors.get(c.ownerUserId)!.name, authorAvatarUrl: authors.get(c.ownerUserId)!.avatarUrl })),
    nextCursor: rows.length > 20 && last
      ? Buffer.from(JSON.stringify({ at: last.cursorAt, id: last.id })).toString("base64url") : null,
  });
});

router.post("/community/posts/:id/comments", writeLimiter, commentLimiter, async (req, res) => {
  const userId = member(req, res); if (!userId) return;
  const parsed = z.object({ text: z.string().trim().min(1).max(600) }).safeParse(req.body);
  const requestId = req.get("X-Idempotency-Key");
  if (!parsed.success || !requestId || !/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) {
    res.status(400).json({ error: "Enter a comment of 1–600 characters and a valid request ID" }); return;
  }
  const id = postId(req);
  const commentId = `comment_${createHash("sha256").update(`${userId}:${id}:${requestId}`).digest("hex")}`;
  const outcome = await db.transaction(async tx => {
    if (!await readable(tx, id, userId, true)) return "missing";
    await tx.insert(communityComments).values({
      id: commentId, postId: id, ownerUserId: userId, text: parsed.data.text,
    }).onConflictDoNothing();
    const [comment] = await tx.select().from(communityComments).where(eq(communityComments.id, commentId)).limit(1);
    return comment?.text === parsed.data.text ? "saved" : "conflict";
  });
  if (outcome === "missing") { notFound(res); return; }
  if (outcome === "conflict") { res.status(409).json({ error: "This comment request was already used for different text" }); return; }
  res.status(201).json({ saved: true });
});

router.delete("/community/posts/:id/comments/:commentId", writeLimiter, async (req, res) => {
  const userId = member(req, res); if (!userId) return;
  const id = postId(req);
  const deleted = await db.transaction(async tx => {
    const post = await readable(tx, id, userId, true);
    if (!post) return false;
    const [removed] = await tx.delete(communityComments).where(and(
      eq(communityComments.id, String(req.params.commentId)), eq(communityComments.postId, id),
      post.ownerUserId === userId ? undefined : eq(communityComments.ownerUserId, userId),
    )).returning({ id: communityComments.id });
    return Boolean(removed);
  });
  if (!deleted) { notFound(res); return; }
  res.json({ deleted: true });
});
export default router;
