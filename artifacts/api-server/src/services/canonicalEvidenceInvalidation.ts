import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  canonicalActivities, canonicalActivityEvidence, canonicalActivityQualifications,
  expeditionRuns, expeditionStageContributions, personalElevationCreditEvents,
} from "@workspace/db/schema";
import {
  assertStage2LedgerWritesAvailable, writePersonalElevationCreditWithClient,
  writeExpeditionStageContributionWithClient,
} from "./stage2Ledgers";
import type { ElevationLedgerEvidenceClass } from "./stage2LedgerPlanning";

/**
 * Internal, development-only invalidation of previously credited evidence.
 * NOT an upload endpoint, GPS estimator, or authority to award replacement credit.
 * Nonzero historical recalculation and completed-run award reversal need review.
 */
export type ReviewedEvidenceInvalidation = {
  ownerUserId: string;
  activityId: string;
  correctionId: string;
  expectedSourcePayloadHash: string;
  reviewedBy: string;
  reason: string;
  authorityAt: Date;
};

export async function invalidateCanonicalActivityEvidence(input: ReviewedEvidenceInvalidation) {
  assertStage2LedgerWritesAvailable();
  if (!input.correctionId.trim() || !input.reviewedBy.trim() || !input.reason.trim()
      || !Number.isFinite(input.authorityAt.getTime()))
    throw new Error("A reviewed correction identity, reason and authority time are required");
  return db.transaction(async tx => {
    const [activity] = await tx.select().from(canonicalActivities).where(and(
      eq(canonicalActivities.id, input.activityId),
      eq(canonicalActivities.ownerUserId, input.ownerUserId),
    )).for("update");
    if (!activity || activity.lifecycle === "deleted")
      throw new Error("Activity unavailable to this owner");
    if (activity.sourcePayloadHash !== input.expectedSourcePayloadHash)
      throw new Error("Activity evidence identity changed");

    const journal = await tx.select().from(canonicalActivityEvidence).where(and(
      eq(canonicalActivityEvidence.activityId, activity.id),
      eq(canonicalActivityEvidence.ownerUserId, input.ownerUserId),
      eq(canonicalActivityEvidence.evidenceType, "source_snapshot"),
      sql`${canonicalActivityEvidence.payload}->>'kind' = 'reviewed_evidence_invalidation'`,
    ));
    const matching = journal.find(row =>
      (row.payload as Record<string, unknown>).correctionId === input.correctionId);
    if (matching) {
      const payload = matching.payload as Record<string, unknown>;
      if (payload.reason !== input.reason || payload.reviewedBy !== input.reviewedBy
          || payload.authorityAt !== input.authorityAt.toISOString())
        throw new Error("Correction identity was reused with different contents");
      return { status: "deduplicated" as const, correctionId: input.correctionId };
    }
    if (journal.some(row => row.capturedAt && row.capturedAt >= input.authorityAt))
      throw new Error("Correction authority is stale");

    const qualifications = await tx.select().from(canonicalActivityQualifications)
      .where(and(eq(canonicalActivityQualifications.activityId, activity.id),
        eq(canonicalActivityQualifications.ownerUserId, input.ownerUserId)));
    const credits = await tx.select().from(personalElevationCreditEvents).where(and(
      eq(personalElevationCreditEvents.ownerUserId, input.ownerUserId),
      eq(personalElevationCreditEvents.activityId, activity.id),
    )).orderBy(desc(personalElevationCreditEvents.revision));
    const contributions = await tx.select().from(expeditionStageContributions).where(and(
      eq(expeditionStageContributions.ownerUserId, input.ownerUserId),
      eq(expeditionStageContributions.activityId, activity.id),
    )).orderBy(desc(expeditionStageContributions.revision));
    const latestCredits = new Map<string, typeof credits[number]>();
    for (const row of credits) if (!latestCredits.has(row.ruleVersion)) latestCredits.set(row.ruleVersion, row);
    const latestStages = new Map<string, typeof contributions[number]>();
    for (const row of contributions) {
      const key = JSON.stringify([row.runId, row.stageKey, row.ruleVersion, row.scoreVersion]);
      if (!latestStages.has(key)) latestStages.set(key, row);
    }
    // Acquire each run lock before writing. Completed awards are deliberately
    // not reset behind the mountain/cinematic completion authority.
    const runs = new Map<string, typeof expeditionRuns.$inferSelect>();
    for (const runId of [...new Set([...latestStages.values()].map(row => row.runId))].sort()) {
      const [run] = await tx.select().from(expeditionRuns).where(and(
        eq(expeditionRuns.id, runId), eq(expeditionRuns.ownerUserId, input.ownerUserId),
      )).for("update");
      if (!run || run.status !== "active")
        throw new Error("Completed or inactive expedition correction requires separate award review");
      runs.set(runId, run);
    }
    if ([...latestCredits.values()].some(row => row.effectiveAt > input.authorityAt))
      throw new Error("Correction predates existing credit authority");

    for (const row of latestCredits.values()) {
      if (row.status === "revoked") continue;
      const result = await writePersonalElevationCreditWithClient(tx, {
        ownerUserId: input.ownerUserId, activityId: activity.id,
        evidenceClass: row.evidenceClass as ElevationLedgerEvidenceClass,
        creditedAscentM: 0, ruleVersion: row.ruleVersion,
        effectiveAt: input.authorityAt, revocation: true,
      });
      if (result.status === "rejected") throw new Error(result.reason);
    }
    for (const row of latestStages.values()) {
      if (row.status === "revoked") continue;
      const result = await writeExpeditionStageContributionWithClient(tx, {
        ownerUserId: input.ownerUserId, activityId: activity.id,
        runId: row.runId, expeditionId: runs.get(row.runId)!.expeditionId,
        // The old persisted contribution is authority to revoke that exact
        // lineage only. This rule cannot accept a new contribution or summit.
        stageRule: {
          stageKey: row.stageKey, ruleVersion: row.ruleVersion, scoreVersion: row.scoreVersion,
          allowedActivityKinds: [activity.activityKind], allowedEvidenceClasses: ["recorded_unverified"],
        },
        activityKind: activity.activityKind, evidenceClass: "recorded_unverified",
        acceptedMetric: 0, acceptedElevationM: 0, revocation: true,
      });
      if (result.status === "rejected") throw new Error(result.reason);
    }
    await tx.update(canonicalActivityQualifications).set({
      status: "revoked", creditedMetric: null,
    }).where(and(
      eq(canonicalActivityQualifications.activityId, activity.id),
      eq(canonicalActivityQualifications.ownerUserId, input.ownerUserId),
      ne(canonicalActivityQualifications.purpose, "personal_history"),
    ));
    await tx.insert(canonicalActivityEvidence).values({
      activityId: activity.id, ownerUserId: input.ownerUserId,
      evidenceType: "source_snapshot", visibility: "private", capturedAt: input.authorityAt,
      payload: {
        kind: "reviewed_evidence_invalidation", correctionId: input.correctionId,
        reviewedBy: input.reviewedBy, reason: input.reason, authorityAt: input.authorityAt.toISOString(),
        priorProjection: { lifecycle: activity.lifecycle, validatedAscentM: activity.validatedAscentM,
          evidenceState: activity.evidenceState },
        priorQualifications: qualifications,
        priorCreditIds: [...latestCredits.values()].map(row => row.id),
        priorContributionIds: [...latestStages.values()].map(row => row.id),
      },
    });
    await tx.update(canonicalActivities).set({
      lifecycle: "corrected", validatedAscentM: 0,
    }).where(and(eq(canonicalActivities.id, activity.id), eq(canonicalActivities.ownerUserId, input.ownerUserId)));
    // Original GPS, source snapshot/hash, recorded totals, links and history stay.
    return { status: "invalidated" as const, correctionId: input.correctionId };
  });
}
