import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  expeditionRuns,
  expeditionStageContributions,
  expeditionContributionCorrections,
  personalElevationCreditCorrections,
  personalElevationCreditEvents,
} from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import {
  planExpeditionStageContribution,
  planPersonalElevationCredit,
  toPersistedElevationEvidenceClass,
  type ElevationCreditInput,
  type ExistingElevationCredit,
  type ExistingExpeditionContribution,
  type ExpeditionContributionInput,
} from "./stage2LedgerPlanning";

type DbClient = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export type PersonalElevationCreditWrite =
  | { status: "created"; event: typeof personalElevationCreditEvents.$inferSelect }
  | { status: "deduplicated"; event: typeof personalElevationCreditEvents.$inferSelect }
  | { status: "rejected"; reason: string };

export type LedgerTotals = {
  lifetimeAscentM: number;
  periodAscentM: number;
  creditedActivities: number;
};

export type ExpeditionRunInput = {
  ownerUserId: string;
  expeditionId: string;
  runKey: string;
  ruleVersion: string;
  scoreVersion: string;
};

export type ExpeditionContributionWrite =
  | { status: "created"; contribution: typeof expeditionStageContributions.$inferSelect }
  | { status: "deduplicated"; contribution: typeof expeditionStageContributions.$inferSelect }
  | { status: "rejected"; reason: string };

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === UNIQUE_VIOLATION,
  );
}

export type LedgerTransactionRunner = <T>(
  operation: (client: DbClient) => Promise<T>,
) => Promise<T>;

export async function withFreshTransactionRetry<T>(
  transaction: LedgerTransactionRunner,
  operation: (client: DbClient) => Promise<T>,
  retries = 1,
): Promise<T> {
  try {
    return await transaction(operation);
  } catch (error) {
    if (!isUniqueViolation(error) || retries <= 0) throw error;
    return withFreshTransactionRetry(transaction, operation, retries - 1);
  }
}

async function lockLedgerIdentity(client: DbClient, identity: string): Promise<void> {
  // Transaction-scoped advisory locks serialize first credit/revision selection
  // without changing the additive schema or holding a heavyweight table lock.
  await client.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${identity}, 0))`);
}

export function selectLatestEffectivePersonalElevationCredits(
  rows: readonly (typeof personalElevationCreditEvents.$inferSelect)[],
): (typeof personalElevationCreditEvents.$inferSelect)[] {
  const latest = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    const key = `${row.ownerUserId}\u001f${row.activityId}\u001f${row.ruleVersion}`;
    const current = latest.get(key);
    if (!current || row.revision > current.revision) latest.set(key, row);
  }
  return [...latest.values()];
}

export function calculatePersonalElevationTotalsFromEvents(
  rows: readonly (typeof personalElevationCreditEvents.$inferSelect)[],
  period?: { from?: Date; to?: Date },
): LedgerTotals {
  const credited = selectLatestEffectivePersonalElevationCredits(rows)
    .filter((row) => row.status === "credited" || row.status === "corrected");
  return {
    lifetimeAscentM: credited.reduce((sum, row) => sum + row.creditedAscentM, 0),
    periodAscentM: credited
      .filter((row) =>
        (!period?.from || row.effectiveAt >= period.from)
        && (!period?.to || row.effectiveAt <= period.to),
      )
      .reduce((sum, row) => sum + row.creditedAscentM, 0),
    creditedActivities: credited.length,
  };
}

export async function getLatestPersonalElevationCreditWithClient(
  client: DbClient,
  ownerUserId: string,
  activityId: string,
  ruleVersion: string,
) {
  const [event] = await client
    .select()
    .from(personalElevationCreditEvents)
    .where(and(
      eq(personalElevationCreditEvents.ownerUserId, ownerUserId),
      eq(personalElevationCreditEvents.activityId, activityId),
      eq(personalElevationCreditEvents.ruleVersion, ruleVersion),
    ))
    .orderBy(desc(personalElevationCreditEvents.revision))
    .limit(1);
  return event;
}

export async function writePersonalElevationCreditWithClient(
  client: DbClient,
  input: ElevationCreditInput,
): Promise<PersonalElevationCreditWrite> {
  await lockLedgerIdentity(
    client,
    `personal-elevation:${input.ownerUserId}:${input.activityId}:${input.ruleVersion}`,
  );
  const existingRows = await client
    .select()
    .from(personalElevationCreditEvents)
    .where(and(
      eq(personalElevationCreditEvents.ownerUserId, input.ownerUserId),
      eq(personalElevationCreditEvents.activityId, input.activityId),
      eq(personalElevationCreditEvents.ruleVersion, input.ruleVersion),
    ))
    .orderBy(desc(personalElevationCreditEvents.revision));
  const existing: ExistingElevationCredit[] = existingRows.map((row) => ({
    id: row.id,
    ownerUserId: row.ownerUserId,
    activityId: row.activityId,
    ruleVersion: row.ruleVersion,
    revision: row.revision,
    status: row.status as ExistingElevationCredit["status"],
  }));
  const plan = planPersonalElevationCredit(input, existing);
  if (plan.status === "rejected") return plan;
  const latest = existingRows[0];
  if (plan.status === "deduplicated" && latest) {
    return { status: "deduplicated", event: latest };
  }
  if (plan.status !== "create") {
    return { status: "rejected", reason: "Existing credit row could not be resolved" };
  }
  const evidenceClass = toPersistedElevationEvidenceClass(input.evidenceClass);
  if (!evidenceClass) {
    return { status: "rejected", reason: "evidence class is not eligible for personal elevation credit" };
  }
  const status = input.revocation ? "revoked" : input.correction ? "corrected" : "credited";
  const [event] = await client.insert(personalElevationCreditEvents).values({
    ownerUserId: input.ownerUserId,
    activityId: input.activityId,
    revision: plan.revision,
    status,
    creditedAscentM: input.creditedAscentM,
    evidenceClass,
    ruleVersion: input.ruleVersion,
    correctionOfRevision: plan.correctionOfRevision,
    effectiveAt: input.effectiveAt,
  }).returning();
  if (!event) throw new Error("Personal elevation credit insert did not return an event");
  if (latest) {
    await client.insert(personalElevationCreditCorrections).values({
      ownerUserId: input.ownerUserId,
      activityId: input.activityId,
      ruleVersion: input.ruleVersion,
      revision: plan.revision,
      priorRevision: latest.revision,
      eventId: event.id,
      priorEventId: latest.id,
    });
  }
  return { status: "created", event };
}

export async function writePersonalElevationCredit(
  input: ElevationCreditInput,
): Promise<PersonalElevationCreditWrite> {
  return withFreshTransactionRetry(
    (operation) => db.transaction(operation),
    (client) => writePersonalElevationCreditWithClient(client, input),
  );
}

export async function getPersonalElevationTotalsWithClient(
  client: DbClient,
  ownerUserId: string,
  period?: { from?: Date; to?: Date },
): Promise<LedgerTotals> {
  const rows = await client.select().from(personalElevationCreditEvents).where(
    eq(personalElevationCreditEvents.ownerUserId, ownerUserId),
  );
  return calculatePersonalElevationTotalsFromEvents(rows, period);
}

export async function getPersonalElevationCreditEventsWithClient(
  client: DbClient,
  ownerUserId: string,
) {
  return client.select().from(personalElevationCreditEvents).where(
    eq(personalElevationCreditEvents.ownerUserId, ownerUserId),
  );
}

export async function getPersonalElevationTotals(
  ownerUserId: string,
  period?: { from?: Date; to?: Date },
): Promise<LedgerTotals> {
  return db.transaction((tx) => getPersonalElevationTotalsWithClient(tx, ownerUserId, period));
}

export async function getOrCreateExpeditionRunWithClient(
  client: DbClient,
  input: ExpeditionRunInput,
) {
  if (!input.ownerUserId.trim() || !input.expeditionId.trim() || !input.runKey.trim()) {
    throw new Error("Expedition run owner, expedition, and run key are required");
  }
  await lockLedgerIdentity(client, `expedition-run:${input.ownerUserId}:${input.runKey}`);
  const [existing] = await client.select().from(expeditionRuns).where(and(
    eq(expeditionRuns.ownerUserId, input.ownerUserId),
    eq(expeditionRuns.runKey, input.runKey),
  )).limit(1);
  if (existing) return existing;
  const [created] = await client.insert(expeditionRuns).values(input).onConflictDoNothing().returning();
  if (created) return created;
  const [resolved] = await client.select().from(expeditionRuns).where(and(
    eq(expeditionRuns.ownerUserId, input.ownerUserId),
    eq(expeditionRuns.runKey, input.runKey),
  )).limit(1);
  if (!resolved) throw new Error("Expedition run idempotent insert did not resolve");
  return resolved;
}

export async function getOrCreateExpeditionRun(input: ExpeditionRunInput) {
  return db.transaction((tx) => getOrCreateExpeditionRunWithClient(tx, input));
}

export async function writeExpeditionStageContributionWithClient(
  client: DbClient,
  input: ExpeditionContributionInput,
): Promise<ExpeditionContributionWrite> {
  const run = await client.select().from(expeditionRuns).where(and(
    eq(expeditionRuns.id, input.runId),
    eq(expeditionRuns.ownerUserId, input.ownerUserId),
  )).limit(1);
  if (!run[0]) return { status: "rejected", reason: "Expedition run is not available to this owner" };
  if (!input.stageRule) return { status: "rejected", reason: "defined stage rule is required" };
  const identity = `expedition:${input.ownerUserId}:${input.runId}:${input.stageRule.stageKey}:${input.activityId}:${input.stageRule.ruleVersion}:${input.stageRule.scoreVersion}`;
  await lockLedgerIdentity(client, identity);
  const rows = await client.select().from(expeditionStageContributions).where(and(
    eq(expeditionStageContributions.ownerUserId, input.ownerUserId),
    eq(expeditionStageContributions.runId, input.runId),
    eq(expeditionStageContributions.activityId, input.activityId),
    eq(expeditionStageContributions.stageKey, input.stageRule.stageKey),
    eq(expeditionStageContributions.ruleVersion, input.stageRule.ruleVersion),
    eq(expeditionStageContributions.scoreVersion, input.stageRule.scoreVersion),
  )).orderBy(desc(expeditionStageContributions.revision));
  const existing: ExistingExpeditionContribution[] = rows.map((row) => ({
    id: row.id,
    ownerUserId: row.ownerUserId,
    runId: row.runId,
    activityId: row.activityId,
    stageKey: row.stageKey,
    ruleVersion: row.ruleVersion,
    scoreVersion: row.scoreVersion,
    revision: row.revision,
    status: row.status as ExistingExpeditionContribution["status"],
  }));
  const plan = planExpeditionStageContribution(input, existing);
  if (plan.status === "rejected") return plan;
  if (plan.status === "deduplicated" && rows[0]) return { status: "deduplicated", contribution: rows[0] };
  if (plan.status !== "create") {
    return { status: "rejected", reason: "Existing Expedition contribution could not be resolved" };
  }
  const [contribution] = await client.insert(expeditionStageContributions).values({
    ownerUserId: input.ownerUserId,
    runId: input.runId,
    stageKey: plan.stageKey,
    activityId: input.activityId,
    revision: plan.revision,
    status: plan.contributionStatus,
    acceptedMetric: plan.acceptedMetric,
    acceptedElevationM: plan.acceptedElevationM,
    ruleVersion: input.stageRule.ruleVersion,
    scoreVersion: input.stageRule.scoreVersion,
    simulatedCompletion: true,
    correctionOfRevision: plan.correctionOfRevision,
  }).returning();
  if (!contribution) throw new Error("Expedition contribution insert did not return a row");
  if (rows[0]) {
    await client.insert(expeditionContributionCorrections).values({
      ownerUserId: input.ownerUserId,
      runId: input.runId,
      stageKey: plan.stageKey,
      activityId: input.activityId,
      ruleVersion: input.stageRule.ruleVersion,
      scoreVersion: input.stageRule.scoreVersion,
      revision: plan.revision,
      priorRevision: rows[0].revision,
      contributionId: contribution.id,
      priorContributionId: rows[0].id,
    });
  }
  return { status: "created", contribution };
}

export async function writeExpeditionStageContribution(
  input: ExpeditionContributionInput,
): Promise<ExpeditionContributionWrite> {
  return withFreshTransactionRetry(
    (operation) => db.transaction(operation),
    (client) => writeExpeditionStageContributionWithClient(client, input),
  );
}