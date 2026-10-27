import { db, signatureChallenges } from "@workspace/db";
import { and, asc, eq, getTableColumns, gt, inArray, sql } from "drizzle-orm";
import { acquireSignatureArtworkLock, copyApprovedSignatureArtwork, servingPath } from "./artworkStorage.js";

export class ExpeditionArtworkError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type ArtworkRow = typeof signatureChallenges.$inferSelect;

export function reusableSignatureArtwork(row: Pick<ArtworkRow,
  "challengeId" | "approved" | "imageStatus" | "imageVersion" | "heroImage" | "cardImage" | "thumbnailImage">) {
  return row.approved === true && row.imageStatus === "approved"
    && Number.isInteger(row.imageVersion) && (row.imageVersion ?? 0) > 0
    && row.heroImage === servingPath(row.challengeId, "hero")
    && row.cardImage === servingPath(row.challengeId, "card")
    && row.thumbnailImage === servingPath(row.challengeId, "thumbnail");
}

export async function approvedSignatureArtworkLibrary() {
  const rows = await db.select().from(signatureChallenges)
    .where(and(eq(signatureChallenges.approved, true), eq(signatureChallenges.imageStatus, "approved"),
      gt(signatureChallenges.imageVersion, 0))).orderBy(asc(signatureChallenges.challengeName));
  return { items: rows.filter(reusableSignatureArtwork).map(row => {
    const url = (crop: "hero" | "card" | "thumbnail") =>
      `${servingPath(row.challengeId, crop)}?approved=1&v=${row.imageVersion}`;
    return {
      challengeId: row.challengeId, challengeName: row.challengeName,
      targetMountainName: row.targetMountainName, imageVersion: row.imageVersion!,
      heroUrl: url("hero"), cardUrl: url("card"), thumbnailUrl: url("thumbnail"),
    };
  }) };
}

export type ArtworkAssignment = {
  sourceChallengeId: string; sourceImageVersion: number;
  expectedUpdatedAt: string; replaceExisting?: boolean;
};

export async function assignApprovedSignatureArtwork(targetId: string, input: ArtworkAssignment) {
  if (targetId === input.sourceChallengeId) throw new ExpeditionArtworkError(400, "Choose artwork from another expedition.");
  const lock = await acquireSignatureArtworkLock(targetId);
  let copied: Awaited<ReturnType<typeof copyApprovedSignatureArtwork>> | undefined;
  let publishingStarted = false;
  try {
    const result = await db.transaction(async tx => {
      // Lock in stable order, including the source approval, through copying.
      const rows = await tx.select({
        ...getTableColumns(signatureChallenges),
        updatedAtText: sql<string>`${signatureChallenges.updatedAt}::text`,
      }).from(signatureChallenges).where(inArray(signatureChallenges.challengeId, [targetId, input.sourceChallengeId]))
        .orderBy(asc(signatureChallenges.challengeId)).for("update");
      const target = rows.find(row => row.challengeId === targetId);
      const source = rows.find(row => row.challengeId === input.sourceChallengeId);
      if (!target || !source) throw new ExpeditionArtworkError(404, "Expedition or source artwork not found.");
      if (target.updatedAtText !== input.expectedUpdatedAt) throw new ExpeditionArtworkError(409, "This expedition changed. Reload before assigning artwork.");
      if (target.imageStatus === "generating") throw new ExpeditionArtworkError(409, "Artwork is generating. Wait for it to finish.");
      if (!reusableSignatureArtwork(source) || source.imageVersion !== input.sourceImageVersion) {
        throw new ExpeditionArtworkError(409, "The source artwork changed or is no longer approved. Refresh the library.");
      }
      if ((target.heroImage || (target.imageVersion ?? 0) > 0) && !input.replaceExisting) {
        throw new ExpeditionArtworkError(409, "Confirm replacement of the existing expedition artwork.");
      }
      const version = (target.imageVersion ?? 0) + 1;
      if (version > 32767) throw new ExpeditionArtworkError(409, "Artwork version limit reached.");
      await lock.assertOwned();
      copied = await copyApprovedSignatureArtwork(source.challengeId, source.imageVersion!, targetId, version);
      await lock.assertOwned();
      publishingStarted = true;
      await tx.update(signatureChallenges).set({
        heroImage: servingPath(targetId, "hero"), cardImage: servingPath(targetId, "card"),
        thumbnailImage: servingPath(targetId, "thumbnail"),
        imageVersion: version, approved: true, imageStatus: "approved",
        imagePrompt: JSON.stringify({ type: "approved_signature_reuse", sourceChallengeId: source.challengeId,
          sourceImageVersion: source.imageVersion, sourcePrompt: source.imagePrompt }),
        provider: "reused-approved-signature", generationCost: 0,
        generatedAt: source.generatedAt ?? new Date(), lastGenerated: new Date(),
        updatedAt: sql`clock_timestamp()`,
      }).where(eq(signatureChallenges.challengeId, targetId));
      return { assigned: true, sourceChallengeId: source.challengeId,
        sourceImageVersion: source.imageVersion!, imageVersion: version };
    });
    return result;
  } catch (error) {
    // A commit acknowledgement can fail after PostgreSQL committed. Never
    // delete bytes that an approved record might already reference. Orphans
    // are safer than missing images when the outcome is uncertain.
    if (copied && !publishingStarted) {
      await copied.cleanup().catch(cleanupError => console.warn("Unreferenced artwork cleanup failed", cleanupError));
    }
    throw error;
  } finally {
    await lock.release();
  }
}
