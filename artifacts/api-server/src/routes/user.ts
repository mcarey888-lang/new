import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { db, userDemoProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { deleteAccountHandler } from "../services/accountDeletion";

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
  /* The detail is logged above, not returned. A thrown database error
     carries its connection string, and that string carries a password. */
  res.status(500).json({ error: "Failed to access demo profile" });
}

router.get("/user/demo-profile", requireAuth({ json: true }), async (req, res) => {
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

router.put("/user/demo-profile", requireAuth({ json: true }), async (req, res) => {
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

router.delete("/user/demo-profile", requireAuth({ json: true }), async (req, res) => {
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

router.delete("/user/me", requireAuth({ json: true }), deleteAccountHandler);

export default router;
