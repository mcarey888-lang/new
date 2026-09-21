import {
  BATCH_02_ASSETS,
  BATCH_02_ID,
  BATCH_02_PROMPTS,
  validateBatch02InitialGeneration,
} from "./batch02.js";
import { cropMasterImage } from "./cropService.js";
import { defaultImageProvider, type ImageProvider } from "./imageProvider.js";
import {
  acquireReviewBatchGenerationLock,
  readReviewBatchManifest,
  uploadReviewCandidate,
  writeReviewBatchManifest,
  type ReviewBatchGenerationLock,
} from "./artworkStorage.js";
import {
  updateVersionStatus,
  type GenerationAttempt,
  type ReviewBatchManifest,
  type ReviewCandidate,
} from "./reviewBatchService.js";

const MANIFEST_GENERATION = Symbol("batch02ManifestGeneration");

type StoredManifest = ReviewBatchManifest & {
  [MANIFEST_GENERATION]?: number;
};

function setManifestGeneration(manifest: ReviewBatchManifest, generation: number) {
  Object.defineProperty(manifest, MANIFEST_GENERATION, {
    value: generation,
    enumerable: false,
    configurable: true,
  });
  return manifest as StoredManifest;
}

export async function getBatch02Manifest(): Promise<ReviewBatchManifest> {
  const record = await readReviewBatchManifest<ReviewBatchManifest>(BATCH_02_ID);
  if (record) {
    const stored = record.value;
    const attemptLedger = stored.attemptLedger ?? stored.candidates.map((candidate) => ({
      assetId: candidate.assetId,
      attempt: 1,
      version: candidate.version,
      reason: "INITIAL" as const,
      status: "stored" as const,
      startedAt: candidate.generatedAt,
      completedAt: candidate.generatedAt,
      provider: candidate.provider,
      cost: candidate.generationCost,
    }));
    return setManifestGeneration({
      ...stored,
      attemptLedger,
      versions: stored.versions ?? stored.candidates,
      estimatedCost: attemptLedger.reduce((total, attempt) => total + attempt.cost, 0),
    }, record.generation);
  }
  return setManifestGeneration({
    batchId: BATCH_02_ID,
    status: "REVIEW REQUIRED",
    approved: false,
    published: false,
    updatedAt: new Date(0).toISOString(),
    estimatedCost: 0,
    attemptLedger: [],
    candidates: [],
    versions: [],
  }, 0);
}

async function persistManifest(
  manifest: ReviewBatchManifest,
  candidates: ReviewCandidate[],
  attemptLedger: GenerationAttempt[],
  versions: ReviewCandidate[] = manifest.versions,
  lock?: ReviewBatchGenerationLock,
) {
  await lock?.assertOwned();
  const next: ReviewBatchManifest = {
    ...manifest,
    updatedAt: new Date().toISOString(),
    estimatedCost: attemptLedger.reduce((total, attempt) => total + attempt.cost, 0),
    attemptLedger,
    candidates,
    versions,
  };
  const generation = await writeReviewBatchManifest(
    BATCH_02_ID,
    next,
    (manifest as StoredManifest)[MANIFEST_GENERATION] ?? 0,
  );
  return setManifestGeneration(next, generation);
}

function sortCandidates(candidates: ReviewCandidate[]) {
  return candidates.sort((a, b) =>
    BATCH_02_ASSETS.findIndex((item) => item.assetId === a.assetId)
    - BATCH_02_ASSETS.findIndex((item) => item.assetId === b.assetId)
  );
}

async function curateBatch02Version(
  assetId: string,
  version: number,
  status: "APPROVED" | "REJECTED",
  rejectionReason?: string,
) {
  const lock = await acquireReviewBatchGenerationLock(BATCH_02_ID);
  try {
    let manifest = await getBatch02Manifest();
    const changedAt = new Date().toISOString();
    const versions = updateVersionStatus(
      manifest.versions,
      assetId,
      version,
      status,
      changedAt,
      rejectionReason,
    );
    const candidates = manifest.candidates.map((candidate) =>
      candidate.assetId === assetId && candidate.version === version
        ? versions.find((item) => item.assetId === assetId && item.version === version)!
        : candidate
    );
    manifest = await persistManifest(manifest, candidates, manifest.attemptLedger, versions, lock);
    return manifest;
  } finally {
    await lock.release();
  }
}

export function approveBatch02Version(assetId: string, version: number) {
  return curateBatch02Version(assetId, version, "APPROVED");
}

export function rejectBatch02Version(assetId: string, version: number, reason: string) {
  return curateBatch02Version(assetId, version, "REJECTED", reason);
}

export async function generateBatch02Candidate(
  assetId: string,
  provider: ImageProvider = defaultImageProvider,
): Promise<ReviewCandidate> {
  const definition = BATCH_02_PROMPTS.find((asset) => asset.assetId === assetId);
  if (!definition) throw new Error(`Unknown Batch 02 asset: ${assetId}`);

  const lock = await acquireReviewBatchGenerationLock(BATCH_02_ID);
  try {
    let manifest = await getBatch02Manifest();
    const priorAttempts = manifest.attemptLedger.filter((attempt) => attempt.assetId === assetId);
    const attempts = validateBatch02InitialGeneration(priorAttempts.length);
    const version = 1;
    const startedAt = new Date().toISOString();
    let attempt: GenerationAttempt = {
      assetId,
      attempt: attempts,
      version,
      reason: "INITIAL",
      status: "generating",
      startedAt,
      cost: 0,
    };
    let attemptLedger = [...manifest.attemptLedger, attempt];
    manifest = await persistManifest(manifest, manifest.candidates, attemptLedger, manifest.versions, lock);

    try {
      const generated = await provider.generate(definition.prompt);
      attempt = {
        ...attempt,
        status: "provider-succeeded",
        provider: generated.provider,
        cost: generated.cost,
      };
      attemptLedger = attemptLedger.map((item) =>
        item.assetId === assetId && item.attempt === attempts ? attempt : item
      );
      manifest = await persistManifest(manifest, manifest.candidates, attemptLedger, manifest.versions, lock);

      const crops = await cropMasterImage(generated.buffer);
      const stored = await uploadReviewCandidate(BATCH_02_ID, assetId, version, crops);
      const generatedAt = new Date().toISOString();
      const candidate: ReviewCandidate = {
        assetId,
        title: definition.title,
        family: definition.family,
        placement: definition.placement,
        cropGuidance: definition.cropGuidance,
        prompt: definition.prompt,
        promptHash: definition.hash,
        provider: generated.provider,
        model: "gpt-image-1",
        dimensions: "1536x1024",
        version,
        generatedAt,
        generationCost: generated.cost,
        status: "REVIEW REQUIRED",
        approved: false,
        published: false,
        ...stored,
        attempts,
      };
      const candidates = [
        ...manifest.candidates.filter((item) => item.assetId !== assetId),
        candidate,
      ];
      sortCandidates(candidates);
      const versions = [...manifest.versions, candidate];
      attempt = { ...attempt, status: "stored", completedAt: generatedAt };
      attemptLedger = attemptLedger.map((item) =>
        item.assetId === assetId && item.attempt === attempts ? attempt : item
      );
      await persistManifest(manifest, candidates, attemptLedger, versions, lock);
      return candidate;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      attempt = {
        ...attempt,
        status: "failed",
        completedAt: new Date().toISOString(),
        error: reason,
      };
      attemptLedger = attemptLedger.map((item) =>
        item.assetId === assetId && item.attempt === attempts ? attempt : item
      );
      await persistManifest(manifest, manifest.candidates, attemptLedger, manifest.versions, lock);
      throw error;
    }
  } finally {
    await lock.release();
  }
}