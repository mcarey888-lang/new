/**
 * Artwork Service
 * ───────────────
 * Orchestrates the full artwork generation pipeline:
 *
 *   challenge + stages
 *     → buildExpeditionPrompt()
 *     → ImageProvider.generate()
 *     → cropMasterImage()
 *     → uploadArtwork()
 *     → DB update
 *
 * Handles stale-detection (prompt hash), cost tracking, and per-challenge
 * error isolation for bulk generation.
 */

import { db, signatureChallenges, challengeStages } from "@workspace/db";
import { eq, and, isNull, or, ne } from "drizzle-orm";
import { buildExpeditionPrompt } from "./promptBuilder.js";
import { defaultImageProvider, type ImageProvider } from "./imageProvider.js";
import { cropMasterImage } from "./cropService.js";
import { uploadArtwork, deleteArtwork } from "./artworkStorage.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GenerateResult {
  challengeId: string;
  status: "generated" | "skipped" | "failed";
  reason?: string;
  prompt?: string;
  heroPath?: string;
}

export interface BulkResult {
  succeeded: GenerateResult[];
  failed:    GenerateResult[];
  skipped:   GenerateResult[];
  total:     number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchChallengeWithStages(challengeId: string) {
  const rows = await db
    .select()
    .from(signatureChallenges)
    .where(eq(signatureChallenges.challengeId, challengeId))
    .limit(1);

  if (rows.length === 0) return null;

  const challenge = rows[0];
  const stages = await db
    .select()
    .from(challengeStages)
    .where(eq(challengeStages.challengeId, challengeId))
    .orderBy(challengeStages.stageOrder);

  return { challenge, stages };
}

// ── Core generation ───────────────────────────────────────────────────────────

/**
 * Generate (or regenerate) artwork for a single challenge.
 *
 * @param challengeId  The SIG### challenge identifier
 * @param force        Regenerate even if the prompt hasn't changed
 * @param provider     Override the default provider (for testing)
 */
export async function generateChallengeArtwork(
  challengeId: string,
  force = false,
  provider: ImageProvider = defaultImageProvider,
): Promise<GenerateResult> {
  // 1. Fetch challenge + stages
  const data = await fetchChallengeWithStages(challengeId);
  if (!data) {
    return { challengeId, status: "failed", reason: "Challenge not found" };
  }
  const { challenge, stages } = data;

  // 2. Build prompt + hash
  const { prompt, hash } = buildExpeditionPrompt(challenge, stages);

  // 3. Stale check — skip if prompt text unchanged and image is approved
  if (
    !force &&
    challenge.approved &&
    challenge.imagePrompt === prompt &&
    challenge.imageStatus === "approved"
  ) {
    return { challengeId, status: "skipped", reason: "Approved image still current" };
  }

  // 4. Mark as generating
  await db
    .update(signatureChallenges)
    .set({ imageStatus: "generating", updatedAt: new Date() })
    .where(eq(signatureChallenges.challengeId, challengeId));

  try {
    // 5. Generate master image
    const { buffer: masterBuffer, provider: providerName, cost } = await provider.generate(prompt);

    // 6. Crop into hero / card / thumbnail
    const crops = await cropMasterImage(masterBuffer);

    // 7. Determine version
    const nextVersion = (challenge.imageVersion ?? 0) + 1;

    // 8. Upload to object storage
    const stored = await uploadArtwork(challengeId, nextVersion, crops);

    // 9. Write URLs + metadata back to DB
    const now = new Date();
    await db
      .update(signatureChallenges)
      .set({
        heroImage:      stored.heroPath,
        cardImage:      stored.cardPath,
        thumbnailImage: stored.thumbnailPath,
        imagePrompt:    prompt,
        imageVersion:   nextVersion,
        imageStatus:    "generated",
        approved:       false,  // always requires re-approval after regeneration
        generatedAt:    now,
        lastGenerated:  now,
        provider:       providerName,
        generationCost: cost,
        updatedAt:      now,
      })
      .where(eq(signatureChallenges.challengeId, challengeId));

    return {
      challengeId,
      status: "generated",
      prompt,
      heroPath: stored.heroPath,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[artwork] generation failed for ${challengeId}:`, err);

    // Mark as failed so the admin panel shows the error state
    await db
      .update(signatureChallenges)
      .set({ imageStatus: "failed", updatedAt: new Date() })
      .where(eq(signatureChallenges.challengeId, challengeId));

    return { challengeId, status: "failed", reason };
  }
}

// ── Approve / reject ──────────────────────────────────────────────────────────

export async function approveChallengeArtwork(challengeId: string): Promise<void> {
  await db
    .update(signatureChallenges)
    .set({ approved: true, imageStatus: "approved", updatedAt: new Date() })
    .where(eq(signatureChallenges.challengeId, challengeId));
}

export async function rejectChallengeArtwork(challengeId: string): Promise<void> {
  await db
    .update(signatureChallenges)
    .set({ approved: false, imageStatus: "rejected", updatedAt: new Date() })
    .where(eq(signatureChallenges.challengeId, challengeId));
}

// ── Clear artwork ─────────────────────────────────────────────────────────────

export async function clearChallengeArtwork(challengeId: string): Promise<void> {
  await deleteArtwork(challengeId);
  await db
    .update(signatureChallenges)
    .set({
      heroImage:      null,
      cardImage:      null,
      thumbnailImage: null,
      imagePrompt:    null,
      imageVersion:   0,
      imageStatus:    "pending",
      approved:       false,
      generatedAt:    null,
      lastGenerated:  null,
      provider:       null,
      generationCost: null,
      updatedAt:      new Date(),
    })
    .where(eq(signatureChallenges.challengeId, challengeId));
}

// ── Bulk generation ───────────────────────────────────────────────────────────

/** Inter-request delay (ms) to respect the 15 req/min AI rate limit */
const BULK_DELAY_MS = 4_500;

/**
 * Generate artwork for every active challenge that doesn't have an approved
 * image (or where the prompt has changed).
 *
 * Runs sequentially with a delay between items so we stay within rate limits.
 * Errors on individual challenges are isolated — the bulk run continues.
 *
 * @param onProgress  Optional callback after each item (for SSE streaming)
 * @param force       Regenerate all, even approved images
 */
export async function bulkGenerateArtwork(
  onProgress?: (result: GenerateResult, index: number, total: number) => void,
  force = false,
  provider: ImageProvider = defaultImageProvider,
): Promise<BulkResult> {
  const allChallenges = await db
    .select({ challengeId: signatureChallenges.challengeId })
    .from(signatureChallenges)
    .where(eq(signatureChallenges.status, "active"))
    .orderBy(signatureChallenges.challengeId);

  const total = allChallenges.length;
  const succeeded: GenerateResult[] = [];
  const failed:    GenerateResult[] = [];
  const skipped:   GenerateResult[] = [];

  for (let i = 0; i < allChallenges.length; i++) {
    const { challengeId } = allChallenges[i];

    const result = await generateChallengeArtwork(challengeId, force, provider);

    if (result.status === "generated") succeeded.push(result);
    else if (result.status === "failed")  failed.push(result);
    else                                  skipped.push(result);

    onProgress?.(result, i + 1, total);

    // Rate-limit delay (skip after last item)
    if (i < allChallenges.length - 1) {
      await new Promise((r) => setTimeout(r, BULK_DELAY_MS));
    }
  }

  return { succeeded, failed, skipped, total };
}

// ── Status query ──────────────────────────────────────────────────────────────

export async function getArtworkStatus() {
  return db
    .select({
      challengeId:        signatureChallenges.challengeId,
      challengeName:      signatureChallenges.challengeName,
      targetMountainName: signatureChallenges.targetMountainName,
      regions:            signatureChallenges.regions,
      difficulty:         signatureChallenges.difficulty,
      adventureScore:     signatureChallenges.adventureScore,
      heroImage:          signatureChallenges.heroImage,
      cardImage:          signatureChallenges.cardImage,
      thumbnailImage:     signatureChallenges.thumbnailImage,
      imagePrompt:        signatureChallenges.imagePrompt,
      imageVersion:       signatureChallenges.imageVersion,
      imageStatus:        signatureChallenges.imageStatus,
      approved:           signatureChallenges.approved,
      generatedAt:        signatureChallenges.generatedAt,
      provider:           signatureChallenges.provider,
      generationCost:     signatureChallenges.generationCost,
      lastGenerated:      signatureChallenges.lastGenerated,
    })
    .from(signatureChallenges)
    .where(eq(signatureChallenges.status, "active"))
    .orderBy(signatureChallenges.challengeId);
}
