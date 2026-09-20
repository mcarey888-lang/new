import {
  BATCH_01_ASSETS,
  BATCH_01_ID,
  BATCH_01_PROMPTS,
  nextReviewVersion,
  validateCandidateGeneration,
  type ObjectiveFailureReason,
} from "./batch01.js";
import { cropMasterImage } from "./cropService.js";
import { defaultImageProvider, type ImageProvider } from "./imageProvider.js";
import {
  acquireReviewBatchGenerationLock,
  readReviewBatchManifest,
  uploadReviewCandidate,
  writeReviewBatchManifest,
  type ReviewBatchGenerationLock,
} from "./artworkStorage.js";

const GENERATION_DELAY_MS = 4_500;
const MANIFEST_GENERATION = Symbol("manifestGeneration");

export interface GenerationAttempt {
  assetId: string;
  attempt: number;
  version: number;
  reason: "INITIAL" | ObjectiveFailureReason;
  status: "generating" | "provider-succeeded" | "stored" | "failed";
  startedAt: string;
  completedAt?: string;
  provider?: string;
  cost: number;
  error?: string;
}

export interface ReviewCandidate {
  assetId: string;
  title: string;
  family: string;
  placement: string;
  cropGuidance: string;
  prompt: string;
  promptHash: string;
  provider: string;
  model: string;
  dimensions: "1536x1024";
  version: number;
  generatedAt: string;
  generationCost: number;
  status: "REVIEW REQUIRED" | "APPROVED" | "REJECTED";
  approved: boolean;
  published: false;
  statusChangedAt?: string;
  rejectionReason?: string;
  masterPath: string;
  heroPath: string;
  cardPath: string;
  thumbnailPath: string;
  objectPaths: Record<string, string>;
  attempts: number;
}

export interface ReviewBatchManifest {
  batchId: typeof BATCH_01_ID;
  status: "REVIEW REQUIRED";
  approved: false;
  published: false;
  updatedAt: string;
  estimatedCost: number;
  attemptLedger: GenerationAttempt[];
  candidates: ReviewCandidate[];
  versions: ReviewCandidate[];
}

type StoredReviewBatchManifest = ReviewBatchManifest & {
  [MANIFEST_GENERATION]?: number;
};

function setManifestGeneration(manifest: ReviewBatchManifest, generation: number) {
  Object.defineProperty(manifest, MANIFEST_GENERATION, {
    value: generation,
    enumerable: false,
    configurable: true,
  });
  return manifest as StoredReviewBatchManifest;
}

export async function getBatch01Manifest(): Promise<ReviewBatchManifest> {
  const record = await readReviewBatchManifest<ReviewBatchManifest>(BATCH_01_ID);
  if (record) {
    const stored = record.value;
    const attemptLedger = stored.attemptLedger ?? stored.candidates.map((candidate) => ({
      assetId: candidate.assetId,
      attempt: candidate.attempts,
      version: candidate.version,
      reason: "INITIAL" as const,
      status: "stored" as const,
      startedAt: candidate.generatedAt,
      completedAt: candidate.generatedAt,
      provider: candidate.provider,
      cost: candidate.generationCost,
    }));
    const versions = stored.versions ?? stored.candidates;
    return setManifestGeneration({
      ...stored,
      attemptLedger,
      versions,
      estimatedCost: attemptLedger.reduce((total, attempt) => total + attempt.cost, 0),
    }, record.generation);
  }
  return setManifestGeneration({
    batchId: BATCH_01_ID,
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
    BATCH_01_ID,
    next,
    (manifest as StoredReviewBatchManifest)[MANIFEST_GENERATION] ?? 0,
  );
  return setManifestGeneration(next, generation);
}

function sortCandidates(candidates: ReviewCandidate[]) {
  return candidates.sort((a, b) =>
    BATCH_01_ASSETS.findIndex((item) => item.assetId === a.assetId)
    - BATCH_01_ASSETS.findIndex((item) => item.assetId === b.assetId)
  );
}

export function updateVersionStatus(
  versions: ReviewCandidate[],
  assetId: string,
  version: number,
  status: "APPROVED" | "REJECTED",
  statusChangedAt: string,
  rejectionReason?: string,
): ReviewCandidate[] {
  const target = versions.find(
    (candidate) => candidate.assetId === assetId && candidate.version === version,
  );
  if (!target) throw new Error(`Unknown Batch 01 version: ${assetId} v${version}`);
  if (status === "REJECTED" && !rejectionReason?.trim()) {
    throw new Error("Rejecting a candidate requires a reason");
  }
  return versions.map((candidate) =>
    candidate.assetId === assetId && candidate.version === version
      ? {
          ...candidate,
          status,
          approved: status === "APPROVED",
          published: false,
          statusChangedAt,
          rejectionReason: status === "REJECTED" ? rejectionReason!.trim() : undefined,
        }
      : candidate
  );
}

async function curateBatch01Version(
  assetId: string,
  version: number,
  status: "APPROVED" | "REJECTED",
  rejectionReason?: string,
): Promise<ReviewBatchManifest> {
  const lock = await acquireReviewBatchGenerationLock(BATCH_01_ID);
  try {
    let manifest = await getBatch01Manifest();
    const statusChangedAt = new Date().toISOString();
    const versions = updateVersionStatus(
      manifest.versions,
      assetId,
      version,
      status,
      statusChangedAt,
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

export function approveBatch01Version(assetId: string, version: number) {
  return curateBatch01Version(assetId, version, "APPROVED");
}

export function rejectBatch01Version(assetId: string, version: number, reason: string) {
  return curateBatch01Version(assetId, version, "REJECTED", reason);
}

export async function generateBatch01Candidate(
  assetId: string,
  objectiveFailureReason?: ObjectiveFailureReason,
  provider: ImageProvider = defaultImageProvider,
): Promise<ReviewCandidate> {
  const definition = BATCH_01_PROMPTS.find((asset) => asset.assetId === assetId);
  if (!definition) throw new Error(`Unknown Batch 01 asset: ${assetId}`);

  const lock = await acquireReviewBatchGenerationLock(BATCH_01_ID);
  try {
    let manifest = await getBatch01Manifest();
    const priorAttempts = manifest.attemptLedger.filter((attempt) => attempt.assetId === assetId);
    const attempts = validateCandidateGeneration(
      priorAttempts.length > 0,
      priorAttempts.length,
      objectiveFailureReason,
    );
    const version = nextReviewVersion(priorAttempts.map((attempt) => attempt.version));
    const startedAt = new Date().toISOString();
    let attempt: GenerationAttempt = {
      assetId,
      attempt: attempts,
      version,
      reason: objectiveFailureReason ?? "INITIAL",
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
      const stored = await uploadReviewCandidate(BATCH_01_ID, assetId, version, crops);
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
      manifest = await persistManifest(manifest, candidates, attemptLedger, versions, lock);
      return candidate;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      attempt = { ...attempt, status: "failed", completedAt: new Date().toISOString(), error: reason };
      attemptLedger = attemptLedger.map((item) =>
        item.assetId === assetId && item.attempt === attempts ? attempt : item
      );
      manifest = await persistManifest(manifest, manifest.candidates, attemptLedger, manifest.versions, lock);
      throw error;
    }
  } finally {
    await lock.release();
  }
}

export async function generateBatch01(
  provider: ImageProvider = defaultImageProvider,
  onProgress?: (candidate: ReviewCandidate, index: number, total: number) => void,
) {
  const existing = await getBatch01Manifest();
  const generatedIds = new Set(existing.candidates.map((candidate) => candidate.assetId));
  const pending = BATCH_01_ASSETS.filter((asset) => !generatedIds.has(asset.assetId));
  const generated: ReviewCandidate[] = [];
  for (let index = 0; index < pending.length; index++) {
    const candidate = await generateBatch01Candidate(pending[index].assetId, undefined, provider);
    generated.push(candidate);
    onProgress?.(candidate, index + 1, pending.length);
    if (index < pending.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, GENERATION_DELAY_MS));
    }
  }
  return { generated, manifest: await getBatch01Manifest() };
}