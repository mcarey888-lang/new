import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  exploreHikeCanonicalAdapterEnabled,
  planExploreHikeCanonicalization,
  type ExploreHikeCanonicalAdapterInput,
} from "../services/exploreHikeCanonicalAdapter";

const exploreRouteSource = readFileSync(
  new URL("../routes/explore-hike-canonical.ts", import.meta.url),
  "utf8",
);

const localHike = (
  overrides: Partial<ExploreHikeCanonicalAdapterInput> = {},
): ExploreHikeCanonicalAdapterInput => ({
  exploreHikeId: "local-hike-abc",
  occurredAt: new Date("2026-09-19T09:00:00.000Z"),
  activityKind: "outdoor_hike",
  distanceKm: 12,
  recordedAscentM: 640,
  evidenceClassification: "gps_recorded",
  sourceSnapshot: {
    name: "Tryfan",
    localOnly: true,
  },
  ...overrides,
});

describe("ExploreHike canonical adapter", () => {
  it("has an authenticated default-off server activation boundary", () => {
    delete process.env.CANONICAL_EXPLORE_HIKE_ADAPTER_ENABLED;
    expect(exploreHikeCanonicalAdapterEnabled()).toBe(false);
    expect(exploreRouteSource).toMatch(/router\.post\("\/canonicalize"/);
    expect(exploreRouteSource).toMatch(/getAuth\(req\)/);
    expect(exploreRouteSource).toMatch(/db\.transaction\(\(tx\) => canonicalizeExploreHikeWithClient/);
    expect(exploreRouteSource).toMatch(/status: "disabled"/);
  });

  it("keeps a stable local ID across offline retries", () => {
    const first = planExploreHikeCanonicalization(localHike());
    const retry = planExploreHikeCanonicalization(localHike());
    expect(first.mode).toBe("ingest");
    expect(retry.mode).toBe("ingest");
    if (first.mode === "ingest" && retry.mode === "ingest") {
      expect(first.output.source).toEqual({
        sourceType: "explore_hike",
        sourceId: "local-hike-abc",
      });
      expect(retry.output.source).toEqual(first.output.source);
    }
  });

  it("does not derive identity from name, date, distance, or elevation", () => {
    const differentLocalRecord = planExploreHikeCanonicalization(localHike({
      exploreHikeId: "local-hike-def",
      occurredAt: new Date("2026-09-20T09:00:00.000Z"),
      distanceKm: 12,
      recordedAscentM: 640,
    }));
    expect(differentLocalRecord.mode).toBe("ingest");
    if (differentLocalRecord.mode === "ingest") {
      expect(differentLocalRecord.output.source.sourceId).toBe("local-hike-def");
    }
  });

  it("reuses an explicit existing canonical identity only", () => {
    const plan = planExploreHikeCanonicalization(localHike({
      existingCanonicalActivityId: "f5dd0ef8-7c31-4af4-a9ed-e264753b39c6",
      explicitLinks: [{
        linkType: "canonical_hill",
        targetId: "hill-42",
      }],
    }));
    expect(plan).toEqual({
      mode: "reuse",
      source: {
        sourceType: "explore_hike",
        sourceId: "local-hike-abc",
      },
      canonicalActivityId: "f5dd0ef8-7c31-4af4-a9ed-e264753b39c6",
      links: [{
        linkType: "canonical_hill",
        targetId: "hill-42",
      }],
    });
  });

  it("rejects an invalid explicit identity rather than fuzzy matching", () => {
    expect(() => planExploreHikeCanonicalization(localHike({
      existingCanonicalActivityId: "not-a-server-id",
    }))).toThrow(/canonical activity ID/);
  });

  it("keeps ownership outside the local source identity", () => {
    const plan = planExploreHikeCanonicalization(localHike());
    expect(plan.mode).toBe("ingest");
    if (plan.mode === "ingest") {
      expect(plan.output).not.toHaveProperty("ownerUserId");
      expect(plan.output.source.sourceId).not.toContain("owner");
    }
    // The authenticated ingestion layer supplies owner_user_id separately;
    // equal local IDs for different owners therefore remain separate rows.
  });

  it("only carries explicitly supplied stable links", () => {
    const withoutLink = planExploreHikeCanonicalization(localHike({
      sourceSnapshot: { name: "Tryfan", hillId: 42 },
    }));
    expect(withoutLink.mode).toBe("ingest");
    if (withoutLink.mode === "ingest") {
      expect(withoutLink.output.links).toEqual([]);
    }
    const withSdeLink = planExploreHikeCanonicalization(localHike({
      explicitLinks: [{
        linkType: "canonical_hill",
        targetId: "sde:mountain:f5dd0ef8-7c31-4af4-a9ed-e264753b39c6",
      }],
    }));
    expect(withSdeLink.mode).toBe("ingest");
    if (withSdeLink.mode === "ingest") {
      expect(withSdeLink.output.links).toHaveLength(1);
    }
  });

  it("maps manual and untrusted classifications without promoting evidence", () => {
    const manual = planExploreHikeCanonicalization(localHike({
      evidenceClassification: "estimated_manual",
    }));
    const unavailable = planExploreHikeCanonicalization(localHike({
      evidenceClassification: "unavailable_untrusted",
    }));
    expect(manual.mode).toBe("ingest");
    expect(unavailable.mode).toBe("ingest");
    if (manual.mode === "ingest" && unavailable.mode === "ingest") {
      expect(manual.output.evidence?.[0].evidenceType).toBe("manual_estimate");
      expect(unavailable.output.evidence?.[0].evidenceType).toBe("source_snapshot");
      expect(manual.output.sourceSnapshot?.evidenceClassification).toBe("estimated_manual");
      expect(unavailable.output.sourceSnapshot?.evidenceClassification).toBe("unavailable_untrusted");
    }
  });
});
