import { executeEngineReadOnlyQuery, type SignatureChallenge } from "@workspace/db";
import { CANONICAL_TRUST_SQL } from "./mountain/canonicalMountainLookup";
import { APPROACH_NOTE, SUMMIT_CHALLENGE_BATCH } from "../data/summitChallengeBatch";

type Summit = {
  id: string; name: string; country: string | null; region: string | null;
  latitude: number; longitude: number; elevationM: number | null; status: string;
};
let summitsPromise: Promise<Map<string, Summit>> | undefined;

async function trustedSummits() {
  if (!summitsPromise) {
    summitsPromise = (async () => {
      const ids = SUMMIT_CHALLENGE_BATCH.flatMap(challenge => challenge.stages.map(stage => stage.id));
      const rows = await executeEngineReadOnlyQuery<Summit>(
        `SELECT m.id, m.name, m.country, m.region,
          ST_Y(m.geom)::float8 AS latitude, ST_X(m.geom)::float8 AS longitude,
          m.elevation_m AS "elevationM", m.status
         FROM public.mountains m WHERE m.id = ANY($1::uuid[]) AND ${CANONICAL_TRUST_SQL}`,
        [ids],
      );
      const map = new Map(rows.map(row => [row.id, row]));
      for (const stage of SUMMIT_CHALLENGE_BATCH.flatMap(challenge => challenge.stages)) {
        if (!map.has(stage.id)) throw new Error(`Missing trusted summit ${stage.name}: ${stage.id}`);
        if (map.get(stage.id)!.name !== stage.name) throw new Error(`Summit identity mismatch: ${stage.id}`);
      }
      return map;
    })().catch(error => { summitsPromise = undefined; throw error; });
  }
  return summitsPromise;
}

/** Read-only catalogue overlay. No saved goals, source rows or activity writes. */
export async function revisedSummitChallenge(source: SignatureChallenge) {
  const spec = SUMMIT_CHALLENGE_BATCH.find(challenge => challenge.sourceId === source.challengeId);
  if (!spec) return source;
  const summits = await trustedSummits();
  const stages = spec.stages.map((stage, index) => ({
    stageOrder: index + 1,
    routeKey: `${spec.challengeId}:${stage.id}`,
    routeName: stage.approach,
    catalogueMountain: summits.get(stage.id)!,
    region: spec.region,
    // Full outing and exact uphill-only distance are intentionally unknown.
    distanceKm: null,
    approachDistanceKm: stage.approachDistanceKm,
    exactUphillDistanceKm: null,
    ascentM: stage.ascentM,
    estimatedHours: null,
    difficulty: stage.safetyWarning ? "Expert" : "Hard",
    dnaContribution: null,
    whySelected: `${stage.approach}. Start: ${stage.start}. ${stage.evidenceNote ?? ""}`.trim(),
    approachStart: stage.start,
    safetyWarning: stage.safetyWarning ?? null,
    evidenceNote: stage.evidenceNote ?? null,
    distanceBasis: "one_way_approach" as const,
    completionPolicy: "selected_stages" as const,
    reference: {
      target: spec.target, route: spec.referenceRoute,
      ascentM: spec.referenceAscentM, approachDistanceKm: spec.referenceApproachKm,
      comparison: spec.comparison, sources: spec.sources,
    },
  }));
  return {
    ...source,
    challengeId: spec.challengeId,
    sourceChallengeId: spec.sourceId,
    challengeName: spec.title,
    targetMountainName: spec.target,
    mountainSlug: spec.slug,
    targetRoute: spec.referenceRoute,
    recommendedDays: 0,
    selfPaced: true,
    totalAscentM: spec.stages.reduce((sum, stage) => sum + stage.ascentM, 0),
    totalDistanceKm: null,
    approachDistanceKm: Math.round(spec.stages.reduce((sum, stage) => sum + stage.approachDistanceKm, 0) * 10) / 10,
    exactUphillDistanceKm: null,
    estimatedHours: null,
    dnaMatchScore: null,
    adventureScore: null,
    regions: spec.region,
    summary: `${spec.stages.length} local summit stages, in any order, at your own pace. ${spec.comparison}`,
    dataConfidence: "Owner-reviewed approximate approach estimates",
    heroImage: source.heroImage ? `/api/artwork/image/${spec.challengeId}/hero` : null,
    cardImage: source.cardImage ? `/api/artwork/image/${spec.challengeId}/card` : null,
    thumbnailImage: source.thumbnailImage ? `/api/artwork/image/${spec.challengeId}/thumbnail` : null,
    stages,
    limitations: [APPROACH_NOTE, ...spec.stages.flatMap(stage => [stage.safetyWarning, stage.evidenceNote].filter(Boolean))],
    completionPolicy: "selected_stages" as const,
    reference: stages[0].reference,
  };
}
