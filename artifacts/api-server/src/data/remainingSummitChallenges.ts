import type { BatchChallenge } from "./summitChallengeBatch";
import { COLLECTION_SOURCES, FIRST_THREE, MONT_BLANC_ALIAS } from "./expeditionCollectionSources";
import { REFERENCE_METRICS } from "./expeditionReferenceMetrics";
import { chooseStages, localApproachPool } from "./expeditionLocalApproaches";
import { EIGER_BEN_RINNES_STAGE, PENDING_LOCAL_APPROACHES, PENDING_SOURCE_IDS } from "./pendingExpeditionLocalApproaches";

const rounded = (value: number) => Math.round(value * 10) / 10;
function difference(local: number, reference: number, longer: string, shorter: string) {
  const percent = rounded(Math.abs(local - reference) / reference * 100);
  return percent === 0 ? "matches the rounded reference" : `is ${percent}% ${local > reference ? longer : shorter}`;
}
export function remainingSummitChallenges(firstThree: BatchChallenge[]): BatchChallenge[] {
  const pool = localApproachPool(firstThree);
  return COLLECTION_SOURCES.flatMap(source => {
    if (FIRST_THREE.has(source.id) || source.id === MONT_BLANC_ALIAS) return [];
    const reference = REFERENCE_METRICS[source.reference];
    if (!reference) return [];
    const curationPool = PENDING_SOURCE_IDS.has(source.id)
      ? [...pool, ...PENDING_LOCAL_APPROACHES] : pool;
    const stages = source.id === "SIG059" ? [EIGER_BEN_RINNES_STAGE]
      : chooseStages(curationPool, source.areas, reference.ascentM);
    if (!stages.length) return [];
    const ascent = stages.reduce((sum, stage) => sum + stage.ascentM, 0);
    const distance = rounded(stages.reduce((sum, stage) => sum + stage.approachDistanceKm, 0));
    // An enormous mismatch is not filled with tiny hills or repeated summits.
    if (Math.abs(ascent - reference.ascentM) / reference.ascentM > 0.25) return [];
    return [{
      sourceId: source.id, challengeId: `${source.id}-SUMMITS-1`,
      title: `${source.target} — ${source.areas.join(" / ")}${source.id === "SIG036" || source.id === "SIG059" ? `: ${stages[0].name}` : ""}`,
      target: source.target, slug: source.target.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, ""),
      region: source.areas.join(" | "), referenceRoute: reference.route,
      referenceAscentM: reference.ascentM, referenceApproachKm: reference.approachKm,
      comparison: `Local ascent ${difference(ascent, reference.ascentM, "above", "below")}; approach distance ${difference(distance, reference.approachKm, "longer", "shorter")}. Ascent is the main equivalence measure, not distance, altitude or technical readiness.`,
      sources: reference.sources, stages,
      evidenceNote: reference.note,
      dataConfidence: "Curated approximate planning estimates; published references and reused owner-approved local estimates",
    }];
  });
}
