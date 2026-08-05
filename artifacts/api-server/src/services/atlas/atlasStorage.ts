/**
 * Atlas Storage Service
 * ─────────────────────
 * Handles upload/download of Atlas Media Studio images to Replit Object Storage.
 *
 * Path convention:
 *   atlas-media/{brandSlug}/{assetTypeSlug}/v{version}/{cropName}.webp
 *
 * Serving URL (via the API):
 *   /api/atlas/image/{assetId}/{cropName}
 */

import { Storage } from "@google-cloud/storage";
import type { Response as ExpressResponse } from "express";
import type { AtlasCropName, AtlasImageCrops } from "./atlasCropService.js";

const REPLIT_SIDECAR = "http://127.0.0.1:1106";

const storageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  } as Record<string, unknown>,
  projectId: "",
});

function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return storageClient.bucket(bucketId);
}

const CROP_EXT = ".webp";

function gcsPath(brandSlug: string, assetTypeSlug: string, assetId: string, version: number, crop: AtlasCropName): string {
  return `atlas-media/${brandSlug}/${assetTypeSlug}/${assetId}/v${version}/${crop}${CROP_EXT}`;
}

export function atlasServingPath(assetId: string, crop: AtlasCropName): string {
  return `/api/atlas/image/${assetId}/${crop}`;
}

export interface StoredAtlasAsset {
  masterPath:      string;
  desktopHeroPath: string;
  mobileHeroPath:  string;
  sectionPath:     string;
  cardPath:        string;
  squarePath:      string;
  portraitPath:    string;
  landscapePath:   string;
  socialPath:      string;
}

const ALL_CROPS: AtlasCropName[] = [
  "master", "desktopHero", "mobileHero", "section",
  "card", "square", "portrait", "landscape", "social",
];

/**
 * Upload all crops for an asset version to GCS.
 * Returns the API serving paths to store in the DB.
 */
export async function uploadAtlasAsset(
  brandSlug: string,
  assetTypeSlug: string,
  assetId: string,
  version: number,
  crops: AtlasImageCrops,
): Promise<StoredAtlasAsset> {
  const bucket = getBucket();

  await Promise.all(
    ALL_CROPS.map((crop) =>
      bucket.file(gcsPath(brandSlug, assetTypeSlug, assetId, version, crop)).save(crops[crop], {
        contentType: "image/webp",
        metadata: { cacheControl: "public, max-age=31536000, immutable" },
      })
    )
  );

  const sp = (c: AtlasCropName) => atlasServingPath(assetId, c);

  return {
    masterPath:      sp("master"),
    desktopHeroPath: sp("desktopHero"),
    mobileHeroPath:  sp("mobileHero"),
    sectionPath:     sp("section"),
    cardPath:        sp("card"),
    squarePath:      sp("square"),
    portraitPath:    sp("portrait"),
    landscapePath:   sp("landscape"),
    socialPath:      sp("social"),
  };
}

/**
 * Delete all GCS objects for an asset (all versions).
 */
export async function deleteAtlasAsset(assetId: string): Promise<void> {
  const bucket = getBucket();
  // Search across the whole atlas-media prefix for this assetId
  const [files] = await bucket.getFiles({ prefix: `atlas-media/` });
  const toDelete = files.filter((f) => f.name.includes(`/${assetId}/`));
  if (toDelete.length === 0) return;
  await Promise.all(toDelete.map((f) => f.delete().catch(() => {})));
}

/**
 * Stream a GCS image back through an Express response.
 * Called by GET /api/atlas/image/:assetId/:crop
 */
export async function streamAtlasImage(
  assetId: string,
  crop: AtlasCropName,
  res: ExpressResponse,
): Promise<void> {
  const bucket = getBucket();

  // List all files matching this assetId, find the crop with the highest numeric version
  const [files] = await bucket.getFiles({ prefix: `atlas-media/` });
  const versionRe = new RegExp(`/${assetId}/v(\\d+)/${crop}${CROP_EXT.replace(".", "\\.")}$`);

  let bestFile: (typeof files)[0] | null = null;
  let bestVersion = -1;

  for (const f of files) {
    const m = versionRe.exec(f.name);
    if (!m) continue;
    const v = parseInt(m[1], 10);
    if (v > bestVersion) { bestVersion = v; bestFile = f; }
  }

  if (!bestFile) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const file = bestFile; // highest numeric version

  res.setHeader("Content-Type", "image/webp");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  file.createReadStream()
    .on("error", () => { if (!res.headersSent) res.status(500).end(); })
    .pipe(res);
}
