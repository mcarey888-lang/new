import { Router, type IRouter } from "express";
import { getAuth, clerkClient } from "@clerk/express";

const router: IRouter = Router();

router.delete("/user/me", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await clerkClient.users.deleteUser(userId);
    res.status(200).json({ deleted: true });
  } catch (err: unknown) {
    req.log.error({ err, userId }, "Failed to delete Clerk user");
    const msg = err instanceof Error ? err.message : "Failed to delete account";
    res.status(500).json({ error: msg });
  }
});

export default router;
