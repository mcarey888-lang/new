import { COLLECTION_SOURCES, FIRST_THREE, MONT_BLANC_ALIAS } from "./expeditionCollectionSources";
import { SUMMIT_CHALLENGE_BATCH } from "./summitChallengeBatch";
import { REFERENCE_METRICS } from "./expeditionReferenceMetrics";

/** These are genuine evidence gaps, not exact-uphill segmentation requests.
 * Raw research results are retained in generated-artifacts/expedition-collection.
 * Pending sources retain their legacy IDs/artwork and never get invented zeros.
 */
const GAPS: Record<string, [string, string[]]> = {
  "everest": ["South Col / Southeast Ridge: published base-camp-to-summit net gain is available, and route leg distances are available, but a credible cumulative outbound ascent estimate for that same itinerary has not been established. Summit altitude is not used as ascent.", ["https://www.alanarnette.com/everest/everestsouthroutes.php", "https://www.summitpost.org/south-col-or-southeast-ridge/165530"]],
  "k2": ["Abruzzi Spur: missing a supported complete base-camp-to-summit one-way approach length and cumulative ascent pair; climbing-wall height/camp altitudes alone are not that measurement.", ["https://www.alanarnette.com/k2/k2routes.php"]],
  "kangchenjunga": ["Southwest Face normal route: face height and camp elevations do not establish the complete outbound approach gain and distance.", ["https://en.wikipedia.org/wiki/Kangchenjunga"]],
  "lhotse": ["West Face normal route: the final couloir's climbing length is not the complete Everest Base Camp-to-Lhotse summit approach; paired full approach distance/ascent is missing.", ["https://www.summitclimb.com/expedition/lhotse"]],
  "makalu": ["Northwest Ridge: advanced-base-camp/camp heights are documented, but complete one-way distance and cumulative gain for the same conventional start are unresolved.", ["https://www.summitclimb.com/expedition/makalu"]],
  "cho-oyu": ["Northwest Ridge: advanced-base-camp and camp progression are published, but not a supported complete one-way approach distance paired with cumulative ascent.", ["https://www.namasadventure.com/cho-oyu-8201m-expedition"]],
  "dhaulagiri": ["Northeast Ridge: route/base-camp information is available; a supported complete one-way approach distance with cumulative ascent from that same start is missing.", ["https://www.jagged-globe.co.uk/climb/exp/i/dhaulagiri.html"]],
  "manaslu": ["Northeast Face: route and camp heights are available, but a complete outbound approach length and cumulative climb gain pair was not established.", ["https://www.explore-share.com/blog/climbing-manaslu-routes-climate-difficulty-preparation-equipment-cost"]],
  "nanga-parbat": ["Kinshofer Route: other-route reports cannot supply this route's figures. Complete Kinshofer outbound distance and cumulative ascent remain unsupported.", ["https://www.summitpost.org/nanga-parbat/150276"]],
  "annapurna": ["Northwest Ridge: available route histories and summit/camp heights do not supply a supported complete approach distance/ascent pair for one conventional itinerary.", ["https://globalsummitguide.com/mountains/annapurna-i-climb-guide-nepal/"]],
  "gasherbrum-1": ["Japanese Couloir: camp/technical section descriptions do not establish complete base-camp-to-summit one-way length and cumulative ascent.", ["https://explorersweb.com/gasherbrum-i-a-climbers-guide"]],
  "broad-peak": ["West Ridge normal route: itinerary and camp progression exist; complete outbound approach length with cumulative ascent is missing.", ["https://www.altiproadventures.com/expeditions/expedition/broad-peak-expedition/"]],
  "gasherbrum-2": ["Southwest Ridge: operator itinerary is retained for review, but a complete, unambiguous outbound distance/gain pair excluding return carries was not established.", ["https://alpenglowexpeditions.com/wp-content/uploads/2021/02/Gasherbrum-II-packet-Final.pdf"]],
  "shishapangma": ["Northern Route: needs a supported reference that reaches the MAIN summit, not the central summit, with complete one-way distance and cumulative ascent.", ["http://www.highspirittreks.com/mount-shishapangma-expedition-8027m26335-ft.html"]],
  "aconcagua": ["Normal Route: operator camp-move ascent is available, but the summit-day mileage is presented for a return-to-camp day without clearly defining the outbound portion. Do not guess or halve the whole expedition.", ["https://www.alpineascents.com/climbs/aconcagua/itinerary/", "https://aconcaguaexpeditions.com/ingles/3/normal_route.htm"]],
  "ojos": ["Refugio Atacama route: vehicle access assumptions and camp elevations vary. Need one conventional start and supported cumulative ascent/one-way length to the summit for that start.", ["https://www.summitpost.org/ojos-del-salado/150299"]],
  "ebc": ["Classic Lukla–Namche–Everest Base Camp: 62–65 km one-way is supported, but itinerary gain totals mix acclimatisation loops and the final Gorak Shep–EBC return. Need a cumulative outbound gain for a consistently defined itinerary. This remains Base Camp, never Everest summit.", ["https://lifehappensoutdoors.com/trip/everest-base-camp-trek", "https://www.ecoholidaysnepal.com/lukla-to-everest-base-camp-trek"]],
  "batian": ["North Face Standard: technical climbing length is not complete Shipton's Camp-to-Batian summit approach distance. Missing paired complete approach distance/ascent.", ["https://www.summitpost.org/normal-route-of-the-ne-side-of-the-batian/258417"]],
  "grossglockner": ["Normal Route: credible ascent figures exist, but the complete one-way approach length from the same named hut/trailhead was not established; do not combine different starts.", ["https://www.grossglockner.at/de/naturerlebnis-grossglockner/geschichte-grossglockner"]],
  "jungfrau": ["Jungfraujoch normal route: published approximately 850 m ascent is available, but complete one-way length to Jungfrau (not the railway journey) is unresolved.", ["https://www.explore-share.com/blog/climbing-jungfrau-facts-info"]],
  "eiger": ["Mittellegi Ridge: published hut-to-summit ascent is available, but published traverse distances include the post-summit descent to Jungfraujoch. Need the pre-summit portion; the full traverse cannot be halved.", ["https://www.outdoor.ch/en/outdoor-mountaineering/eiger/"]],
  "bernina": ["Biancograt: the published 5.6–6 km traverse includes descent to Marco e Rosa. Ascent is supported, but that full traverse length is not a one-way summit approach and cannot be halved.", ["https://www.bergwelten.com/t/b/39809", "https://www.bahn-zum-berg.at/bernina-alpen/biancograt-piz-bernina-piz-palu"]],
  "etna": ["Sapienza cable-car route: operator explicitly gives a 5 km approach to the currently permitted crater terrace (~3,250 m), not a guaranteed summit. A supported cumulative ascent and unambiguous permitted endpoint remain needed; do not calculate ascent from endpoint altitude or promise access to closed craters.", ["https://guidevulcanologicheetna.it/en/excursion-summit-craters-etna-south/"]],
  "rysy": ["Morskie Oko approach: official Morskie Oko–Czarny Staw segment figures are available, but they do not reach Rysy summit. Missing supported full approach length/ascent for the same summit endpoint.", ["https://www.zakopane.pl/en/tourist-area/tourism/tatra-mountains/aktywny-wypoczynek-lato/summer-trails/morskie-oko-czarny-staw-pod-rysami"]],
  "carstensz": ["Harrer's normal route: technical pitch lengths and base-camp altitude do not provide complete Yellow Valley base-camp-to-summit one-way distance and cumulative ascent.", ["https://www.carstenszpapua.com/summit_climbing_routes.html", "https://climbingthesevensummits.com/carstensz-pyramid-climb/route-beta"]],
  "vinson": ["Branscomb Glacier: camp-move gain/distance is published, but the operator's summit-day distance includes a return to high camp and differs from the independent ascent account. Need an unambiguous same-route one-way summit-leg distance before using a total.", ["https://www.alpineascents.com/climbs/mount-vinson/itinerary/", "https://fastestknowntime.com/route/mount-vinson-antarctica"]],
  "ama-dablam": ["Southwest Ridge: published base-camp/summit net difference and camp descriptions exist, but a credible complete one-way approach length and cumulative gain pair was not established.", ["https://www.protrekadventure.com/trip/ama-dablam-expedition", "https://www.summitclimb.de/en/tours/expeditions/asia/ama-dablam"]],
};

export function collectionCoverage() {
  return COLLECTION_SOURCES.map(source => {
    const revision = SUMMIT_CHALLENGE_BATCH.find(item => item.sourceId === source.id);
    const status = source.reference === "excluded" ? "excluded_uk_target"
      : source.id === MONT_BLANC_ALIAS ? "artwork_alias"
      : revision ? FIRST_THREE.has(source.id) ? "retained" : "ready" : "pending";
    const gap = GAPS[source.reference];
    return {
      sourceId: source.id, target: source.target, permittedLocalAreas: source.areas,
      status,
      challengeId: revision?.challengeId ?? null,
      aliasOf: source.id === MONT_BLANC_ALIAS ? "SIG054-SUMMITS-1" : null,
      regionBasis: source.id === MONT_BLANC_ALIAS ? "Lake District inferred explicitly from the approved title; agreed Goûter comparison" : "Approved source catalogue",
      artwork: {
        sourceId: source.id,
        hero: `/api/artwork/image/${source.id}/hero`,
        card: `/api/artwork/image/${source.id}/card`,
        thumbnail: `/api/artwork/image/${source.id}/thumbnail`,
      },
      note: status === "artwork_alias"
        ? "Source and its separate approved artwork retained as an explicit association of SIG054. No second indistinguishable collection card; neither source nor saved plans is overwritten."
        : status === "excluded_uk_target" ? "Excluded only as a new-collection target. Legacy challenge details, plans, activities and UK summit stages remain intact."
        : status === "pending" ? REFERENCE_METRICS[source.reference]
          ? `Supported international reference exists, but there is not yet a sourced set of distinct substantial local approaches in ${source.areas.join(" / ")} with a sensible ascent fit. No tiny fillers or repeated summits were added.`
          : gap?.[0] ?? "Complete conventional approach distance and cumulative ascent remain unsupported; no substitute or zero was inserted."
        : revision?.evidenceNote ?? "First agreed batch retained unchanged.",
      researchSources: revision?.sources ?? REFERENCE_METRICS[source.reference]?.sources ?? gap?.[1] ?? [],
      reference: revision ? {
        target: revision.target, route: revision.referenceRoute,
        ascentM: revision.referenceAscentM, approachDistanceKm: revision.referenceApproachKm,
        comparison: revision.comparison, note: revision.evidenceNote ?? null, sources: revision.sources,
      } : null,
      stages: revision?.stages ?? [],
    };
  });
}

/** All 54 remaining sources are accounted for; "handled" is NOT "startable". */
export function collectionCounts(entries = collectionCoverage()) {
  return {
    approvedSourceEntries: entries.length,
    retainedFirstBatch: entries.filter(item => item.status === "retained").length,
    remainingSourceEntriesHandled: entries.filter(item => !FIRST_THREE.has(item.sourceId) && item.status !== "excluded_uk_target").length,
    nonUkSourceEntries: entries.filter(item => item.status !== "excluded_uk_target").length,
    newStartableChallenges: entries.filter(item => item.status === "ready").length,
    startableChallenges: entries.filter(item => item.status === "ready" || item.status === "retained").length,
    pendingSourceEntries: entries.filter(item => item.status === "pending").length,
    artworkAliases: entries.filter(item => item.status === "artwork_alias").length,
    excludedUkTargets: entries.filter(item => item.status === "excluded_uk_target").length,
  };
}

export function visibleInSummitCollection(id: string): boolean {
  const known = COLLECTION_SOURCES.find(source => source.id === id);
  return !known || SUMMIT_CHALLENGE_BATCH.some(challenge => challenge.sourceId === id);
}
