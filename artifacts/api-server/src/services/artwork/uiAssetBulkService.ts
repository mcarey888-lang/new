import crypto from "node:crypto";
import {
  acquireReviewBatchGenerationLock,
  readReviewBatchManifest,
  writeReviewBatchManifest,
  type ReviewBatchGenerationLock,
} from "./artworkStorage.js";
import {
  createUiAssetCandidates,
  getUiAssetManifest,
  listUiAssetBulkTargets,
} from "./uiAssetWorkflowService.js";
import { logger } from "../../lib/logger.js";

const BULK_ID = "ui-asset-bulk-generation";
const CANDIDATES_PER_ASSET = 4;

export type UiAssetBulkJob = {
  id: string;
  status: "RUNNING" | "COMPLETE" | "FAILED" | "INTERRUPTED";
  assetKeys: string[];
  completedKeys: string[];
  currentAssetKey?: string;
  historyIds: Record<string, string>;
  overrideFamilyWarning: boolean;
  startedAt: string;
  updatedAt: string;
  error?: string;
};

let activeRunner: Promise<void> | null = null;
let nextRecoveryCheck = 0;

async function readJob() {
  return readReviewBatchManifest<UiAssetBulkJob>(BULK_ID);
}

async function saveJob(job: UiAssetBulkJob, generation: number) {
  job.updatedAt = new Date().toISOString();
  return writeReviewBatchManifest(BULK_ID, job, generation);
}

async function runJob(job: UiAssetBulkJob, initialGeneration: number, lock: ReviewBatchGenerationLock) {
  let generation = initialGeneration;
  try {
    for (const assetKey of job.assetKeys) {
      if (job.completedKeys.includes(assetKey)) continue;
      job.currentAssetKey = assetKey;
      await lock.assertOwned();
      generation = await saveJob(job, generation);
      await createUiAssetCandidates({
        assetKey,
        candidateCount: CANDIDATES_PER_ASSET,
        confirmed: true,
        overrideFamilyWarning: job.overrideFamilyWarning,
      }, undefined, {
        onStarted: (historyId) => { job.historyIds[assetKey] = historyId; },
      });
      job.completedKeys.push(assetKey);
      job.currentAssetKey = undefined;
      await lock.assertOwned();
      generation = await saveJob(job, generation);
    }
    job.status = "COMPLETE";
    await lock.assertOwned();
    await saveJob(job, generation);
  } catch (error) {
    job.status = "FAILED";
    job.error = error instanceof Error ? error.message : "Bulk generation failed";
    try {
      await lock.assertOwned();
      await saveJob(job, generation);
    } catch (saveError) {
      logger.error({ err: saveError, jobId: job.id }, "Could not record bulk artwork failure");
    }
    logger.error({ err: error, jobId: job.id, assetKey: job.currentAssetKey }, "UI artwork bulk generation stopped");
  } finally {
    await lock.release();
  }
}

function launch(job: UiAssetBulkJob, generation: number, lock: ReviewBatchGenerationLock) {
  const runner = runJob(job, generation, lock);
  activeRunner = runner;
  void runner.then(
    () => { if (activeRunner === runner) activeRunner = null; },
    (error) => {
      if (activeRunner === runner) activeRunner = null;
      logger.error({ err: error, jobId: job.id }, "Bulk artwork runner stopped unexpectedly");
    },
  );
}

export async function startUiAssetBulkJob(confirmed: boolean, overrideFamilyWarning: boolean) {
  if (!confirmed) throw new Error("Explicit confirmation is required to generate 136 images");
  const assetKeys = await listUiAssetBulkTargets();
  const manifest = await getUiAssetManifest();
  if (manifest.history.some((entry) => entry.outcome === "GENERATING")) {
    throw new Error("Another UI asset generation is in progress. Wait for it to finish before starting the batch.");
  }
  const missingMasters = manifest.families
    .filter((family) => (family.familyId === "RANKS" || family.familyId === "ACHIEVEMENTS") && !family.masterReferenceAsset)
    .map((family) => family.displayName);
  if (missingMasters.length && !overrideFamilyWarning) {
    throw new Error(`Approve a family master for ${missingMasters.join(" and ")} or acknowledge the missing-master warning`);
  }
  const lock = await acquireReviewBatchGenerationLock(BULK_ID);
  try {
    const existing = await readJob();
    if (existing) {
      throw new Error(`A bulk run already exists (${existing.value.status}). Repeated submissions cannot spend on duplicate images.`);
    }
    const now = new Date().toISOString();
    const job: UiAssetBulkJob = {
      id: crypto.randomUUID(),
      status: "RUNNING",
      assetKeys,
      completedKeys: [],
      historyIds: {},
      overrideFamilyWarning,
      startedAt: now,
      updatedAt: now,
    };
    const generation = await saveJob(job, 0);
    launch(job, generation, lock);
    return job;
  } catch (error) {
    await lock.release();
    throw error;
  }
}

export async function getUiAssetBulkJob() {
  const stored = await readJob();
  if (!stored) return null;
  if (stored.value.status !== "RUNNING" || activeRunner || Date.now() < nextRecoveryCheck) return stored.value;

  // After a process restart, never silently retry an item that might already
  // have incurred provider spend. Recover completed items, otherwise stop.
  nextRecoveryCheck = Date.now() + 30_000;
  let lock: ReviewBatchGenerationLock;
  try {
    lock = await acquireReviewBatchGenerationLock(BULK_ID);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already has a generation in progress")) return stored.value;
    throw error;
  }
  try {
    const current = await readJob();
    if (!current || current.value.status !== "RUNNING") return current?.value ?? null;
    const job = current.value;
    if (job.currentAssetKey) {
      const manifest = await getUiAssetManifest();
      const historyId = job.historyIds[job.currentAssetKey];
      const finished = historyId && manifest.history.find((entry) =>
        entry.id === historyId && entry.outcome === "DRAFT_CANDIDATES" &&
        entry.resultCandidateIds.length === CANDIDATES_PER_ASSET);
      if (!finished) {
        job.status = "INTERRUPTED";
        job.error = `Generation was interrupted at ${job.currentAssetKey}. Review History before retrying; no automatic duplicate generation was started.`;
        await saveJob(job, current.generation);
        return job;
      }
      job.completedKeys.push(job.currentAssetKey);
      job.currentAssetKey = undefined;
      current.generation = await saveJob(job, current.generation);
    }
    launch(job, current.generation, lock);
    return job;
  } finally {
    if (!activeRunner) await lock.release();
  }
}