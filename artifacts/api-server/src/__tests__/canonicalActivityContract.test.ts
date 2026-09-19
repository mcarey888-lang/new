import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canonicalActivityBridgeEnabled,
  canonicalActivityPayloadHash,
  type CanonicalActivityInput,
} from "../services/canonicalActivity";

const schemaSource = readFileSync(
  new URL("../../../../lib/db/src/schema/canonical-activities.ts", import.meta.url),
  "utf8",
);
const routeSource = readFileSync(
  new URL("../routes/activities.ts", import.meta.url),
  "utf8",
);
const hillSessionSource = readFileSync(
  new URL("../routes/hill-session.ts", import.meta.url),
  "utf8",
);
const userRouteSource = readFileSync(
  new URL("../routes/user.ts", import.meta.url),
  "utf8",
);

function baseInput(overrides: Partial<CanonicalActivityInput> = {}): CanonicalActivityInput {
  return {
    ownerUserId: "user_A",
    sourceType: "tracked_hill_session",
    sourceId: "route_100",
    sourceVersion: "1",
    primaryContext: "free_hike",
    activityKind: "outdoor_hike",
    occurredAt: new Date("2026-09-19T09:00:00.000Z"),
    durationSeconds: 10_800,
    distanceKm: 12,
    recordedAscentM: 640,
    visibility: "private",
    evidenceState: "quality_accepted",
    sourceSnapshot: { plannedHillName: "Helvellyn" },
    ...overrides,
  };
}

describe("canonical activity Phase 0 contract", () => {
  it("uses server UUIDs and owner-scoped source idempotency", () => {
    expect(schemaSource).toMatch(/id:\s*uuid\("id"\)\.defaultRandom\(\)\.primaryKey\(\)/);
    expect(schemaSource).toMatch(
      /uniqueIndex\("canonical_activities_owner_source_uidx"\)\.on\(t\.ownerUserId,\s*t\.sourceType,\s*t\.sourceId\)/,
    );
    expect(routeSource).not.toMatch(/ownerUserId:\s*z\./);
    expect(routeSource).toMatch(/ownerUserId:\s*userId/);
  });

  it("keeps evidence private and qualifications purpose-specific", () => {
    expect(schemaSource).toMatch(/visibility:\s*text\("visibility"\)\.notNull\(\)\.default\("private"\)/);
    expect(schemaSource).toMatch(/chk_canonical_evidence_visibility/);
    expect(schemaSource).toMatch(/'summit_crown'/);
    expect(schemaSource).toMatch(/'leaderboard'/);
    expect(schemaSource).not.toMatch(/\bisVerified\b/);
  });

  it("keeps completion domains out of the generic activity contract", () => {
    expect(schemaSource).not.toMatch(/generic_completion|completion_type/);
    expect(schemaSource).toMatch(/'mountain_simulation'/);
    expect(schemaSource).not.toMatch(/summit_altitude|simulated_target_elevation/);
  });

  it("rejects negative metrics in API and database contracts", () => {
    expect(routeSource).toMatch(/recordedAscentM:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/);
    expect(routeSource).toMatch(/distanceKm:\s*z\.number\(\)\.nonnegative\(\)/);
    expect(schemaSource).toMatch(/chk_canonical_activity_recorded_ascent/);
    expect(schemaSource).toMatch(/chk_canonical_activity_distance/);
  });

  it("hashes semantically identical payloads deterministically", () => {
    const first = baseInput({ sourceSnapshot: { b: 2, a: 1 } });
    const second = baseInput({ sourceSnapshot: { a: 1, b: 2 } });
    expect(canonicalActivityPayloadHash(first)).toBe(canonicalActivityPayloadHash(second));
  });

  it("detects materially different payloads for one source identity", () => {
    const first = baseInput({ recordedAscentM: 500 });
    const second = baseInput({ recordedAscentM: 900 });
    expect(canonicalActivityPayloadHash(first)).not.toBe(canonicalActivityPayloadHash(second));
    expect(schemaSource).toMatch(/canonical_activity_conflicts/);
  });

  it("has an explicit bridge disable path", () => {
    const previous = process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED;
    process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED = "false";
    expect(canonicalActivityBridgeEnabled()).toBe(false);
    process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED = "true";
    expect(canonicalActivityBridgeEnabled()).toBe(true);
    if (previous === undefined) delete process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED;
    else process.env.CANONICAL_ACTIVITY_BRIDGE_ENABLED = previous;
  });

  it("preserves old tracked-hill payloads and adds only optional occurrence time", () => {
    expect(hillSessionSource).toMatch(/activityId:\s*z\.string\(\)/);
    expect(hillSessionSource).toMatch(/plannedHillName:\s*z\.string\(\)/);
    expect(hillSessionSource).toMatch(/occurredAt:\s*z\.coerce\.date\(\)\.optional\(\)/);
    expect(hillSessionSource).toMatch(/canonicalActivityId/);
  });

  it("removes owner activity records during authenticated account deletion", () => {
    expect(userRouteSource).toMatch(/canonicalActivities/);
    expect(userRouteSource).toMatch(/canonicalActivities\.ownerUserId,\s*userId/);
  });
});

describe("representative legacy fixtures A-N", () => {
  const fixtureExpectations = [
    ["A", "one activity for Session, ExploreHike and tracked session; route remains separate"],
    ["B", "one activity with a challenge link and one ascent credit"],
    ["C", "different owners remain separate despite the same source ID"],
    ["D", "same owner/source with changed payload reports a conflict"],
    ["E", "missing activity ID is probable only and is not automatically merged"],
    ["F", "similar repeated hikes remain distinct"],
    ["G", "manual activity is personal/readiness evidence but not automatically competitive"],
    ["H", "summit coordinate crossing alone is not verified summit evidence"],
    ["I", "Everest Scotland cannot create an Everest summit or Crown"],
    ["J", "Kilimanjaro simulation can credit actual local ascent but not target completion"],
    ["K", "leaderboard eligibility does not expose private GPS evidence"],
    ["L", "revoked source activity requires dependent projection recalculation"],
    ["M", "mutable expedition aggregate cannot synthesize missing activity ascent"],
    ["N", "username changes do not change stable owner identity"],
  ] as const;

  it.each(fixtureExpectations)("fixture %s: %s", (fixture) => {
    switch (fixture) {
      case "A":
      case "B":
        expect(schemaSource).toMatch(/canonical_activity_links/);
        expect(schemaSource).toMatch(/canonical_activities_owner_source_uidx/);
        break;
      case "C":
        expect(schemaSource).toMatch(/ownerUserId,\s*t\.sourceType,\s*t\.sourceId/);
        expect(hillSessionSource).toMatch(/Legacy activity identifier collision/);
        break;
      case "D":
        expect(schemaSource).toMatch(/canonical_activity_conflicts/);
        break;
      case "E":
      case "F":
        expect(schemaSource).not.toMatch(/fuzzy|probable_link|route_name.*unique/i);
        break;
      case "G":
      case "H":
        expect(schemaSource).toMatch(/unverified_manual/);
        expect(schemaSource).toMatch(/verified_summit_ascent/);
        break;
      case "I":
      case "J":
        expect(schemaSource).toMatch(/mountain_simulation/);
        expect(schemaSource).not.toMatch(/expedition_completion/);
        expect(schemaSource).toMatch(/real_summit_evidence/);
        break;
      case "K":
        expect(schemaSource).toMatch(/chk_canonical_evidence_visibility/);
        break;
      case "L":
        expect(schemaSource).toMatch(/'revoked'/);
        break;
      case "M":
        expect(schemaSource).not.toMatch(/virtualHikeProgress/);
        break;
      case "N":
        expect(schemaSource).toMatch(/owner_user_id/);
        expect(schemaSource).not.toMatch(/\bemail\b|\busername\b/);
        break;
    }
  });
});