import { randomUUID } from "node:crypto";
import express, { Router, type IRouter, type Request, type Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import sharp from "sharp";
import { communityPosts, communityReports, db } from "@workspace/db";
import { ObjectStorageService, objectStorageClient } from "../lib/objectStorage";
import {
  canReadCommunityPost,
  canReportCommunityPost,
  isHiddenByReport,
  isValidCommunityPostContent,
  matchesCommunityImageFormat,
  resolveUniqueCommunityAuthors,
} from "../services/communityPolicy";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const postWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many community post changes. Please try again later." },
});
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reports. Please try again later." },
});

type CommunityKind = "story" | "badge" | "photo";
type CommunityVisibility = "private" | "members";
function requireMember(req: Request, res: Response): string | null {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

function postIdFromRequest(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] ?? "" : id;
}

function postResponse(post: typeof communityPosts.$inferSelect, author: { name: string; avatarUrl: string | null }) {
  return {
    id: post.id,
    kind: post.kind,
    text: post.text,
    badgeId: post.badgeId,
    badgeTitle: post.badgeTitle,
    visibility: post.visibility,
    authorName: author.name,
    authorAvatarUrl: author.avatarUrl,
    ownerUserId: post.ownerUserId,
    createdAt: post.createdAt,
    hasPhoto: Boolean(post.photoPath),
  };
}

async function getAuthor(userId: string): Promise<{ name: string; avatarUrl: string | null }> {
  const user = await clerkClient.users.getUser(userId);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
    || user.username
    || "SummitReady member";
  return { name, avatarUrl: user.imageUrl || null };
}

async function buildPostResponse(post: typeof communityPosts.$inferSelect) {
  const [response] = await buildPostResponses([post]);
  if (!response) throw new Error("Could not resolve community post author");
  return response;
}

async function buildPostResponses(posts: readonly (typeof communityPosts.$inferSelect)[]) {
  const authors = await resolveUniqueCommunityAuthors(posts.map((post) => post.ownerUserId), getAuthor);
  return posts.map((post) => {
    const author = authors.get(post.ownerUserId);
    if (!author) throw new Error("Could not resolve community post author");
    return postResponse(post, author);
  });
}

function privateObjectLocation(storedPath: string) {
  const privateDir = objectStorage.getPrivateObjectDir().replace(/\/+$/, "");
  if (!storedPath.startsWith(`${privateDir}/`)) {
    throw new Error("Community photo path is outside the private object directory");
  }
  const remainder = storedPath.replace(/^\/+/, "");
  const [bucketName, ...objectParts] = remainder.split("/");
  if (!bucketName || objectParts.length === 0) throw new Error("Invalid private object path");
  return { bucketName, objectName: objectParts.join("/") };
}

export async function deleteCommunityPhoto(storedPath: string): Promise<void> {
  const { bucketName, objectName } = privateObjectLocation(storedPath);
  await objectStorageClient.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true });
}

router.post("/community/posts", postWriteLimiter, async (req, res) => {
  const userId = requireMember(req, res);
  if (!userId) return;

  const body = req.body as Record<string, unknown> | null;
  const kind = body?.kind;
  const text = body?.text === undefined ? "" : body.text;
  const badgeId = body?.badgeId === undefined ? null : body.badgeId;
  const badgeTitle = body?.badgeTitle === undefined ? null : body.badgeTitle;
  const requestedVisibility = body?.visibility === undefined ? "private" : body.visibility;
  if (!body || !["story", "badge", "photo"].includes(String(kind))
    || !isValidCommunityPostContent({ kind, text, badgeId, badgeTitle })
    || !["private", "members"].includes(String(requestedVisibility))) {
    res.status(400).json({ error: "Invalid community post" });
    return;
  }

  const safeVisibility: CommunityVisibility = kind === "photo"
    ? "private"
    : requestedVisibility as CommunityVisibility;
  const [post] = await db.insert(communityPosts).values({
    id: randomUUID(),
    ownerUserId: userId,
    kind: kind as CommunityKind,
    text: text as string,
    badgeId: badgeId as string | null,
    badgeTitle: badgeTitle as string | null,
    visibility: safeVisibility,
  }).returning();
  if (!post) {
    res.status(500).json({ error: "Could not create community post" });
    return;
  }
  res.status(201).json({ post: await buildPostResponse(post) });
});

router.get("/community/posts", async (req, res) => {
  const userId = requireMember(req, res);
  if (!userId) return;
  const scope = req.query.scope ?? "mine";
  if (scope !== "mine" && scope !== "members") {
    res.status(400).json({ error: "scope must be mine or members" });
    return;
  }

  let posts = scope === "mine"
    ? await db.select().from(communityPosts)
      .where(eq(communityPosts.ownerUserId, userId))
      .orderBy(desc(communityPosts.createdAt))
      .limit(50)
    : await db.select().from(communityPosts)
      .where(or(eq(communityPosts.ownerUserId, userId), eq(communityPosts.visibility, "members")))
      .orderBy(desc(communityPosts.createdAt))
      .limit(50);
  if (scope === "members" && posts.length > 0) {
    const reports = await db.select({ postId: communityReports.postId })
      .from(communityReports)
      .where(and(
        eq(communityReports.reporterUserId, userId),
        inArray(communityReports.postId, posts.map((post) => post.id)),
      ));
    const reportedPostIds = new Set(reports.map((report) => report.postId));
    posts = posts.filter((post) => !isHiddenByReport(post, userId, reportedPostIds));
  }
  try {
    res.json({ posts: await buildPostResponses(posts) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to resolve community post authors");
    res.status(503).json({ error: "Unable to load community author profiles" });
  }
});

router.patch("/community/posts/:id", postWriteLimiter, async (req, res) => {
  const userId = requireMember(req, res);
  if (!userId) return;
  const postId = postIdFromRequest(req);
  const visibility = (req.body as { visibility?: unknown } | undefined)?.visibility;
  if (visibility !== "private" && visibility !== "members") {
    res.status(400).json({ error: "visibility must be private or members" });
    return;
  }
  const [existing] = await db.select().from(communityPosts).where(and(
    eq(communityPosts.id, postId),
    eq(communityPosts.ownerUserId, userId),
  )).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Community post not found" });
    return;
  }
  const nextVisibility = existing.kind === "photo" && !existing.photoPath ? "private" : visibility;
  const [post] = await db.update(communityPosts).set({
    visibility: nextVisibility,
    updatedAt: new Date(),
  }).where(and(eq(communityPosts.id, existing.id), eq(communityPosts.ownerUserId, userId))).returning();
  if (!post) {
    res.status(404).json({ error: "Community post not found" });
    return;
  }
  res.json({ post: await buildPostResponse(post) });
});

router.delete("/community/posts/:id", postWriteLimiter, async (req, res) => {
  const userId = requireMember(req, res);
  if (!userId) return;
  const postId = postIdFromRequest(req);
  const [post] = await db.delete(communityPosts).where(and(
    eq(communityPosts.id, postId),
    eq(communityPosts.ownerUserId, userId),
  )).returning();
  if (!post) {
    res.status(404).json({ error: "Community post not found" });
    return;
  }
  await db.delete(communityReports).where(eq(communityReports.postId, post.id));
  if (post.photoPath) {
    try {
      await deleteCommunityPhoto(post.photoPath);
    } catch (error) {
      req.log.error({ err: error, postId: post.id }, "Failed to remove deleted community photo");
    }
  }
  res.status(200).json({ deleted: true });
});

router.put(
  "/community/posts/:id/photo",
  postWriteLimiter,
  (req, res, next) => {
    if (!requireMember(req, res)) return;
    next();
  },
  (req, res, next) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(req.get("content-type")?.split(";")[0] ?? "")) {
      res.status(415).json({ error: "Photo must use image/jpeg, image/png, or image/webp" });
      return;
    }
    next();
  },
  express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: MAX_IMAGE_BYTES }),
  async (req, res) => {
    const userId = requireMember(req, res);
    if (!userId) return;
    const postId = postIdFromRequest(req);
    const mimeType = req.get("content-type")?.split(";")[0] ?? "";
    if (!Buffer.isBuffer(req.body) || req.body.length === 0 || req.body.length > MAX_IMAGE_BYTES) {
      res.status(400).json({ error: "Photo must be a non-empty image no larger than 5 MB" });
      return;
    }
    const [post] = await db.select().from(communityPosts).where(and(
      eq(communityPosts.id, postId),
      eq(communityPosts.ownerUserId, userId),
    )).limit(1);
    if (!post) {
      res.status(404).json({ error: "Community post not found" });
      return;
    }
    if (post.kind !== "photo") {
      res.status(400).json({ error: "Photos can only be attached to photo posts" });
      return;
    }
    if (post.photoPath) {
      res.status(409).json({ error: "This post already has a photo" });
      return;
    }
    try {
      let webp: Buffer;
      try {
        const metadata = await sharp(req.body, { limitInputPixels: 24_000_000 }).metadata();
        if (!matchesCommunityImageFormat(mimeType, metadata.format)) {
          res.status(415).json({ error: "Photo content does not match its image content type" });
          return;
        }
        webp = await sharp(req.body, { limitInputPixels: 24_000_000 })
          .rotate()
          .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
      } catch {
        res.status(400).json({ error: "Photo could not be decoded as a supported image" });
        return;
      }
      const privateDir = objectStorage.getPrivateObjectDir().replace(/\/+$/, "");
      const storedPath = `${privateDir}/community-posts/${userId}/${randomUUID()}.webp`;
      const { bucketName, objectName } = privateObjectLocation(storedPath);
      await objectStorageClient.bucket(bucketName).file(objectName).save(webp, {
        resumable: false,
        contentType: "image/webp",
        metadata: { cacheControl: "private, no-store" },
      });
      const [updated] = await db.update(communityPosts).set({
        photoPath: storedPath,
        visibility: "private",
        updatedAt: new Date(),
      }).where(and(
        eq(communityPosts.id, post.id),
        eq(communityPosts.ownerUserId, userId),
        isNull(communityPosts.photoPath),
      )).returning();
      if (!updated) {
        await deleteCommunityPhoto(storedPath);
        res.status(409).json({ error: "This post already has a photo" });
        return;
      }
      res.json({ post: await buildPostResponse(updated) });
    } catch (error) {
      req.log.error({ err: error, postId: post.id }, "Failed to store community photo");
      res.status(500).json({ error: "Photo could not be saved" });
    }
  },
);

router.get("/community/posts/:id/photo", async (req, res) => {
  const userId = requireMember(req, res);
  if (!userId) return;
  const postId = postIdFromRequest(req);
  const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, postId)).limit(1);
  if (!post?.photoPath || !canReadCommunityPost(post, userId)) {
    res.status(404).json({ error: "Community photo not found" });
    return;
  }
  try {
    const { bucketName, objectName } = privateObjectLocation(post.photoPath);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    file.createReadStream().on("error", (error) => {
      req.log.warn({ err: error, postId: post.id }, "Failed to stream community photo");
      if (!res.headersSent) res.status(404).json({ error: "Community photo not found" });
      else res.destroy(error);
    }).pipe(res);
  } catch (error) {
    req.log.error({ err: error, postId: post.id }, "Failed to access private community photo");
    res.status(404).json({ error: "Community photo not found" });
  }
});

router.post("/community/posts/:id/report", reportLimiter, async (req, res) => {
  const userId = requireMember(req, res);
  if (!userId) return;
  const postId = postIdFromRequest(req);
  const [post] = await db.select().from(communityPosts).where(and(
    eq(communityPosts.id, postId),
    eq(communityPosts.visibility, "members"),
  )).limit(1);
  if (!post || !canReportCommunityPost(post, userId)) {
    res.status(404).json({ error: "Community post not found" });
    return;
  }
  const inserted = await db.insert(communityReports).values({
    id: randomUUID(),
    reporterUserId: userId,
    postId: post.id,
    targetOwnerUserId: post.ownerUserId,
  }).onConflictDoNothing({
    target: [communityReports.reporterUserId, communityReports.postId],
  }).returning({ id: communityReports.id });
  res.status(inserted.length > 0 ? 201 : 200).json({ reported: true });
});

export default router;