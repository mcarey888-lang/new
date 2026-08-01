/**
 * Artwork Storage Service
 * ───────────────────────
 * Handles direct server-side uploads of generated image buffers to
 * Replit Object Storage (GCS), and provides a streaming serve helper
 * for the /api/artwork/image/:challengeId/:crop endpoint.
 *
 * Path convention in GCS:
 *   expedition-artwork/{challengeId}/v{version}/{hero|card|thumbnail|master}.jpg
 *
 * Serving URL (via the API):
 *   /api/artwork/image/{challengeId}/{hero|card|thumbnail|master}
 */

import { Storage } from "@google-cloud/storage";
import type { Response as ExpressResponse } from "express";

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

export type CropType = "hero" | "card" | "thumbnail" | "master";
const CROP_TYPES: CropType[] = ["hero", "card", "thumbnail", "master"];

function gcsPath(challengeId: string, version: number, crop: CropType): string {
  return `expedition-artwork/${challengeId}/v${version}/${crop}.jpg`;
}

/** Serving path stored in the DB — used to construct the API serving URL */
export function servingPath(challengeId: string, crop: CropType): string {
  return `/api/artwork/image/${challengeId}/${crop}`;
}

export interface StoredArtwork {
  heroPath:      string;
  cardPath:      string;
  thumbnailPath: string;
  masterPath:    string;
}

/**
 * Upload all four crops (+ master) for a challenge version to GCS.
 * Returns the API serving paths to store in the DB.
 */
export async function uploadArtwork(
  challengeId: string,
  version: number,
  crops: { hero: Buffer; card: Buffer; thumbnail: Buffer; master: Buffer },
): Promise<StoredArtwork> {
  const bucket = getBucket();

  await Promise.all(
    CROP_TYPES.map((crop) =>
      bucket.file(gcsPath(challengeId, version, crop)).save(crops[crop], {
        contentType: "image/jpeg",
        metadata: { cacheControl: "public, max-age=31536000, immutable" },
      })
    )
  );

  return {
    heroPath:      servingPath(challengeId, "hero"),
    cardPath:      servingPath(challengeId, "card"),
    thumbnailPath: servingPath(challengeId, "thumbnail"),
    masterPath:    servingPath(challengeId, "master"),
  };
}

/**
 * Delete all GCS objects for a challenge (all versions).
 * Used when artwork is cleared from the admin panel.
 */
export async function deleteArtwork(challengeId: string): Promise<void> {
  const bucket = getBucket();
  const prefix = `expedition-artwork/${challengeId}/`;
  const [files] = await bucket.getFiles({ prefix });
  if (files.length === 0) return;
  await Promise.all(files.map((f) => f.delete().catch(() => {/* ignore missing */})));
}

/**
 * Stream a GCS image file back through an Express response.
 * Called by GET /api/artwork/image/:challengeId/:crop
 */
export async function streamArtworkImage(
  challengeId: string,
  crop: CropType,
  res: ExpressResponse,
): Promise<void> {
  const bucket = getBucket();

  // Find the latest version by listing objects for this challenge
  const prefix = `expedition-artwork/${challengeId}/`;
  const [files] = await bucket.getFiles({ prefix });

  // Pick the highest version number that has the requested crop
  const cropSuffix = `/${crop}.jpg`;
  const matching = files
    .filter((f) => f.name.endsWith(cropSuffix))
    .sort((a, b) => b.name.localeCompare(a.name));  // lexicographic desc → latest version last

  if (matching.length === 0) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const file = matching[matching.length - 1];  // highest version

  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  file.createReadStream()
    .on("error", () => res.status(500).end())
    .pipe(res);
}
