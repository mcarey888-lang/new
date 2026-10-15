import { createHash } from "node:crypto";
import { pool } from "@workspace/db";
import snapshot from "./approved-artwork-promotion.json";

type RecordRow = { slug: string; data: string; cachedAt: string };
type StoredRow = { slug: string; data: string; cached_at: Date | string };
export type PromotionGroup = { id: string; name: string; records: RecordRow[] };
export type PromotionItem = { id: string; name: string; action: "insert" | "preserve" };

// Immutable, previously reviewed metadata only. No generation or uploaded payloads.
export const promotionGroups: PromotionGroup[] = snapshot.records
  .filter(row => row.slug.startsWith("hero-approved:v1:id:"))
  .map(row => {
    const id = row.slug.slice("hero-approved:v1:id:".length);
    const records = snapshot.records.filter(record =>
      record.slug === `hero-review:v1:${id}` ||
      (record.slug.startsWith("hero-approved:v1:") && JSON.parse(record.data).mountainId === id));
    if (records.length !== 3) throw new Error("Invalid approved artwork promotion package");
    return { id, name: JSON.parse(row.data).source.title.split(" — ")[0], records };
  });

const packageId = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

export function promotionPlan(rows: StoredRow[], database: string) {
  const items: PromotionItem[] = promotionGroups.map(group => ({
    id: group.id,
    name: group.name,
    action: rows.some(row => group.records.some(record => record.slug === row.slug) ||
      (row.slug.startsWith("hero-approved:v1:") && JSON.parse(row.data).mountainId === group.id))
      ? "preserve" : "insert",
  }));
  const state = rows.map(row => [row.slug, row.data, new Date(row.cached_at).toISOString()])
    .sort((a, b) => a[0].localeCompare(b[0]));
  return {
    packageId, database, items,
    planId: createHash("sha256").update(JSON.stringify([packageId, database, state])).digest("hex"),
    mountainsToImport: items.filter(item => item.action === "insert").length,
    mountainsPreserved: items.filter(item => item.action === "preserve").length,
    recordsToInsert: items.filter(item => item.action === "insert").length * 3,
  };
}

export class PromotionConflict extends Error {}

/** Writes only the application's artwork cache, never the engine pool/catalogue. */
export async function runArtworkPromotion(approval?: { planId: string }) {
  const client = await pool.connect();
  try {
    await client.query(approval ? "BEGIN" : "BEGIN READ ONLY");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    if (approval) await client.query("LOCK TABLE public.cached_mountains IN SHARE ROW EXCLUSIVE MODE");
    const database = String((await client.query("SELECT current_database() AS name")).rows[0].name);
    const ids = promotionGroups.map(group => group.id);
    const mountains = await client.query("SELECT id::text FROM public.mountains WHERE id = ANY($1::uuid[])", [ids]);
    if (mountains.rows.length !== ids.length) {
      throw new PromotionConflict("This database does not contain all 33 original mountain IDs. Nothing was imported.");
    }
    const keys = promotionGroups.flatMap(group => group.records.map(record => record.slug));
    const existing = await client.query<StoredRow>(
      "SELECT slug, data, cached_at FROM public.cached_mountains WHERE slug = ANY($1::text[]) OR slug LIKE 'hero-approved:v1:%'",
      [keys],
    );
    const plan = promotionPlan(existing.rows, database);
    if (approval) {
      if (approval.planId !== plan.planId) throw new PromotionConflict("Artwork decisions changed. Preview again before approving.");
      for (const item of plan.items.filter(item => item.action === "insert")) {
        for (const record of promotionGroups.find(group => group.id === item.id)!.records) {
          await client.query("INSERT INTO public.cached_mountains (slug, data, cached_at) VALUES ($1, $2, $3::timestamptz)",
            [record.slug, record.data, record.cachedAt]);
        }
      }
    }
    await client.query("COMMIT");
    return { ...plan, applied: Boolean(approval), insertedRecords: approval ? plan.recordsToInsert : 0 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
