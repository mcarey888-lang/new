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
  "kangchenjunga": ["Southwest / Yalung Face: the remaining gap is complete above-Base-Camp approach distance, not exact uphill segmentation. Gatta's report now supports roughly 3,200 m ascent: reverse the same-route C4–BC descent's published 2,140 m loss and add the 1,050 m summit ascent. But his complete climbing distance is not given. Sarjanovich's Wikiloc summit track is only a 3.4 km upper descent, not BC-to-summit travel; Camptocamp's Yalung record has no mapped line. AAJ's 1,200 m is fixed rope, not approach length. Lower trekking distances are not substituted.", ["https://www.philippegatta.com/kangchenjunga-nepal/", "https://aac-publications.s3.amazonaws.com/documents/aaj/1987/PDF/AAJ_1987_29_61_221b.pdf", "https://www.camptocamp.org/routes/1419668", "https://www.wikiloc.com/mountaineering-trails/kanchenjunga-summit-push-37273340"]],
  "lhotse": ["West Face / West Couloir: a public author map now supports approximately 10.4 km from Everest Base Camp to Lhotse summit. The checked route records do not publish an overall ascent figure; the final couloir gain alone excludes the Khumbu Icefall and lower face. Remaining gap is a published approximate overall gain (or published gain legs), not distance or exact cumulative segmentation.", ["https://www.camptocamp.org/routes/1114813", "https://www.summitclimb.com/expedition/lhotse", "https://www.alanarnette.com/climbs/lhotse.php"]],
  "makalu": ["Northwest Ridge: advanced-base-camp/camp heights are documented, but complete one-way distance and cumulative gain for the same conventional start are unresolved.", ["https://www.summitclimb.com/expedition/makalu"]],
  "cho-oyu": ["Northwest Ridge: advanced-base-camp and camp progression are published, but not a supported complete one-way approach distance paired with cumulative ascent.", ["https://www.namasadventure.com/cho-oyu-8201m-expedition"]],
  "dhaulagiri": ["Northeast Ridge: route/base-camp information is available; a supported complete one-way approach distance with cumulative ascent from that same start is missing.", ["https://www.jagged-globe.co.uk/climb/exp/i/dhaulagiri.html"]],
  "manaslu": ["Northeast Face: route and camp heights are available, but a complete outbound approach length and cumulative climb gain pair was not established.", ["https://www.explore-share.com/blog/climbing-manaslu-routes-climate-difficulty-preparation-equipment-cost"]],
  "nanga-parbat": ["Kinshofer Route: Oxymeter publishes approximately 4,026 m gain but explicitly marks its 18 km round-trip distance 'TO BE VERIFIED'. That warning prevents treating 9 km as a researched one-way length. The checked Camptocamp Kinshofer record has no mapped line; its separate Diama-glacier itinerary is a different route and is not substituted. Expeditions Unlimited describes the conventional Diamir camp progression but gives no full climbing distance. Remaining gap is a credible mapped/published complete approach length, not strict uphill precision.", ["https://www.oxymeter.it/en/vetta/nanga-parbat", "https://www.summitpost.org/nanga-parbat/150276", "https://www.camptocamp.org/routes/1257259", "https://www.expeditions-unlimited.com/en/expeditions/himalayas/climb-nanga-parbat-8126-meters-pakistan"]],
  "annapurna": ["Conventional North Face option now has a specific start: helicopter-access North Base Camp at 4,090 m (Namas). Namas and Expeditions Unlimited describe the complete camp progression but no complete one-way summit-approach length was found in the checked material. AAC's 1996 Northwest Ridge is a different historic line; its technical length cannot be substituted. Remaining need is a supported complete approach-length estimate and an explicit approximate ascent figure for the selected North Face itinerary, not survey-grade totals.", ["https://www.namasadventure.com/7000m-8000mexpeditions-blog-posts/visual-journey-annapurna1-8091m-expedition-nepal", "https://www.expeditions-unlimited.com/en/expeditions/himalayas/climb-annapurna-8091-meters-nepal", "https://publications.americanalpineclub.org/articles/12199728702"]],
  "gasherbrum-1": ["Japanese Couloir: the Alpenglow GII packet's separate GI extension lists 10 miles for C1–C2 and 12 miles for C2–C3, inconsistent with its short upper-route descriptions. They cannot silently be changed to 1.0 / 1.2 miles. ExplorersWeb confirms the camps/Japanese Couloir but not alternative complete approach distances. Remaining gap is an interpretable complete outbound length, not missing exact segmentation; GI is not substituted with GII.", ["https://alpenglowexpeditions.com/wp-content/uploads/2023/08/Gasherbrum-II-Packet.pdf", "https://explorersweb.com/gasherbrum-i-a-climbers-guide", "https://www.sevensummittreks.com/uploads/doc/g1-g2-fb-23-63958edfb33f7.pdf"]],
  "broad-peak": ["West Ridge: Camptocamp publishes 3,000 m ascent for the normal main-summit route. Its record has no approach length or mapped line; the checked AltiPro itinerary also does not state the full one-way summit distance. The 1.5 km summit ridge is only one section, and the fore-summit is not the goal. Remaining gap is approximate complete approach distance only.", ["https://www.camptocamp.org/routes/139779", "https://www.altiproadventures.com/expeditions/expedition/broad-peak-expedition/"]],
  "gasherbrum-2": ["Southwest Ridge: operator itinerary is retained for review, but a complete, unambiguous outbound distance/gain pair excluding return carries was not established.", ["https://alpenglowexpeditions.com/wp-content/uploads/2021/02/Gasherbrum-II-packet-Final.pdf"]],
  "shishapangma": ["Northern approach to the MAIN summit: Everest.pe describes almost 3,000 m ascent to 8,027 m, and ExplorersWeb explicitly distinguishes the final main-summit alternatives from the central summit. A complete mapped/published one-way approach length for that main-summit itinerary remains missing. Central-summit distances and the final ridge's technical length are not substituted. This is a specific main-endpoint/distance gap, not a demand for exact cumulative ascent.", ["https://everest.pe/shisha-pangma-expedition-8027m", "https://explorersweb.com/shishapangma-a-climbers-guide", "http://www.highspirittreks.com/mount-shishapangma-expedition-8027m26335-ft.html"]],
  "aconcagua": ["Normal Route: operator camp-move ascent is available, but the summit-day mileage is presented for a return-to-camp day without clearly defining the outbound portion. Do not guess or halve the whole expedition.", ["https://www.alpineascents.com/climbs/aconcagua/itinerary/", "https://aconcaguaexpeditions.com/ingles/3/normal_route.htm"]],
  "ojos": ["Refugio Atacama route: vehicle access assumptions and camp elevations vary. Need one conventional start and supported cumulative ascent/one-way length to the summit for that start.", ["https://www.summitpost.org/ojos-del-salado/150299"]],
  "ebc": ["Classic Lukla–Namche–Everest Base Camp: 62–65 km one-way is supported, but itinerary gain totals mix acclimatisation loops and the final Gorak Shep–EBC return. Need a cumulative outbound gain for a consistently defined itinerary. This remains Base Camp, never Everest summit.", ["https://lifehappensoutdoors.com/trip/everest-base-camp-trek", "https://www.ecoholidaysnepal.com/lukla-to-everest-base-camp-trek"]],
  "batian": ["North Face Standard: technical climbing length is not complete Shipton's Camp-to-Batian summit approach distance. Missing paired complete approach distance/ascent.", ["https://www.summitpost.org/normal-route-of-the-ne-side-of-the-batian/258417"]],
  "grossglockner": ["Normal Route: credible ascent figures exist, but the complete one-way approach length from the same named hut/trailhead was not established; do not combine different starts.", ["https://www.grossglockner.at/de/naturerlebnis-grossglockner/geschichte-grossglockner"]],
  "jungfrau": ["Jungfraujoch normal route: published approximately 850 m ascent is available, but complete one-way length to Jungfrau (not the railway journey) is unresolved.", ["https://www.explore-share.com/blog/climbing-jungfrau-facts-info"]],
  "eiger": ["Mittellegi Ridge: published hut-to-summit ascent is available, but published traverse distances include the post-summit descent to Jungfraujoch. Need the pre-summit portion; the full traverse cannot be halved.", ["https://www.outdoor.ch/en/outdoor-mountaineering/eiger/"]],
  "bernina": ["Biancograt: the published 5.6–6 km traverse includes descent to Marco e Rosa. Ascent is supported, but that full traverse length is not a one-way summit approach and cannot be halved.", ["https://www.bergwelten.com/t/b/39809", "https://www.bahn-zum-berg.at/bernina-alpen/biancograt-piz-bernina-piz-palu"]],
  "etna": ["Sapienza route endpoint remains unresolved: the checked volcanological-guide excursion's approximately 5 km approach reaches a permitted crater terrace around 3,250 m, not a confirmed ascent of Etna's actual highest summit. Access restrictions and the changing summit configuration prevent honestly calling that terrace the named highest-summit target. Do not substitute it silently or promise access to closed craters. This is an endpoint/access issue, not a demand for exact ascent or uphill-only distance.", ["https://guidevulcanologicheetna.it/en/excursion-summit-craters-etna-south/"]],
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
