/**
 * Atlas Service
 * ─────────────
 * Orchestrates the full Atlas Media Studio image generation pipeline:
 *
 *   brand + asset type + scene vars
 *     → buildAtlasPrompt()
 *     → ImageProvider.generate()
 *     → cropAtlasMasterImage()
 *     → uploadAtlasAsset()
 *     → DB update
 *
 * Copied and adapted from artworkService.ts. Same state machine, same
 * bulk-generation pattern, same error isolation.
 */

import { db, atlasBrands, atlasAssetTypes, atlasAssets } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { buildAtlasPrompt } from "./atlasPromptBuilder.js";
import { defaultImageProvider, type ImageProvider } from "../artwork/imageProvider.js";
import { cropAtlasMasterImage } from "./atlasCropService.js";
import { uploadAtlasAsset, deleteAtlasAsset, atlasServingPath } from "./atlasStorage.js";
import type { AtlasCropName } from "./atlasCropService.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AtlasGenerateResult {
  assetId: string;
  status: "generated" | "skipped" | "failed";
  reason?: string;
  prompt?: string;
}

export interface AtlasBulkResult {
  succeeded: AtlasGenerateResult[];
  failed:    AtlasGenerateResult[];
  skipped:   AtlasGenerateResult[];
  total:     number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchAssetWithRelations(assetId: string) {
  const rows = await db
    .select()
    .from(atlasAssets)
    .where(eq(atlasAssets.assetId, assetId))
    .limit(1);

  if (rows.length === 0) return null;
  const asset = rows[0];

  const brandRows = await db
    .select()
    .from(atlasBrands)
    .where(eq(atlasBrands.id, asset.brandId))
    .limit(1);

  const assetTypeRows = await db
    .select()
    .from(atlasAssetTypes)
    .where(eq(atlasAssetTypes.id, asset.assetTypeId))
    .limit(1);

  if (brandRows.length === 0 || assetTypeRows.length === 0) return null;

  return { asset, brand: brandRows[0], assetType: assetTypeRows[0] };
}

// ── Core generation ───────────────────────────────────────────────────────────

export async function generateAtlasAsset(
  assetId: string,
  force = false,
  provider: ImageProvider = defaultImageProvider,
): Promise<AtlasGenerateResult> {
  const data = await fetchAssetWithRelations(assetId);
  if (!data) {
    return { assetId, status: "failed", reason: "Asset not found" };
  }
  const { asset, brand, assetType } = data;

  // Fetch match reference description if set
  let matchReferenceDescription: string | null = null;
  if (asset.matchReferenceId) {
    const refRows = await db
      .select({ imagePrompt: atlasAssets.imagePrompt })
      .from(atlasAssets)
      .where(eq(atlasAssets.id, asset.matchReferenceId))
      .limit(1);
    if (refRows.length > 0 && refRows[0].imagePrompt) {
      matchReferenceDescription = refRows[0].imagePrompt;
    }
  }

  const { prompt } = buildAtlasPrompt({
    brandName: brand.name,
    styleProfile: (brand.styleProfile ?? {}) as Record<string, string[]>,
    styleLock: (brand.styleLock ?? {}) as Record<string, string>,
    sceneVars: (asset.sceneVars ?? {}) as Record<string, string>,
    assetTypeName: assetType.name,
    matchReferenceDescription,
  });

  // Stale check
  if (
    !force &&
    asset.approved &&
    asset.imagePrompt === prompt &&
    asset.imageStatus === "approved"
  ) {
    return { assetId, status: "skipped", reason: "Approved image still current" };
  }

  // Mark generating
  await db
    .update(atlasAssets)
    .set({ imageStatus: "generating", updatedAt: new Date() })
    .where(eq(atlasAssets.assetId, assetId));

  try {
    const { buffer: masterBuffer, provider: providerName, cost } = await provider.generate(prompt);
    const crops = await cropAtlasMasterImage(masterBuffer);
    const nextVersion = (asset.imageVersion ?? 0) + 1;
    const stored = await uploadAtlasAsset(brand.slug, assetType.slug, assetId, nextVersion, crops);

    const now = new Date();
    await db
      .update(atlasAssets)
      .set({
        masterImage:      stored.masterPath,
        desktopHeroImage: stored.desktopHeroPath,
        mobileHeroImage:  stored.mobileHeroPath,
        sectionImage:     stored.sectionPath,
        cardImage:        stored.cardPath,
        squareImage:      stored.squarePath,
        portraitImage:    stored.portraitPath,
        landscapeImage:   stored.landscapePath,
        socialImage:      stored.socialPath,
        imagePrompt:      prompt,
        imageVersion:     nextVersion,
        imageStatus:      "generated",
        approved:         false,
        generatedAt:      now,
        lastGenerated:    now,
        provider:         providerName,
        generationCost:   cost,
        updatedAt:        now,
      })
      .where(eq(atlasAssets.assetId, assetId));

    return { assetId, status: "generated", prompt };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[atlas] generation failed for ${assetId}:`, err);
    await db
      .update(atlasAssets)
      .set({ imageStatus: "failed", updatedAt: new Date() })
      .where(eq(atlasAssets.assetId, assetId));
    return { assetId, status: "failed", reason };
  }
}

// ── Approve / reject / archive / publish ─────────────────────────────────────

export async function approveAtlasAsset(assetId: string): Promise<void> {
  await db
    .update(atlasAssets)
    .set({ approved: true, imageStatus: "approved", updatedAt: new Date() })
    .where(eq(atlasAssets.assetId, assetId));
}

export async function rejectAtlasAsset(assetId: string): Promise<void> {
  await db
    .update(atlasAssets)
    .set({ approved: false, imageStatus: "rejected", updatedAt: new Date() })
    .where(eq(atlasAssets.assetId, assetId));
}

export async function archiveAtlasAsset(assetId: string): Promise<void> {
  await db
    .update(atlasAssets)
    .set({ archived: true, imageStatus: "archived", updatedAt: new Date() })
    .where(eq(atlasAssets.assetId, assetId));
}

export async function publishAtlasAsset(assetId: string): Promise<{ ok: boolean; reason?: string }> {
  // Enforce: must be approved before publishing
  const rows = await db
    .select({ approved: atlasAssets.approved, imageStatus: atlasAssets.imageStatus })
    .from(atlasAssets)
    .where(eq(atlasAssets.assetId, assetId))
    .limit(1);

  if (rows.length === 0) return { ok: false, reason: "Asset not found" };
  const { approved, imageStatus } = rows[0];
  if (!approved || imageStatus !== "approved") {
    return { ok: false, reason: "Asset must be approved before publishing" };
  }

  const now = new Date();
  await db
    .update(atlasAssets)
    .set({ published: true, publishedAt: now, updatedAt: now })
    .where(eq(atlasAssets.assetId, assetId));
  return { ok: true };
}

// ── Import (local upload) ─────────────────────────────────────────────────────

export async function importAtlasAsset(
  assetId: string,
  imageBuffer: Buffer,
): Promise<{ ok: boolean; reason?: string }> {
  const data = await fetchAssetWithRelations(assetId);
  if (!data) return { ok: false, reason: "Asset not found" };
  const { asset, brand, assetType } = data;

  try {
    const crops = await cropAtlasMasterImage(imageBuffer);
    const nextVersion = (asset.imageVersion ?? 0) + 1;
    const stored = await uploadAtlasAsset(brand.slug, assetType.slug, assetId, nextVersion, crops);

    const now = new Date();
    await db
      .update(atlasAssets)
      .set({
        masterImage:      stored.masterPath,
        desktopHeroImage: stored.desktopHeroPath,
        mobileHeroImage:  stored.mobileHeroPath,
        sectionImage:     stored.sectionPath,
        cardImage:        stored.cardPath,
        squareImage:      stored.squarePath,
        portraitImage:    stored.portraitPath,
        landscapeImage:   stored.landscapePath,
        socialImage:      stored.socialPath,
        imageVersion:     nextVersion,
        imageStatus:      "generated",
        approved:         false,
        generatedAt:      now,
        lastGenerated:    now,
        provider:         "upload",
        generationCost:   null,
        updatedAt:        now,
      })
      .where(eq(atlasAssets.assetId, assetId));

    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[atlas] import failed for ${assetId}:`, err);
    await db
      .update(atlasAssets)
      .set({ imageStatus: "failed", updatedAt: new Date() })
      .where(eq(atlasAssets.assetId, assetId));
    return { ok: false, reason };
  }
}

export async function clearAtlasAsset(assetId: string): Promise<void> {
  await deleteAtlasAsset(assetId);
  await db
    .update(atlasAssets)
    .set({
      masterImage:      null,
      desktopHeroImage: null,
      mobileHeroImage:  null,
      sectionImage:     null,
      cardImage:        null,
      squareImage:      null,
      portraitImage:    null,
      landscapeImage:   null,
      socialImage:      null,
      imagePrompt:      null,
      imageVersion:     0,
      imageStatus:      "pending",
      approved:         false,
      published:        false,
      archived:         false,
      generatedAt:      null,
      lastGenerated:    null,
      provider:         null,
      generationCost:   null,
      updatedAt:        new Date(),
    })
    .where(eq(atlasAssets.assetId, assetId));
}

// ── Bulk generation ───────────────────────────────────────────────────────────

const BULK_DELAY_MS = 4_500;

export async function bulkGenerateAtlasAssets(
  brandId: number | null,
  onProgress?: (result: AtlasGenerateResult, index: number, total: number) => void,
  force = false,
  provider: ImageProvider = defaultImageProvider,
): Promise<AtlasBulkResult> {
  // When scoped to a brand, auto-create a default asset record for any asset
  // type that doesn't already have one — so "Generate All" always covers every
  // type, not just the ones the user has manually created so far.
  if (brandId !== null) {
    const [allTypes, existingAssets] = await Promise.all([
      db.select({ id: atlasAssetTypes.id }).from(atlasAssetTypes).where(eq(atlasAssetTypes.active, true)),
      db.select({ assetTypeId: atlasAssets.assetTypeId }).from(atlasAssets)
        .where(and(eq(atlasAssets.brandId, brandId), eq(atlasAssets.archived, false))),
    ]);
    const existingTypeIds = new Set(existingAssets.map(a => a.assetTypeId));
    const missingTypes = allTypes.filter(t => !existingTypeIds.has(t.id));
    if (missingTypes.length > 0) {
      await Promise.all(missingTypes.map(t => createAtlasAsset(brandId, t.id, {})));
    }
  }

  const query = db
    .select({ assetId: atlasAssets.assetId })
    .from(atlasAssets);

  const allAssets = brandId
    ? await query.where(and(eq(atlasAssets.brandId, brandId), eq(atlasAssets.archived, false)))
    : await query.where(eq(atlasAssets.archived, false));

  const total = allAssets.length;
  const succeeded: AtlasGenerateResult[] = [];
  const failed:    AtlasGenerateResult[] = [];
  const skipped:   AtlasGenerateResult[] = [];

  for (let i = 0; i < allAssets.length; i++) {
    const { assetId } = allAssets[i];
    const result = await generateAtlasAsset(assetId, force, provider);

    if (result.status === "generated") succeeded.push(result);
    else if (result.status === "failed") failed.push(result);
    else                                 skipped.push(result);

    onProgress?.(result, i + 1, total);

    if (i < allAssets.length - 1) {
      await new Promise((r) => setTimeout(r, BULK_DELAY_MS));
    }
  }

  return { succeeded, failed, skipped, total };
}

// ── Status query ──────────────────────────────────────────────────────────────

export async function getAtlasStatus(brandId?: number) {
  const q = db
    .select({
      assetId:          atlasAssets.assetId,
      brandId:          atlasAssets.brandId,
      assetTypeId:      atlasAssets.assetTypeId,
      sceneVars:        atlasAssets.sceneVars,
      imagePrompt:      atlasAssets.imagePrompt,
      imageVersion:     atlasAssets.imageVersion,
      imageStatus:      atlasAssets.imageStatus,
      approved:         atlasAssets.approved,
      published:        atlasAssets.published,
      archived:         atlasAssets.archived,
      masterImage:      atlasAssets.masterImage,
      desktopHeroImage: atlasAssets.desktopHeroImage,
      mobileHeroImage:  atlasAssets.mobileHeroImage,
      sectionImage:     atlasAssets.sectionImage,
      cardImage:        atlasAssets.cardImage,
      squareImage:      atlasAssets.squareImage,
      portraitImage:    atlasAssets.portraitImage,
      landscapeImage:   atlasAssets.landscapeImage,
      socialImage:      atlasAssets.socialImage,
      generatedAt:      atlasAssets.generatedAt,
      lastGenerated:    atlasAssets.lastGenerated,
      provider:         atlasAssets.provider,
      generationCost:   atlasAssets.generationCost,
      matchReferenceId: atlasAssets.matchReferenceId,
      brandName:        atlasBrands.name,
      brandSlug:        atlasBrands.slug,
      assetTypeName:    atlasAssetTypes.name,
      assetTypeSlug:    atlasAssetTypes.slug,
    })
    .from(atlasAssets)
    .innerJoin(atlasBrands,     eq(atlasAssets.brandId,     atlasBrands.id))
    .innerJoin(atlasAssetTypes, eq(atlasAssets.assetTypeId, atlasAssetTypes.id));

  if (brandId) {
    return q.where(and(eq(atlasAssets.brandId, brandId), eq(atlasAssets.archived, false)));
  }
  return q.where(eq(atlasAssets.archived, false));
}

// ── Brands + Asset Types queries ──────────────────────────────────────────────

export async function getAllBrands() {
  return db.select().from(atlasBrands).where(eq(atlasBrands.active, true)).orderBy(atlasBrands.name);
}

export async function getAllAssetTypes() {
  return db.select().from(atlasAssetTypes).where(eq(atlasAssetTypes.active, true)).orderBy(atlasAssetTypes.sortOrder);
}

export async function updateStyleLock(brandId: number, styleLock: Record<string, string>): Promise<void> {
  await db
    .update(atlasBrands)
    .set({ styleLock, updatedAt: new Date() })
    .where(eq(atlasBrands.id, brandId));
}

export async function createAtlasAsset(
  brandId: number,
  assetTypeId: number,
  sceneVars: Record<string, string> = {},
): Promise<string> {
  // Generate a unique assetId: ATL + timestamp suffix
  const assetId = `ATL${Date.now().toString(36).toUpperCase()}`;
  await db.insert(atlasAssets).values({
    assetId,
    brandId,
    assetTypeId,
    sceneVars,
    imageStatus: "pending",
    approved: false,
    published: false,
    archived: false,
  });
  return assetId;
}
