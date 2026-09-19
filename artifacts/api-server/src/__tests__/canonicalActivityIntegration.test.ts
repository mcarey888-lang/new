import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  canonicalActivities,
  canonicalActivityConflicts,
  canonicalActivityEvidence,
  canonicalActivityLinks,
} from "@workspace/db/schema";
import { ingestCanonicalActivity, type CanonicalActivityInput } from "../services/canonicalActivity";

const runIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "1";
const describeIntegration = runIntegration ? describe : describe.skip;
const createdIds: string[] = [];

function input(owner: string, sourceId: string, ascent = 640): CanonicalActivityInput {
  return {
    ownerUserId: owner,
    sourceType: "phase1_test",
    sourceId,
    sourceVersion: "1",
    primaryContext: "free_hike",
    activityKind: "outdoor_hike",
    occurredAt: new Date("2026-09-19T09:00:00.000Z"),
    durationSeconds: 10_800,
    distanceKm: 12,
    recordedAscentM: ascent,
    evidenceState: "recorded_unverified",
    visibility: "private",
    sourceSnapshot: { fixture: sourceId },
    evidence: [{ evidenceType: "gps_track", payload: [{ lat: 54.5, lon: -3.0 }] }],
    links: [{ linkType: "community_route", targetId: sourceId }],
  };
}

describeIntegration("canonical activity development database integration", () => {
  afterAll(async () => {
    if (!createdIds.length) return;
    await db.delete(canonicalActivityConflicts).where(inArray(canonicalActivityConflicts.activityId, createdIds));
    await db.delete(canonicalActivityEvidence).where(inArray(canonicalActivityEvidence.activityId, createdIds));
    await db.delete(canonicalActivityLinks).where(inArray(canonicalActivityLinks.activityId, createdIds));
    await db.delete(canonicalActivities).where(inArray(canonicalActivities.id, createdIds));
  });

  it("deduplicates concurrent identical submissions", async () => {
    const sourceId = `concurrent-${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 8 }, () => ingestCanonicalActivity(input("phase1_user_A", sourceId))),
    );
    createdIds.push(...new Set(results.map((result) => result.activity.id)));
    expect(new Set(results.map((result) => result.activity.id)).size).toBe(1);
    expect(results.filter((result) => result.status === "created")).toHaveLength(1);
    expect(results.filter((result) => result.status === "deduplicated")).toHaveLength(7);
  });

  it("keeps the same source ID separate across owners", async () => {
    const sourceId = `cross-owner-${randomUUID()}`;
    const [first, second] = await Promise.all([
      ingestCanonicalActivity(input("phase1_user_A", sourceId)),
      ingestCanonicalActivity(input("phase1_user_B", sourceId)),
    ]);
    createdIds.push(first.activity.id, second.activity.id);
    expect(first.activity.id).not.toBe(second.activity.id);
    expect(first.activity.ownerUserId).toBe("phase1_user_A");
    expect(second.activity.ownerUserId).toBe("phase1_user_B");
  });

  it("reports conflicting payloads without overwriting the accepted activity", async () => {
    const sourceId = `conflict-${randomUUID()}`;
    const first = await ingestCanonicalActivity(input("phase1_user_A", sourceId, 500));
    const second = await ingestCanonicalActivity(input("phase1_user_A", sourceId, 900));
    createdIds.push(first.activity.id);
    expect(first.status).toBe("created");
    expect(second.status).toBe("conflict");
    expect(second.activity.recordedAscentM).toBe(500);
    const [conflict] = await db.select().from(canonicalActivityConflicts).where(and(
      eq(canonicalActivityConflicts.activityId, first.activity.id),
      eq(canonicalActivityConflicts.conflictType, "payload_conflict"),
    ));
    expect(conflict).toBeTruthy();
  });

  it("stores GPS evidence privately by default", async () => {
    const sourceId = `privacy-${randomUUID()}`;
    const result = await ingestCanonicalActivity(input("phase1_user_A", sourceId));
    createdIds.push(result.activity.id);
    const [evidence] = await db.select().from(canonicalActivityEvidence)
      .where(eq(canonicalActivityEvidence.activityId, result.activity.id));
    expect(result.activity.visibility).toBe("private");
    expect(evidence.visibility).toBe("private");
  });
});