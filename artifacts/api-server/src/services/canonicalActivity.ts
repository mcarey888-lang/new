import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  canonicalActivities,
  canonicalActivityConflicts,
  canonicalActivityEvidence,
  canonicalActivityLinks,
} from "@workspace/db/schema";
import type {
  CanonicalActivityLinkInput,
  PersistedCanonicalEvidenceState,
  PersistedCanonicalEvidenceType,
} from "./canonicalActivityContracts";

export type ActivityContext = "training" | "expedition" | "free_hike" | "mountain_simulation";
export type ActivityLifecycle =
  | "recording"
  | "completed_local"
  | "pending_sync"
  | "synced"
  | "sync_failed"
  | "corrected"
  | "deleted";
export type ActivityEvidenceState = PersistedCanonicalEvidenceState;
export type ActivityVisibility = "private" | "unlisted" | "public_summary";

export interface CanonicalActivityInput {
  ownerUserId: string;
  sourceType: string;
  sourceId: string;
  sourceVersion?: string;
  primaryContext: ActivityContext;
  activityKind: string;
  occurredAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  distanceKm?: number;
  recordedAscentM?: number;
  validatedAscentM?: number;
  descentM?: number;
  lifecycle?: ActivityLifecycle;
  evidenceState?: ActivityEvidenceState;
  visibility?: ActivityVisibility;
  sourceSnapshot?: Record<string, unknown>;
  evidence?: Array<{
    evidenceType: PersistedCanonicalEvidenceType;
    payload: unknown;
    capturedAt?: Date;
  }>;
  links?: CanonicalActivityLinkInput[];
}

export type CanonicalActivityIngestionResult =
  | { status: "created"; activity: typeof canonicalActivities.$inferSelect }
  | { status: "deduplicated"; activity: typeof canonicalActivities.$inferSelect }
  | { status: "conflict"; activity: typeof canonicalActivities.$inferSelect };

type DbClient = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, normalizeForHash(child)]),
    );
  }
  return value;
}

export function canonicalActivityPayloadHash(input: CanonicalActivityInput): string {
  const payload = {
    sourceVersion: input.sourceVersion ?? null,
    primaryContext: input.primaryContext,
    activityKind: input.activityKind,
    occurredAt: input.occurredAt.toISOString(),
    startedAt: input.startedAt?.toISOString() ?? null,
    endedAt: input.endedAt?.toISOString() ?? null,
    durationSeconds: input.durationSeconds ?? null,
    distanceKm: input.distanceKm ?? null,
    recordedAscentM: input.recordedAscentM ?? null,
    validatedAscentM: input.validatedAscentM ?? null,
    descentM: input.descentM ?? null,
    lifecycle: input.lifecycle ?? "synced",
    evidenceState: input.evidenceState ?? "recorded_unverified",
    visibility: input.visibility ?? "private",
    sourceSnapshot: input.sourceSnapshot ?? {},
    evidence: input.evidence ?? [],
    links: input.links ?? [],
  };
  return createHash("sha256").update(JSON.stringify(normalizeForHash(payload))).digest("hex");
}

export function canonicalActivityBridgeEnabled(): boolean {
  return process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED !== "false";
}

export async function ingestCanonicalActivityWithClient(
  client: DbClient,
  input: CanonicalActivityInput,
): Promise<CanonicalActivityIngestionResult> {
  const payloadHash = canonicalActivityPayloadHash(input);
  const [inserted] = await client.insert(canonicalActivities).values({
    ownerUserId: input.ownerUserId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceVersion: input.sourceVersion ?? null,
    sourcePayloadHash: payloadHash,
    sourceSnapshot: input.sourceSnapshot ?? {},
    primaryContext: input.primaryContext,
    activityKind: input.activityKind,
    occurredAt: input.occurredAt,
    startedAt: input.startedAt ?? null,
    endedAt: input.endedAt ?? null,
    durationSeconds: input.durationSeconds ?? null,
    distanceKm: input.distanceKm ?? null,
    recordedAscentM: input.recordedAscentM ?? null,
    validatedAscentM: input.validatedAscentM ?? null,
    descentM: input.descentM ?? null,
    lifecycle: input.lifecycle ?? "synced",
    evidenceState: input.evidenceState ?? "recorded_unverified",
    visibility: input.visibility ?? "private",
  }).onConflictDoNothing({
    target: [
      canonicalActivities.ownerUserId,
      canonicalActivities.sourceType,
      canonicalActivities.sourceId,
    ],
  }).returning();

  if (inserted) {
    if (input.evidence?.length) {
      await client.insert(canonicalActivityEvidence).values(input.evidence.map((evidence) => ({
        activityId: inserted.id,
        ownerUserId: input.ownerUserId,
        evidenceType: evidence.evidenceType,
        payload: evidence.payload,
        visibility: "private",
        capturedAt: evidence.capturedAt ?? null,
      })));
    }
    if (input.links?.length) {
      await client.insert(canonicalActivityLinks).values(input.links.map((link) => ({
        activityId: inserted.id,
        ownerUserId: input.ownerUserId,
        linkType: link.linkType,
        targetId: link.targetId,
        metadata: link.metadata ?? {},
      }))).onConflictDoNothing();
    }
    return { status: "created", activity: inserted };
  }

  const [existing] = await client.select().from(canonicalActivities).where(and(
    eq(canonicalActivities.ownerUserId, input.ownerUserId),
    eq(canonicalActivities.sourceType, input.sourceType),
    eq(canonicalActivities.sourceId, input.sourceId),
  )).limit(1);

  if (!existing) {
    throw new Error("Canonical activity idempotent insert did not resolve");
  }
  if (existing.sourcePayloadHash === payloadHash) {
    return { status: "deduplicated", activity: existing };
  }

  await client.insert(canonicalActivityConflicts).values({
    activityId: existing.id,
    ownerUserId: input.ownerUserId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    existingPayloadHash: existing.sourcePayloadHash,
    incomingPayloadHash: payloadHash,
    conflictType: "payload_conflict",
  });
  return { status: "conflict", activity: existing };
}

export async function ingestCanonicalActivity(
  input: CanonicalActivityInput,
): Promise<CanonicalActivityIngestionResult> {
  return db.transaction((tx) => ingestCanonicalActivityWithClient(tx, input));
}