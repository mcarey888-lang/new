import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  canonicalActivities,
  canonicalActivityConflicts,
  canonicalActivityEvidence,
  canonicalActivityLinks,
  canonicalActivityQualifications,
  personalElevationCreditEvents,
  personalElevationCreditCorrections,
  expeditionStageContributions,
  expeditionContributionCorrections,
  expeditionRuns,
} from "@workspace/db/schema";
import { ingestCanonicalActivity, type CanonicalActivityInput } from "../services/canonicalActivity";
import { invalidateCanonicalActivityEvidence } from "../services/canonicalEvidenceInvalidation";
import { writePersonalElevationCredit, getOrCreateExpeditionRun, writeExpeditionStageContribution } from "../services/stage2Ledgers";

const runIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "1";
const describeIntegration = runIntegration ? describe : describe.skip;
const createdIds: string[] = [];
const isolation = vi.hoisted(() => ({
  schema: `audit_canonical_${Date.now()}_${Math.random().toString(16).slice(2)}`,
}));

// Only this integration file receives a separate pool/search_path. Public app
// tables and the application workflow's connections are never used for writes.
vi.mock("@workspace/db", async importOriginal => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  if (process.env.RUN_DB_INTEGRATION_TESTS !== "1") return actual;
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1")
    throw new Error("Canonical integration isolation must not run in production");
  const Pool = actual.pool.constructor as new (options: {
    connectionString?: string; options: string; max: number;
  }) => typeof actual.pool;
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const testPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${isolation.schema},public`,
    max: 10,
  });
  return { ...actual, pool: testPool, db: drizzle(testPool) };
});

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
  beforeAll(async () => {
    if (!/^audit_canonical_[a-z0-9_]+$/.test(isolation.schema)) throw new Error("Unsafe test schema");
    await db.execute(sql.raw(`CREATE SCHEMA "${isolation.schema}"`));
    const result = await pool.query("SELECT current_schema() AS schema");
    if (result.rows[0].schema !== isolation.schema) throw new Error("Test schema isolation failed");
    // Use the real foundation DDL, excluding global extension installation and
    // the legacy app-table adapter. Those are not what these four tests exercise.
    const migration = readFileSync(new URL("../../../../lib/db/migrations/0001_canonical_activity_foundation.sql", import.meta.url), "utf8")
      .replace("CREATE EXTENSION IF NOT EXISTS pgcrypto;", "")
      .split('ALTER TABLE "tracked_hill_sessions"')[0];
    await db.execute(sql.raw(migration));
    const ledgerMigration = readFileSync(new URL("../../../../lib/db/migrations/0002_stage2_activity_ledgers.sql", import.meta.url), "utf8");
    await db.execute(sql.raw(ledgerMigration));
    vi.stubEnv("STAGE2_LEDGER_ENABLED", "true");
  });
  afterAll(async () => {
    try {
      // Generated, empty-on-creation test schema only; never public/production.
      if (/^audit_canonical_[a-z0-9_]+$/.test(isolation.schema))
        await db.execute(sql.raw(`DROP SCHEMA IF EXISTS "${isolation.schema}" CASCADE`));
    } finally {
      vi.unstubAllEnvs();
      await pool.end();
    }
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

  async function creditedFixture() {
    const owner = `audit-${randomUUID()}`;
    const { activity } = await ingestCanonicalActivity(input(owner, randomUUID(), 500));
    await db.insert(canonicalActivityQualifications).values([
      { activityId: activity.id, ownerUserId: owner, purpose: "personal_history",
        status: "eligible", evidenceClass: "recorded_unverified", ruleVersion: "audit-rule" },
      { activityId: activity.id, ownerUserId: owner, purpose: "elevation_bank_personal",
        status: "eligible", evidenceClass: "recorded_unverified", ruleVersion: "audit-rule", creditedMetric: 500 },
    ]);
    await writePersonalElevationCredit({
      ownerUserId: owner, activityId: activity.id, evidenceClass: "recorded_unverified",
      creditedAscentM: 500, ruleVersion: "audit-rule", effectiveAt: activity.occurredAt,
    });
    const run = await getOrCreateExpeditionRun({
      ownerUserId: owner, expeditionId: "audit-expedition", runKey: randomUUID(),
      ruleVersion: "audit-rule", scoreVersion: "audit-score",
    });
    await writeExpeditionStageContribution({
      ownerUserId: owner, activityId: activity.id, runId: run.id, expeditionId: run.expeditionId,
      stageRule: { stageKey: "audit-stage", ruleVersion: "audit-rule", scoreVersion: "audit-score",
        allowedActivityKinds: ["outdoor_hike"], allowedEvidenceClasses: ["recorded_unverified"] },
      activityKind: "outdoor_hike", evidenceClass: "recorded_unverified",
      acceptedMetric: 500, acceptedElevationM: 500,
    });
    return { activity, run, correction: {
      ownerUserId: owner, activityId: activity.id, correctionId: randomUUID(),
      expectedSourcePayloadHash: activity.sourcePayloadHash, reviewedBy: "isolated-test-reviewer",
      reason: "Verified test evidence invalidation", authorityAt: new Date("2026-10-14T06:00:00Z"),
    } };
  }

  it("atomically invalidates historical credit and active-stage contribution while retaining raw evidence and history", async () => {
    const { activity, correction } = await creditedFixture();
    expect(await invalidateCanonicalActivityEvidence(correction)).toMatchObject({ status: "invalidated" });
    const [saved] = await db.select().from(canonicalActivities).where(eq(canonicalActivities.id, activity.id));
    expect(saved).toMatchObject({ recordedAscentM: 500, validatedAscentM: 0, lifecycle: "corrected",
      sourcePayloadHash: activity.sourcePayloadHash, sourceSnapshot: activity.sourceSnapshot });
    const evidence = await db.select().from(canonicalActivityEvidence).where(eq(canonicalActivityEvidence.activityId, activity.id));
    expect(evidence.find(row => row.evidenceType === "gps_track")?.payload).toEqual([{ lat: 54.5, lon: -3.0 }]);
    expect(evidence.some(row => (row.payload as { kind?: string }).kind === "reviewed_evidence_invalidation")).toBe(true);
    const credit = await db.select().from(personalElevationCreditEvents).where(eq(personalElevationCreditEvents.activityId, activity.id));
    const stages = await db.select().from(expeditionStageContributions).where(eq(expeditionStageContributions.activityId, activity.id));
    expect(credit.map(row => [row.revision, row.status, row.creditedAscentM]).sort()).toEqual([[1,"credited",500],[2,"revoked",0]]);
    expect(stages.map(row => [row.revision, row.status, row.acceptedMetric]).sort()).toEqual([[1,"accepted",500],[2,"revoked",0]]);
    expect(await db.select().from(personalElevationCreditCorrections).where(eq(personalElevationCreditCorrections.activityId, activity.id))).toHaveLength(1);
    expect(await db.select().from(expeditionContributionCorrections).where(eq(expeditionContributionCorrections.activityId, activity.id))).toHaveLength(1);
    const qualifications = await db.select().from(canonicalActivityQualifications).where(eq(canonicalActivityQualifications.activityId, activity.id));
    expect(qualifications.find(row => row.purpose === "personal_history")?.status).toBe("eligible");
    expect(qualifications.find(row => row.purpose === "elevation_bank_personal")?.status).toBe("revoked");
    expect(await invalidateCanonicalActivityEvidence(correction)).toMatchObject({ status: "deduplicated" });
    await expect(invalidateCanonicalActivityEvidence({ ...correction, reason: "different" })).rejects.toThrow("reused");
    await expect(invalidateCanonicalActivityEvidence({ ...correction, correctionId: randomUUID(),
      authorityAt: new Date("2026-10-13T06:00:00Z") })).rejects.toThrow("stale");
  });

  it("refuses cross-owner corrections and stale source identities", async () => {
    const { correction } = await creditedFixture();
    await expect(invalidateCanonicalActivityEvidence({ ...correction, ownerUserId: "another-owner" })).rejects.toThrow("unavailable");
    await expect(invalidateCanonicalActivityEvidence({ ...correction, expectedSourcePayloadHash: "wrong" })).rejects.toThrow("identity changed");
  });

  it("does not reset a completed run or its cinematic/award authority", async () => {
    const { run, correction, activity } = await creditedFixture();
    await db.update(expeditionRuns).set({ status: "completed" }).where(eq(expeditionRuns.id, run.id));
    await expect(invalidateCanonicalActivityEvidence(correction)).rejects.toThrow("separate award review");
    const credits = await db.select().from(personalElevationCreditEvents).where(eq(personalElevationCreditEvents.activityId, activity.id));
    expect(credits).toHaveLength(1);
  });

  it("rolls all projection and ledger changes back if the audit append fails", async () => {
    const { correction, activity } = await creditedFixture();
    await db.execute(sql.raw("CREATE FUNCTION audit_reject_journal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.payload->>'kind' = 'reviewed_evidence_invalidation' THEN RAISE EXCEPTION 'audit append failed'; END IF; RETURN NEW; END $$"));
    await db.execute(sql.raw("CREATE TRIGGER audit_reject_journal BEFORE INSERT ON canonical_activity_evidence FOR EACH ROW EXECUTE FUNCTION audit_reject_journal()"));
    try {
      await expect(invalidateCanonicalActivityEvidence(correction)).rejects.toThrow();
      const credits = await db.select().from(personalElevationCreditEvents).where(eq(personalElevationCreditEvents.activityId, activity.id));
      const stages = await db.select().from(expeditionStageContributions).where(eq(expeditionStageContributions.activityId, activity.id));
      const [saved] = await db.select().from(canonicalActivities).where(eq(canonicalActivities.id, activity.id));
      expect(credits).toHaveLength(1); expect(stages).toHaveLength(1);
      expect(saved.validatedAscentM).toBeNull(); expect(saved.lifecycle).toBe("synced");
    } finally {
      await db.execute(sql.raw("DROP TRIGGER audit_reject_journal ON canonical_activity_evidence"));
      await db.execute(sql.raw("DROP FUNCTION audit_reject_journal()"));
    }
  });
});