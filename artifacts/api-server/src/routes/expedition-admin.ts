import { Router, json } from "express";
import { db, signatureChallenges, challengeStages, challengeLimitations, executeEngineReadOnlyQuery } from "@workspace/db";
import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireAdminKey } from "../middlewares/requireAdminKey.js";
import { CANONICAL_TRUST_SQL } from "../services/mountain/canonicalMountainLookup.js";
import { expeditionInput, expeditionTotals, previewExpeditions,
  type CatalogueMountain, type ExpeditionInput } from "../services/expeditionAuthoring.js";
import { GenerateAdminExpeditionBody, GenerateAdminExpeditionResponse } from "@workspace/api-zod";
import { createDataEngineVirtualExpeditionHandler } from "./virtual-expedition.js";
import { expeditionGenerationDraft } from "../services/expeditionGenerationDraft.js";

export const expeditionAdminRouter = Router();
expeditionAdminRouter.use("/admin/expeditions", requireAdminKey, json({ limit: "2mb" }), (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
const columns = { ...getTableColumns(signatureChallenges),
  updatedAt: sql<string>`${signatureChallenges.updatedAt}::text` };
const catalogueColumns = `m.id::text AS id, m.name, m.country, m.region,
  ST_Y(m.geom)::float8 AS latitude, ST_X(m.geom)::float8 AS longitude,
  m.elevation_m::float8 AS "elevationM", m.status`;

const generateDraft = createDataEngineVirtualExpeditionHandler(result => {
  const preview = expeditionGenerationDraft(result);
  // Orval's Zod output strips additionalProperties from record-shaped DTOs.
  // Validate required fields without discarding editable stage/provenance fields.
  GenerateAdminExpeditionResponse.parse(preview);
  return preview;
});
let generationInProgress = false;
expeditionAdminRouter.post("/admin/expeditions/generate", async (req, res) => {
  const parsed = GenerateAdminExpeditionBody.refine(input =>
    input.targetMountain.trim().length >= 2 && input.userLocation.trim().length >= 2
      && (input.daysOverride == null || Number.isSafeInteger(input.daysOverride)),
  "Mountain and walking area must contain at least two characters.").safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the mountain, walking area, radius and whole-number walking allowance.", details: parsed.error.flatten() });
    return;
  }
  if (generationInProgress) {
    res.status(429).json({ error: "An admin generation is already running. Wait for it to finish before retrying." });
    return;
  }
  generationInProgress = true;
  try {
    // Same target resolution, geographic discovery and matching as the app.
    // This endpoint returns an unsaved authoring draft, never a catalogue write.
    req.body = { ...parsed.data, mode: "automatic", builderMode: "automatic",
      manualBuilder: false, resolveOnly: false, profileOnly: false };
    await generateDraft(req, res);
  } finally {
    generationInProgress = false;
  }
});

async function mountainBindings(body: unknown) {
  const parsed = z.object({ expeditions: z.array(z.unknown()).max(100) }).safeParse(body);
  const ids = new Set<string>();
  for (const raw of parsed.success ? parsed.data.expeditions : []) {
    const data = expeditionInput.safeParse(raw);
    if (data.success) for (const stage of data.data.stages) if (stage.mountainId) ids.add(stage.mountainId);
  }
  if (ids.size > 500) throw new Error("Too many catalogue links in one batch");
  if (!ids.size) return new Map<string, CatalogueMountain>();
  const rows = await executeEngineReadOnlyQuery<CatalogueMountain & Record<string, unknown>>(
    `SELECT ${catalogueColumns} FROM public.mountains m
     WHERE ${CANONICAL_TRUST_SQL} AND m.geom IS NOT NULL AND m.id::text = ANY($1::text[])`,
    [[...ids]]);
  return new Map(rows.map(row => [row.id, row]));
}
async function detail(id: string, client = db) {
  const [row] = await client.select(columns).from(signatureChallenges).where(eq(signatureChallenges.challengeId, id));
  if (!row) return null;
  const stages = await client.select().from(challengeStages).where(eq(challengeStages.challengeId, id))
    .orderBy(asc(challengeStages.stageOrder));
  const limitations = await client.select().from(challengeLimitations)
    .where(eq(challengeLimitations.challengeId, id)).orderBy(asc(challengeLimitations.id));
  return { ...row, stages, limitations: limitations.map(x => x.limitation) };
}
async function preview(body: unknown, editingId?: string) {
  const existing = await db.select({ id: signatureChallenges.challengeId }).from(signatureChallenges);
  return previewExpeditions(body, new Set(existing.map(x => x.id)), await mountainBindings(body), editingId);
}
function parentValues(input: ExpeditionInput, draft: boolean) {
  return {
    challengeId: input.challengeId, challengeName: input.challengeName,
    targetMountainName: input.targetMountainName,
    mountainSlug: input.targetMountainName.normalize("NFKD").replace(/\p{Diacritic}/gu, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    targetRoute: input.targetRoute || null, recommendedDays: input.recommendedDays ?? input.stages.length,
    summary: input.summary || null, regions: input.regions || null, difficulty: input.difficulty || null,
    ...expeditionTotals(input.stages), status: draft ? "draft" : input.status,
    dataConfidence: "Owner-curated — route facts require independent review",
    updatedAt: sql`clock_timestamp()`,
  };
}
async function writeChildren(tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: ExpeditionInput, mountains: Map<string, CatalogueMountain>) {
  await tx.insert(challengeStages).values(input.stages.map((stage, i) => ({
    challengeId: input.challengeId, stageOrder: i + 1,
    routeKey: stage.routeKey || `${input.challengeId.toLowerCase()}-${randomUUID()}`,
    routeName: stage.routeName, region: stage.region || null,
    distanceKm: stage.distanceKm, ascentM: stage.ascentM,
    estimatedHours: stage.estimatedHours ?? null, difficulty: stage.difficulty || null,
    dnaContribution: stage.dnaContribution || null, whySelected: stage.whySelected || null,
    catalogueMountain: stage.mountainId ? mountains.get(stage.mountainId) ?? null : null,
  })));
  if (input.limitations.length) await tx.insert(challengeLimitations)
    .values(input.limitations.map(limitation => ({ challengeId: input.challengeId, limitation })));
}

expeditionAdminRouter.get("/admin/expeditions/catalogue", async (req, res) => {
  const q = z.string().trim().min(2).max(120).safeParse(req.query.q);
  if (!q.success) return res.status(400).json({ error: "Enter at least two characters." });
  try {
    const term = `%${q.data.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = await executeEngineReadOnlyQuery<CatalogueMountain & Record<string, unknown>>(
      `SELECT ${catalogueColumns} FROM public.mountains m WHERE ${CANONICAL_TRUST_SQL}
       AND m.geom IS NOT NULL AND (m.name ILIKE $1 ESCAPE '\\' OR m.region ILIKE $1 ESCAPE '\\')
       ORDER BY lower(m.name), m.id LIMIT 51`, [term]);
    return res.json({ items: rows.slice(0, 50), hasMore: rows.length > 50 });
  } catch (err) { req.log.error({ err }, "Expedition catalogue unavailable"); return res.status(503).json({ error: "Summit catalogue unavailable. Try again later." }); }
});
expeditionAdminRouter.get("/admin/expeditions", async (req, res) => {
  try {
    const rows = await db.select(columns).from(signatureChallenges).orderBy(asc(signatureChallenges.challengeId));
    const stages = await db.select().from(challengeStages).orderBy(asc(challengeStages.stageOrder));
    const limitations = await db.select().from(challengeLimitations).orderBy(asc(challengeLimitations.id));
    res.json({ expeditions: rows.map(row => ({ ...row,
      stages: stages.filter(s => s.challengeId === row.challengeId),
      limitations: limitations.filter(l => l.challengeId === row.challengeId).map(l => l.limitation),
    })) });
  } catch (err) { req.log.error({ err }, "Expedition list failed"); res.status(500).json({ error: "Could not load expeditions." }); }
});
expeditionAdminRouter.post("/admin/expeditions/preview", async (req, res) => {
  try { res.json(await preview(req.body)); }
  catch (err) { req.log.error({ err }, "Expedition preview failed"); res.status(503).json({ error: "Cannot validate catalogue links right now. No changes saved." }); }
});
expeditionAdminRouter.post("/admin/expeditions/import", async (req, res) => {
  try {
    const checked = await preview(req.body);
    if (!checked.valid) return res.status(400).json({ error: "Import validation failed. Nothing saved.", ...checked });
    const mountains = await mountainBindings(req.body);
    const inputs = checked.entries.map(e => e.expedition!);
    await db.transaction(async tx => {
      for (const input of inputs) {
        // A concurrent duplicate aborts the whole transaction, never an upsert.
        await tx.insert(signatureChallenges).values(parentValues(input, true));
        await writeChildren(tx, input, mountains);
      }
    });
    return res.status(201).json({ created: inputs.map(i => i.challengeId) });
  } catch (err) {
    req.log.error({ err }, "Expedition import failed");
    const code = (err as { code?: string; cause?: { code?: string } }).cause?.code ?? (err as { code?: string }).code;
    return res.status(code === "23505" ? 409 : 503).json({ error: code === "23505"
      ? "An expedition ID already exists. Nothing imported; preview again." : "Import failed. No changes saved." });
  }
});
expeditionAdminRouter.get("/admin/expeditions/:id", async (req, res) => {
  try {
    const item = await detail(String(req.params.id));
    if (!item) return res.status(404).json({ error: "Expedition not found." });
    return res.json({ expedition: item });
  } catch (err) { req.log.error({ err }, "Expedition read failed"); return res.status(500).json({ error: "Could not load expedition." }); }
});
expeditionAdminRouter.put("/admin/expeditions/:id", async (req, res) => {
  const body = z.object({ expedition: z.unknown(), expectedUpdatedAt: z.string().min(1).max(100) }).strict().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Expedition and expectedUpdatedAt are required." });
  const id = String(req.params.id);
  try {
    const checked = await preview({ expeditions: [body.data.expedition] }, id);
    if (!checked.valid) return res.status(400).json({ error: "Expedition validation failed.", ...checked });
    const input = checked.entries[0]!.expedition!;
    const mountains = await mountainBindings({ expeditions: [input] });
    const result = await db.transaction(async tx => {
      const [current] = await tx.select(columns).from(signatureChallenges)
        .where(eq(signatureChallenges.challengeId, id)).for("update");
      if (!current) return 404;
      if (current.updatedAt !== body.data.expectedUpdatedAt) return 409;
      // Keep stable stage keys, including when an editor reorders the stages.
      await tx.update(signatureChallenges).set(parentValues(input, false)).where(eq(signatureChallenges.challengeId, id));
      await tx.delete(challengeStages).where(eq(challengeStages.challengeId, id));
      await tx.delete(challengeLimitations).where(eq(challengeLimitations.challengeId, id));
      await writeChildren(tx, input, mountains);
      return 200;
    });
    if (result !== 200) return res.status(result).json({ error: result === 409
      ? "This expedition changed elsewhere. Reload before saving." : "Expedition not found." });
    return res.json({ expedition: await detail(id) });
  } catch (err) { req.log.error({ err }, "Expedition update failed"); return res.status(503).json({ error: "Could not save expedition. No changes saved." }); }
});
expeditionAdminRouter.delete("/admin/expeditions/:id", async (req, res) => {
  const version = z.string().min(1).max(100).safeParse(req.body?.expectedUpdatedAt);
  if (!version.success) return res.status(400).json({ error: "expectedUpdatedAt is required." });
  try {
    const result = await db.transaction(async tx => {
      const [item] = await tx.select(columns).from(signatureChallenges)
        .where(eq(signatureChallenges.challengeId, String(req.params.id))).for("update");
      if (!item) return 404;
      if (item.updatedAt !== version.data || item.status !== "draft") return 409;
      await tx.delete(signatureChallenges).where(and(eq(signatureChallenges.challengeId, item.challengeId),
        eq(signatureChallenges.status, "draft")));
      return 200;
    });
    if (result !== 200) return res.status(result).json({ error: "Only unchanged drafts can be deleted. Hide a published expedition instead." });
    return res.json({ deleted: true });
  } catch (err) { req.log.error({ err }, "Expedition deletion failed"); return res.status(503).json({ error: "Could not delete draft." }); }
});
