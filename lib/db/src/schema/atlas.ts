/**
 * Atlas Media Studio — Database Schema
 * ─────────────────────────────────────
 * Tables:
 *   atlasBrands     — configurable brands (Alliance Installations, AI Wraps, etc.)
 *   atlasAssetTypes — configurable asset types (Hero, Card, Social, etc.)
 *   atlasAssets     — generated images (one record per asset per brand+type)
 */

import {
  pgTable,
  serial,
  text,
  integer,
  smallint,
  real,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// ── Atlas Brands ──────────────────────────────────────────────────────────────
// One record per supported brand. styleProfile and styleLock are free-form JSON
// so future fields can be added without schema migrations.
export const atlasBrands = pgTable("atlas_brands", {
  id:           serial("id").primaryKey(),
  slug:         text("slug").notNull().unique(),           // e.g. "alliance-installations"
  name:         text("name").notNull(),                    // e.g. "Alliance Installations"
  /** JSON blob injected as a fixed style block into every generation prompt */
  styleProfile: jsonb("style_profile").$type<Record<string, string[]>>().default({}).notNull(),
  /** JSON blob — per-brand visual DNA captured from approved reference images */
  styleLock:    jsonb("style_lock").$type<Record<string, string>>().default({}).notNull(),
  active:       boolean("active").notNull().default(true),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Atlas Asset Types ─────────────────────────────────────────────────────────
// Configurable list of asset types (Hero, Desktop Hero, Social, etc.).
// cropConfigs stores the set of crop dimensions to generate on approval.
export const atlasAssetTypes = pgTable("atlas_asset_types", {
  id:          serial("id").primaryKey(),
  slug:        text("slug").notNull().unique(),            // e.g. "desktop-hero"
  name:        text("name").notNull(),                     // e.g. "Desktop Hero"
  description: text("description"),
  /** JSON: array of { name, width, height } — crops generated on approval */
  cropConfigs: jsonb("crop_configs").$type<Array<{ name: string; width: number; height: number }>>().default([]).notNull(),
  sortOrder:   smallint("sort_order").notNull().default(0),
  active:      boolean("active").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Atlas Assets ──────────────────────────────────────────────────────────────
// One record per generated image. Supports the full Generate → Review →
// Approve → Publish lifecycle.
export const atlasAssets = pgTable("atlas_assets", {
  id:            serial("id").primaryKey(),
  assetId:       text("asset_id").notNull().unique(),      // e.g. "ATL001"
  brandId:       integer("brand_id").notNull().references(() => atlasBrands.id),
  assetTypeId:   integer("asset_type_id").notNull().references(() => atlasAssetTypes.id),

  // ── Scene variables (free-form JSON) ─────────────────────────────────────
  /** Scene, Task, Equipment, Crew Size, Lighting, Weather selections */
  sceneVars:     jsonb("scene_vars").$type<Record<string, string>>().default({}).notNull(),

  // ── Generation metadata ───────────────────────────────────────────────────
  imagePrompt:   text("image_prompt"),
  imageVersion:  smallint("image_version").default(0),
  imageStatus:   text("image_status").default("pending"),  // pending|generating|generated|approved|rejected|failed|archived
  provider:      text("provider"),                         // e.g. "openai-gpt-image-1"
  generationCost: real("generation_cost"),
  generatedAt:   timestamp("generated_at", { withTimezone: true }),
  lastGenerated: timestamp("last_generated", { withTimezone: true }),

  // ── Serving paths (stored after upload) ──────────────────────────────────
  /** Master 1536×1024 */
  masterImage:      text("master_image"),
  /** Desktop Hero 1920×1080 */
  desktopHeroImage: text("desktop_hero_image"),
  /** Mobile Hero 390×844 */
  mobileHeroImage:  text("mobile_hero_image"),
  /** Section 1440×600 */
  sectionImage:     text("section_image"),
  /** Card 400×500 */
  cardImage:        text("card_image"),
  /** Square 1080×1080 */
  squareImage:      text("square_image"),
  /** Portrait 1080×1350 */
  portraitImage:    text("portrait_image"),
  /** Landscape 1920×1080 */
  landscapeImage:   text("landscape_image"),
  /** Social 1080×1080 safe-zone */
  socialImage:      text("social_image"),

  // ── Approval & publishing ─────────────────────────────────────────────────
  approved:        boolean("approved").default(false),
  published:       boolean("published").default(false),
  publishedAt:     timestamp("published_at", { withTimezone: true }),
  archived:        boolean("archived").default(false),

  // ── Match Previous — visual reference for future generations ─────────────
  matchReferenceId: integer("match_reference_id"),         // fk to atlasAssets.id

  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Type exports ──────────────────────────────────────────────────────────────
export type AtlasBrand           = typeof atlasBrands.$inferSelect;
export type InsertAtlasBrand     = typeof atlasBrands.$inferInsert;
export type AtlasAssetType       = typeof atlasAssetTypes.$inferSelect;
export type InsertAtlasAssetType = typeof atlasAssetTypes.$inferInsert;
export type AtlasAsset           = typeof atlasAssets.$inferSelect;
export type InsertAtlasAsset     = typeof atlasAssets.$inferInsert;
