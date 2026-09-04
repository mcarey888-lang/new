import { Router, type IRouter } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, trackedRoutes } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.delete("/user/me", requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    // Delete owned community routes by their authoritative server-side owner.
    // Route contributions on those canonical routes are removed by FK cascade.
    await db.delete(trackedRoutes).where(eq(trackedRoutes.createdBy, userId));
    await clerkClient.users.deleteUser(userId);
    res.status(200).json({ deleted: true });
  } catch (err: unknown) {
    req.log.error({ err, userId }, "Failed to delete Clerk user");
    const msg = err instanceof Error ? err.message : "Failed to delete account";
    res.status(500).json({ error: msg });
  }
});

export default router;
