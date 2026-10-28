import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AGREED_SUMMIT_CHALLENGES, SUMMIT_CHALLENGE_BATCH, sourceArtworkId } from "../data/summitChallengeBatch";
import { COLLECTION_SOURCES, FIRST_THREE, MONT_BLANC_ALIAS } from "../data/expeditionCollectionSources";
import { collectionCounts, collectionCoverage, visibleInSummitCollection } from "../data/expeditionCollectionCoverage";
import { remainingSummitChallenges } from "../data/remainingSummitChallenges";

describe("complete source coverage, without claiming pending items are complete", () => {
  it("accounts exactly for 61 sources / 54 remaining / 57 non-UK / four exclusions", () => {
    const counts = collectionCounts();
    expect(counts.approvedSourceEntries).toBe(61);
    expect(counts.remainingSourceEntriesHandled).toBe(54);
    expect(counts.nonUkSourceEntries).toBe(57);
    expect(counts.retainedFirstBatch).toBe(3);
    expect(counts.excludedUkTargets).toBe(4);
    expect(counts.artworkAliases).toBe(1);
    expect(counts.startableChallenges + counts.pendingSourceEntries + counts.artworkAliases).toBe(57);
    expect(new Set(COLLECTION_SOURCES.map(source => source.id)).size).toBe(61);
  });
  it("keeps every unsupported reference named, with a concrete gap and no fabricated zeros", () => {
    for (const entry of collectionCoverage().filter(item => item.status === "pending")) {
      expect(entry.target).toBeTruthy();
      expect(entry.note.length).toBeGreaterThan(60);
      expect(entry.researchSources.length).toBeGreaterThan(0);
      expect(entry.challengeId).toBeNull();
      expect(entry.reference).toBeNull();
      expect(entry.stages).toEqual([]);
    }
  });
  it("retains both Mont Blanc source/artwork associations, not two indistinguishable cards", () => {
    const alias = collectionCoverage().find(item => item.sourceId === MONT_BLANC_ALIAS)!;
    expect(alias.status).toBe("artwork_alias");
    expect(alias.aliasOf).toBe("SIG054-SUMMITS-1");
    expect(alias.artwork.sourceId).toBe(MONT_BLANC_ALIAS);
    expect(alias.regionBasis).toContain("inferred");
    expect(SUMMIT_CHALLENGE_BATCH.filter(item => item.target === "Mont Blanc" && item.region === "Lake District")).toHaveLength(1);
  });
  it("excludes UK targets from new browsing, preserves unrelated entries and legacy IDs", () => {
    for (const id of ["SIG042", "SIG043", "SIG044", "SIG045", MONT_BLANC_ALIAS]) {
      expect(visibleInSummitCollection(id)).toBe(false);
      expect(sourceArtworkId(id)).toBe(id);
    }
    expect(visibleInSummitCollection("UNRELATED-OWNER-CHALLENGE")).toBe(true);
  });
});

describe("curated revisions and stage estimates", () => {
  it("retains first-three specs and is deterministic/idempotent", () => {
    expect(SUMMIT_CHALLENGE_BATCH.slice(0, 3)).toEqual(AGREED_SUMMIT_CHALLENGES);
    expect(remainingSummitChallenges(AGREED_SUMMIT_CHALLENGES)).toEqual(SUMMIT_CHALLENGE_BATCH.slice(3));
    expect(new Set(SUMMIT_CHALLENGE_BATCH.map(item => item.challengeId)).size).toBe(SUMMIT_CHALLENGE_BATCH.length);
    expect(AGREED_SUMMIT_CHALLENGES.map(item => item.stages.length)).toEqual([2, 3, 10]);
  });
  it.each(SUMMIT_CHALLENGE_BATCH)("$sourceId uses distinct exact identities inside permitted local areas, with positive non-zero estimates", challenge => {
    const source = COLLECTION_SOURCES.find(item => item.id === challenge.sourceId)!;
    expect(new Set(challenge.stages.map(stage => stage.id)).size).toBe(challenge.stages.length);
    expect(challenge.referenceAscentM).toBeGreaterThan(0);
    expect(challenge.referenceApproachKm).toBeGreaterThan(0);
    for (const stage of challenge.stages) {
      expect(stage.id).toMatch(/^[a-f0-9-]{36}$/);
      expect(stage.name).toBeTruthy();
      expect(stage.start).toBeTruthy();
      expect(stage.approach).toBeTruthy();
      expect(source.areas).toContain(stage.area ?? challenge.region);
      expect(stage.ascentM).toBeGreaterThan(0);
      expect(stage.approachDistanceKm).toBeGreaterThan(0);
      if (!FIRST_THREE.has(challenge.sourceId)) {
        expect(stage.sources?.length).toBeGreaterThan(0);
        expect(stage.evidenceNote).toBeTruthy();
      }
    }
  });
  it("reference arithmetic is based on published approach legs, not legacy totals or summit heights", () => {
    const denali = SUMMIT_CHALLENGE_BATCH.find(item => item.sourceId === "SIG017")!;
    expect(denali.referenceAscentM).toBe(4100);
    expect(denali.referenceApproachKm).toBe(26.7);
    const teide = SUMMIT_CHALLENGE_BATCH.find(item => item.sourceId === "SIG032")!;
    expect(teide.referenceAscentM).toBe(1490);
    expect(teide.referenceApproachKm).toBe(9);
    const monch = SUMMIT_CHALLENGE_BATCH.find(item => item.sourceId === "SIG035")!;
    expect(monch.referenceAscentM).toBe(650);
    expect(monch.referenceApproachKm).toBe(2.5);
  });
  it("keeps catalogue construction read-only and old-ID detail lookups unmodified", () => {
    const route = readFileSync(resolve(import.meta.dirname, "../routes/signature-challenges.ts"), "utf8");
    const overlay = readFileSync(resolve(import.meta.dirname, "../services/summitChallengeRevisions.ts"), "utf8");
    expect(route).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
    expect(overlay).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
    expect(route).toContain("sourceArtworkId(challengeId) === challengeId");
    expect(overlay).toContain('completionPolicy: "selected_stages"');
    expect(overlay).toContain("distanceKm: null");
    expect(overlay).toContain("exactUphillDistanceKm: null");
  });
});
