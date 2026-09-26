import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { canonicalActivities, communityPosts, communityReports, db, trackedRoutes, userDemoProfiles } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { deleteCommunityPhoto } from "./community";

const router: IRouter = Router();

function isMissingDemoProfilesTable(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "42P01";
}

function respondToDemoProfileError(req: Request, res: Response, err: unknown): void {
  req.log.error({ err }, "Failed to access user demo profile");
  if (isMissingDemoProfilesTable(err)) {
    res.status(503).json({
      error: "Demo profile storage is unavailable because the user_demo_profiles database migration has not been applied.",
    });
    return;
  }
  const msg = err instanceof Error ? err.message : "Failed to access demo profile";
  res.status(500).json({ error: msg });
}

router.get("/user/demo-profile", requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [profile] = await db.select({ createdAt: userDemoProfiles.createdAt })
      .from(userDemoProfiles)
      .where(eq(userDemoProfiles.clerkUserId, userId))
      .limit(1);
    res.status(200).json({
      enabled: Boolean(profile),
      createdAt: profile?.createdAt.toISOString() ?? null,
    });
  } catch (err: unknown) {
    respondToDemoProfileError(req, res, err);
  }
});

router.put("/user/demo-profile", requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await db.insert(userDemoProfiles)
      .values({ clerkUserId: userId })
      .onConflictDoNothing({ target: userDemoProfiles.clerkUserId });
    const [profile] = await db.select({ createdAt: userDemoProfiles.createdAt })
      .from(userDemoProfiles)
      .where(eq(userDemoProfiles.clerkUserId, userId))
      .limit(1);
    if (!profile) {
      throw new Error("Demo profile could not be created");
    }
    res.status(200).json({ enabled: true, createdAt: profile.createdAt.toISOString() });
  } catch (err: unknown) {
    respondToDemoProfileError(req, res, err);
  }
});

router.delete("/user/demo-profile", requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await db.delete(userDemoProfiles).where(eq(userDemoProfiles.clerkUserId, userId));
    res.status(200).json({ enabled: false, createdAt: null });
  } catch (err: unknown) {
    respondToDemoProfileError(req, res, err);
  }
});

router.delete("/user/me", requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const ownedPosts = await db.select({ photoPath: communityPosts.photoPath })
      .from(communityPosts).where(eq(communityPosts.ownerUserId, userId));
    await db.delete(communityReports).where(or(
      eq(communityReports.reporterUserId, userId),
      eq(communityReports.targetOwnerUserId, userId),
    ));
    await db.delete(communityPosts).where(eq(communityPosts.ownerUserId, userId));
    await Promise.all(ownedPosts.flatMap(({ photoPath }) => photoPath
      ? [deleteCommunityPhoto(photoPath).catch((err: unknown) => {
        req.log.error({ err, userId }, "Failed to remove community photo during account deletion");
      })]
      : []));
    // Delete owned community routes by their authoritative server-side owner.
    // Route contributions on those canonical routes are removed by FK cascade.
    await db.delete(trackedRoutes).where(eq(trackedRoutes.createdBy, userId));
    // Canonical activity evidence, links, qualifications and conflicts cascade.
    // Legacy tracked hill rows retain their original data and have their nullable
    // canonical link cleared by ON DELETE SET NULL.
    await db.delete(canonicalActivities).where(eq(canonicalActivities.ownerUserId, userId));
    try {
      await db.delete(userDemoProfiles).where(eq(userDemoProfiles.clerkUserId, userId));
    } catch (err: unknown) {
      if (!isMissingDemoProfilesTable(err)) throw err;
      req.log.warn({ err, userId }, "Skipping demo profile cleanup because its database migration has not been applied");
    }
    await clerkClient.users.deleteUser(userId);
    res.status(200).json({ deleted: true });
  } catch (err: unknown) {
    req.log.error({ err, userId }, "Failed to delete Clerk user");
    const msg = err instanceof Error ? err.message : "Failed to delete account";
    res.status(500).json({ error: msg });
  }
});

export default router;
