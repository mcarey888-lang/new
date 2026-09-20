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
import crypto from "node:crypto";

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

export interface ReviewCandidatePaths {
  masterPath: string;
  heroPath: string;
  cardPath: string;
  thumbnailPath: string;
  objectPaths: Record<CropType, string>;
}

function candidateGcsPath(batchId: string, assetId: string, version: number, crop: CropType) {
  return `expedition-artwork/review-batches/${batchId}/${assetId}/v${version}/${crop}.jpg`;
}

function candidateServingPath(batchId: string, assetId: string, version: number, crop: CropType) {
  return `/api/artwork/batches/${batchId}/${assetId}/v${version}/${crop}`;
}

export async function uploadReviewCandidate(
  batchId: string,
  assetId: string,
  version: number,
  crops: { hero: Buffer; card: Buffer; thumbnail: Buffer; master: Buffer },
): Promise<ReviewCandidatePaths> {
  const bucket = getBucket();
  await Promise.all(
    CROP_TYPES.map((crop) =>
      bucket.file(candidateGcsPath(batchId, assetId, version, crop)).save(crops[crop], {
        contentType: "image/jpeg",
        metadata: { cacheControl: "private, max-age=3600" },
        resumable: false,
        preconditionOpts: { ifGenerationMatch: 0 },
      }),
    ),
  );
  return {
    masterPath: candidateServingPath(batchId, assetId, version, "master"),
    heroPath: candidateServingPath(batchId, assetId, version, "hero"),
    cardPath: candidateServingPath(batchId, assetId, version, "card"),
    thumbnailPath: candidateServingPath(batchId, assetId, version, "thumbnail"),
    objectPaths: Object.fromEntries(
      CROP_TYPES.map((crop) => [crop, candidateGcsPath(batchId, assetId, version, crop)]),
    ) as Record<CropType, string>,
  };
}

export async function writeReviewBatchManifest(
  batchId: string,
  manifest: unknown,
  expectedGeneration: number,
): Promise<number> {
  const file = getBucket().file(`expedition-artwork/review-batches/${batchId}/manifest.json`);
  await file.save(JSON.stringify(manifest, null, 2), {
      contentType: "application/json",
      metadata: { cacheControl: "no-store" },
      resumable: false,
      preconditionOpts: { ifGenerationMatch: expectedGeneration },
    });
  const [metadata] = await file.getMetadata();
  return Number(metadata.generation);
}

/**
 * Object Storage precondition lock. Batch generation is intentionally
 * serialized so version reservation, spend recording and manifest writes
 * cannot race, even if more than one API process receives a request.
 */
const GENERATION_LOCK_LEASE_MS = 10 * 60 * 1000;
const GENERATION_LOCK_RENEW_MS = 2 * 60 * 1000;

export interface ReviewBatchGenerationLock {
  assertOwned(): Promise<void>;
  release(): Promise<void>;
}

export async function acquireReviewBatchGenerationLock(
  batchId: string,
  staleRecoveryAttempted = false,
): Promise<ReviewBatchGenerationLock> {
  const bucket = getBucket();
  const lockPath = `expedition-artwork/review-batches/${batchId}/.generation.lock`;
  const file = bucket.file(lockPath);
  const owner = crypto.randomUUID();
  const lockContents = () => JSON.stringify({
    owner,
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + GENERATION_LOCK_LEASE_MS).toISOString(),
  });
  try {
    await file.save(lockContents(), {
      contentType: "application/json",
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? Number((error as { code?: unknown }).code)
      : 0;
    if (code === 412) {
      if (!staleRecoveryAttempted) {
        const [metadata] = await file.getMetadata();
        const [contents] = await file.download();
        const existing = JSON.parse(contents.toString("utf8")) as { expiresAt?: string };
        if (existing.expiresAt && Date.parse(existing.expiresAt) <= Date.now()) {
          await bucket.file(lockPath, { generation: Number(metadata.generation) }).delete();
          return acquireReviewBatchGenerationLock(batchId, true);
        }
      }
      throw new Error(`Review batch ${batchId} already has a generation in progress`);
    }
    throw error;
  }
  const [metadata] = await file.getMetadata();
  let generation = Number(metadata.generation);
  let lostError: Error | null = null;
  let renewal: Promise<void> | null = null;
  const renew = async () => {
    try {
      await file.save(lockContents(), {
        contentType: "application/json",
        resumable: false,
        preconditionOpts: { ifGenerationMatch: generation },
      });
      const [nextMetadata] = await file.getMetadata();
      generation = Number(nextMetadata.generation);
    } catch (error) {
      lostError = error instanceof Error ? error : new Error(String(error));
    }
  };
  const timer = setInterval(() => {
    if (!renewal) {
      renewal = renew().finally(() => { renewal = null; });
    }
  }, GENERATION_LOCK_RENEW_MS);
  timer.unref();
  return {
    async assertOwned() {
      await renewal;
      if (lostError) throw new Error(`Review batch ${batchId} generation lease was lost`);
      await renew();
      if (lostError) throw new Error(`Review batch ${batchId} generation lease was lost`);
    },
    async release() {
      clearInterval(timer);
      await renewal;
      if (lostError) return;
      try {
        const [contents] = await file.download();
        const existing = JSON.parse(contents.toString("utf8")) as { owner?: string };
        if (existing.owner !== owner) return;
        await bucket.file(lockPath, { generation }).delete();
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error
          ? Number((error as { code?: unknown }).code)
          : 0;
        if (code !== 404 && code !== 412) throw error;
      }
    },
  };
}

export async function readReviewBatchManifest<T>(
  batchId: string,
): Promise<{ value: T; generation: number } | null> {
  const file = getBucket().file(`expedition-artwork/review-batches/${batchId}/manifest.json`);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [contents] = await file.download();
  const [metadata] = await file.getMetadata();
  return {
    value: JSON.parse(contents.toString("utf8")) as T,
    generation: Number(metadata.generation),
  };
}

export async function streamReviewCandidate(
  batchId: string,
  assetId: string,
  version: number,
  crop: CropType,
  res: ExpressResponse,
) {
  const file = getBucket().file(candidateGcsPath(batchId, assetId, version, crop));
  const [exists] = await file.exists();
  if (!exists) {
    res.status(404).json({ error: "Review candidate not found" });
    return;
  }
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "private, max-age=3600");
  file.createReadStream()
    .on("error", () => res.status(500).end())
    .pipe(res);
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
