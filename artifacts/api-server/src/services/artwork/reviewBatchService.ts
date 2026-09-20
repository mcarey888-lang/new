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
} from "./artworkStorage.js";

const GENERATION_DELAY_MS = 4_500;

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
  status: "REVIEW REQUIRED";
  approved: false;
  published: false;
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
}

export async function getBatch01Manifest(): Promise<ReviewBatchManifest> {
  const stored = await readReviewBatchManifest<ReviewBatchManifest>(BATCH_01_ID);
  if (stored) {
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
    return {
      ...stored,
      attemptLedger,
      estimatedCost: attemptLedger.reduce((total, attempt) => total + attempt.cost, 0),
    };
  }
  return {
    batchId: BATCH_01_ID,
    status: "REVIEW REQUIRED",
    approved: false,
    published: false,
    updatedAt: new Date(0).toISOString(),
    estimatedCost: 0,
    attemptLedger: [],
    candidates: [],
  };
}

async function persistManifest(
  manifest: ReviewBatchManifest,
  candidates: ReviewCandidate[],
  attemptLedger: GenerationAttempt[],
) {
  const next: ReviewBatchManifest = {
    ...manifest,
    updatedAt: new Date().toISOString(),
    estimatedCost: attemptLedger.reduce((total, attempt) => total + attempt.cost, 0),
    attemptLedger,
    candidates,
  };
  await writeReviewBatchManifest(BATCH_01_ID, next);
  return next;
}

export async function generateBatch01Candidate(
  assetId: string,
  objectiveFailureReason?: ObjectiveFailureReason,
  provider: ImageProvider = defaultImageProvider,
): Promise<ReviewCandidate> {
  const definition = BATCH_01_PROMPTS.find((asset) => asset.assetId === assetId);
  if (!definition) throw new Error(`Unknown Batch 01 asset: ${assetId}`);

  const releaseLock = await acquireReviewBatchGenerationLock(BATCH_01_ID);
  try {
    const manifest = await getBatch01Manifest();
    const previous = manifest.candidates.find((candidate) => candidate.assetId === assetId);
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
    await persistManifest(manifest, manifest.candidates, attemptLedger);

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
      await persistManifest(manifest, manifest.candidates, attemptLedger);

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
      ].sort((a, b) =>
        BATCH_01_ASSETS.findIndex((item) => item.assetId === a.assetId)
        - BATCH_01_ASSETS.findIndex((item) => item.assetId === b.assetId),
      );
      attempt = { ...attempt, status: "stored", completedAt: generatedAt };
      attemptLedger = attemptLedger.map((item) =>
        item.assetId === assetId && item.attempt === attempts ? attempt : item
      );
      await persistManifest(manifest, candidates, attemptLedger);
      return candidate;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      attempt = { ...attempt, status: "failed", completedAt: new Date().toISOString(), error: reason };
      attemptLedger = attemptLedger.map((item) =>
        item.assetId === assetId && item.attempt === attempts ? attempt : item
      );
      await persistManifest(manifest, manifest.candidates, attemptLedger);
      throw error;
    }
  } finally {
    await releaseLock();
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