import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq } from "drizzle-orm";
import { db, plannedRoutes } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { optionalInt, validateSave } from "../services/routing/plannedRouteRules";

/**
 * Saving and loading routes somebody drew for themselves.
 *
 * A plan belongs to one person. Every query here is filtered by the userId
 * from the verified Clerk token, never by one supplied in the request — a
 * route id is not a secret, and ownership that can be asserted by the caller
 * is not ownership.
 *
 * Nothing in here touches the canonical route pipeline. A plan has no evidence
 * source, no rights clearance and no canonical identity, and it cannot become
 * published geometry by being saved. Promotion, if it is ever wanted, is a
 * deliberate separate step that does not exist yet.
 */

/** Most routes one person's list will return at once. */
const PAGE_SIZE = 100;

const router: IRouter = Router();

router.get("/planned-routes", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "sign in required" }); return; }
  try {
    const rows = await db
      .select()
      .from(plannedRoutes)
      .where(eq(plannedRoutes.userId, userId))
      .orderBy(desc(plannedRoutes.updatedAt))
      .limit(PAGE_SIZE);
    res.json({ routes: rows });
  } catch (err) {
    req.log?.warn({ err }, "planned-routes list failed");
    res.status(500).json({ error: "could not load your routes" });
  }
});

router.get("/planned-routes/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "sign in required" }); return; }
  try {
    const [row] = await db
      .select()
      .from(plannedRoutes)
      /* Owner is part of the lookup, not a check afterwards. A 404 for someone
         else's route is also the right answer: it does not confirm the id
         exists. */
      .where(and(eq(plannedRoutes.id, req.params.id), eq(plannedRoutes.userId, userId)))
      .limit(1);
    if (!row) { res.status(404).json({ error: "not found" }); return; }
    res.json({ route: row });
  } catch (err) {
    req.log?.warn({ err }, "planned-routes read failed");
    res.status(500).json({ error: "could not load that route" });
  }
});

router.post("/planned-routes", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "sign in required" }); return; }

  const check = validateSave(req.body);
  if (!check.ok) { res.status(400).json({ error: check.reason }); return; }
  const b = req.body as Record<string, unknown>;

  const row = {
    id: typeof b["id"] === "string" && b["id"] ? b["id"] : randomUUID(),
    userId,
    name: check.name,
    anchors: b["anchors"] as unknown,
    geometry: b["geometry"] as unknown,
    legs: Array.isArray(b["legs"]) ? (b["legs"] as unknown) : [],
    lengthM: Math.round(b["lengthM"] as number),
    ascentM: optionalInt(b["ascentM"]),
    descentM: optionalInt(b["descentM"]),
    profile: b["profile"] ?? null,
    /* Only true when the caller says every leg followed a path. Anything
       else — including the field being missing — is false, because the
       cautious reading is the safe one. */
    fullySnapped: b["fullySnapped"] === true,
  };

  try {
    const [saved] = await db
      .insert(plannedRoutes)
      .values(row)
      /* Re-saving an open route updates it rather than making a duplicate, but
         only when it is already yours: the owner is in the WHERE, so a guessed
         id cannot overwrite someone else's route. */
      .onConflictDoUpdate({
        target: plannedRoutes.id,
        set: { ...row, updatedAt: new Date() },
        where: eq(plannedRoutes.userId, userId),
      })
      .returning();
    if (!saved) { res.status(409).json({ error: "that route id belongs to someone else" }); return; }
    res.json({ route: saved });
  } catch (err) {
    req.log?.warn({ err }, "planned-routes save failed");
    res.status(500).json({ error: "could not save that route" });
  }
});

router.delete("/planned-routes/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "sign in required" }); return; }
  try {
    const deleted = await db
      .delete(plannedRoutes)
      .where(and(eq(plannedRoutes.id, req.params.id), eq(plannedRoutes.userId, userId)))
      .returning({ id: plannedRoutes.id });
    if (deleted.length === 0) { res.status(404).json({ error: "not found" }); return; }
    res.json({ deleted: deleted[0]!.id });
  } catch (err) {
    req.log?.warn({ err }, "planned-routes delete failed");
    res.status(500).json({ error: "could not delete that route" });
  }
});

export default router;
