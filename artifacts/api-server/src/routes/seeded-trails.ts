import { Router, type IRouter } from "express";
import { db, seededTrails } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/seeded-trails", async (req, res) => {
  try {
    const { area } = req.query as { area?: string };

    const rows = area
      ? await db
          .select()
          .from(seededTrails)
          .where(eq(seededTrails.osmArea, area))
          .orderBy(asc(seededTrails.name))
      : await db
          .select()
          .from(seededTrails)
          .orderBy(asc(seededTrails.name));

    res.json({ trails: rows, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch seeded trails");
    res.status(500).json({ error: "Failed to fetch trails" });
  }
});

export default router;
