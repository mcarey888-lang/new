import type { MountainReference } from "./expeditionReferenceMetrics";

const reference = (route: string, ascentM: number, approachKm: number, sources: string[], note: string): MountainReference =>
  ({ route, ascentM, approachKm, sources, note });

/** Rounded planning comparisons, not tracks or measures of technical readiness.
 * Public author map lengths are deliberately labelled derived approximations.
 * None of these estimates is applied to a user's recorded activity or old plan.
 */
export const PENDING_RESOLVED_REFERENCES: Record<string, MountainReference> = {
  everest: reference("Nepal Everest Base Camp to Everest summit via South Col / Southeast Ridge", 3500, 11.2,
    ["https://www.camptocamp.org/routes/948922", "https://nepalhimalpeakprofile.org/sagarmatha"],
    "Camptocamp publishes 3,500 m ascent for the Nepal South Col route. Nepal's official peak-profile indexed excerpt gives 11.2 km climbing-route length, separately from its Lukla caravan approach; the live official page was unavailable during this review. Excludes the Lukla approach and repeated acclimatisation rotations. Starts at Nepal Base Camp, not sea level or the Tibetan base camp."),
  k2: reference("K2 Base Camp via Advanced Base Camp and the Abruzzi Spur to the main summit", 3600, 8.1,
    ["https://www.tripsavvy.com/climbing-facts-about-abruzzi-spur-route-755961", "https://www.camptocamp.org/routes/642156"],
    "Published Abruzzi climbing gain is 3,311 m from the 5,300 m ridge-foot Advanced Base Camp. Add approximately 300 m for the named Base Camp (5,000 m) to Advanced Base Camp leg in the author's camp profile: approximately 3,600 m overall. Approach distance is a documented derived estimate: geodesic sum of the public author's complete 12-point Base Camp-to-main-summit map line, 8.135 km, rounded to 8.1 km. Sparse mapping may omit small bends/undulations. The multi-day Baltoro trek and repeated carries are excluded. No navigable track is supplied."),
  makalu: reference("Advanced Base Camp to Makalu summit via Northwest Ridge; lower approach excluded", 2800, 8.9,
    ["https://alpenglowexpeditions.com/wp-content/uploads/2026/03/Makalu-Trip-Packet-2026.pdf.pdf"],
    "Operator outbound camp gains: 1,700 + 1,400 + 2,700 + 3,300 ft = 2,774 m, rounded to 2,800 m. Outbound distances 1.5 + 1 + 1 miles, then (5 - 1) / 2 miles for C3-to-summit: the published 5-mile summit day returns to C2, so remove the known 1-mile C3–C2 descent before halving the shared summit leg. Total 5.5 miles / 8.9 km. Helicopter/lower approach to Advanced Base Camp and acclimatisation rotations excluded."),
  "cho-oyu": reference("Advanced Base Camp to Cho Oyu summit via Northwest Ridge", 2350, 8,
    ["https://alpenglowexpeditions.com/wp-content/uploads/2024/05/Cho-Oyu-Trip-Packet.pdf"],
    "Operator outbound moves: 2,300 + 2,400 + 3,000 ft gain = 2,347 m, rounded to 2,350 m. Outbound 2.8 + 1.2 + 1 miles = 8.0 km. The summit-day table separates its 1-mile ascent from its 2.25-mile descent; descent is not included or halved into the ascent. Road/lower trek to Advanced Base Camp and rotations excluded."),
  dhaulagiri: reference("Dhaulagiri Base Camp to main summit via Northeast Ridge", 3450, 9.3,
    ["https://www.camptocamp.org/routes/1096728"],
    "Public author's Northeast Ridge route publishes 3,467 m ascent, rounded to 3,450 m. Complete outbound approach length is derived from the same author's seven-point Base Camp-to-summit map line: 9.303 km, rounded to 9.3 km. This is sparse schematic mapping, not a surveyed trail or exact-uphill measurement. Starts at the route's 4,700 m Base Camp; Marpha/Col Français access trek, repeated carries and return excluded."),
  manaslu: reference("Manaslu Base Camp to true summit via Northeast Face normal route", 3350, 12,
    ["https://manaslucircuittreks.com/distance-from-manaslu-base-camp-to-the-summit-of-mount-manaslu"],
    "Publisher gives approximately 3,363 m overall climbing gain and explicitly labels about 12 km one-way as a rough map estimate from Base Camp to the true summit. Gain rounded to 3,350 m. This is an approximate overall gain, not a claim of surveyed cumulative ascent; small undulations may be omitted. Samagaon approach, rotations and post-summit return excluded."),
  "gasherbrum-2": reference("Gasherbrum Base Camp to Gasherbrum II summit via Southwest Ridge", 2850, 10.5,
    ["https://alpenglowexpeditions.com/wp-content/uploads/2023/08/Gasherbrum-II-Packet.pdf"],
    "Uses the operator's GII narrative itinerary, not its separate GI extension: 2,600 + 1,600 + 2,000 + 3,100 ft gain = 2,835 m, rounded to 2,850 m. Outbound distances 5 + 0.5 + 0.5 miles, then (1.5 - 0.5) / 2 miles for C3-to-summit. The narrative summit day returns to C2; remove the known C3–C2 leg before halving the common summit section. Total 6.5 miles / 10.5 km. The summary table's inconsistent return-camp labels are not used. Baltoro approach, rotations and descent excluded."),
  ojos: reference("Refugio Universidad de Atacama via Refugio Tejos to Ojos del Salado summit", 1650, 6.7,
    ["https://revistadigital.culturademontania.org.ar/articulo/646cc94cfc0d3efac6f6e76c"],
    "Route 1 normal approach: published 1,643 m gain, rounded to 1,650 m; 3.7 km Atacama–Tejos plus 3 km Tejos–summit = 6.7 km. Conventional 4×4 access to Refugio Universidad de Atacama assumed. Walk from Atacama: no vehicle lift to Tejos. Excludes the Laguna Verde approach and post-summit descent. Summit tower is technical and exposed; this is not equivalent to UK walking."),
  ebc: reference("Lukla via Namche to Everest Base Camp — published sleeping-at-Base-Camp acclimatisation itinerary", 5050, 85.3,
    ["https://iantaylortrekking.com/the-everest-region/sleeping-at-everest-base-camp/"],
    "One consistently defined outbound itinerary, shared by both EBC variants. Sum of published daily gains before first Base Camp arrival: 315 + 740 + 120 + 460 + (260 + 600) + 518 + 490 + 520 + 725 + 300 = 5,048 m, rounded to 5,050 m. Corresponding distances 13 + 8 + 1 + 3 + 12 + 12 + 3 + 12 + 8 + 3.3 = 85.3 km. Includes this itinerary's pre-Base-Camp acclimatisation walks, including Kala Patthar before Base Camp; excludes every post-Base-Camp return day. Flights to Lukla assumed. Endpoint is Everest Base Camp, never Everest summit; not the shorter no-side-trip 62–65 km itinerary."),
  batian: reference("Shipton's Camp to Mount Kenya's Batian summit via North Face Standard Route", 1000, 1.7,
    ["https://www.camptocamp.org/routes/786499", "https://www.camptocamp.org/routes/1578211"],
    "North Face author publishes 1,000 m ascent from Shipton's Camp. Approach distance is a rounded derived estimate from the second author's public expedition map: only the Shipton's Camp-to-Batian leg (map points 20–24), about 1.54 km, plus the approximately 130 m gap to the main-summit position, rounded to 1.7 km. Sparse author mapping, not a precise climbing track; small deviations may be omitted. Excludes the earlier Point Lenana circuit, other itinerary days and descent. Batian is technical rock climbing, not Point Lenana trekking."),
  grossglockner: reference("Lucknerhaus via Stüdlhütte and Adlersruhe to Grossglockner summit", 1900, 8,
    ["https://www.bergfuehrer-kals.at/touren-aktivitaeten/tour/grossglockner-normalanstieg-mit-naechtigung-stuedlhuette", "https://www.bergsteigen.com/touren/hochtour/grossglockner-normalweg"],
    "Local guides publish 1,900 m ascent and 16 km for the normal return outing; the independent route description explicitly returns by the ascent route. Retain ascent and halve only same-route return distance: 8 km approach. Road access to Lucknerhaus and an overnight hut stop assumed; not a start at Stüdlhütte with Lucknerhaus figures. Glaciated, exposed alpine route."),
  jungfrau: reference("Konkordiahütte via Jungfraufirn and Rottalsattel to Jungfrau summit", 1600, 10.8,
    ["https://www.camptocamp.org/routes/45560"],
    "Uses the author's conventional Konkordiahütte-start normal-route variant, not a mixture with the shorter Jungfraujoch-start figures. Public route record publishes 1,600 m ascent, 21.5 km and explicitly 'return_same_way'; keep ascent and halve only distance, rounded to 10.8 km. Hut access is excluded; railway to Jungfraujoch followed by a separately planned hut approach is assumed. Glacier and exposed summit ridge conditions require mountaineering expertise. No claim that a UK stage reproduces that difficulty."),
  eiger: reference("Mittellegihütte to Eiger summit via Mittellegi Ridge; hut approach excluded", 680, 1.5,
    ["https://www.bergwelten.com/t/b/51116", "https://www.camptocamp.org/routes/54714"],
    "Published summit-approach gain 680 m includes the ridge's pre-summit down/up sections. Distance derived from the public author's map, hut to Eiger summit only: 1.529 km, rounded to 1.5 km. The summit point is within about 9 m of the main summit. The remaining South Ridge traverse, Eigerjöcher and railway return are excluded, not halved. Rail access to Eismeer followed by a separately planned hut approach assumed; very exposed technical climbing."),
  bernina: reference("Tschiervahütte via Biancograt and Piz Bianco to Piz Bernina main summit", 1500, 4.3,
    ["https://www.camptocamp.org/routes/53776"],
    "Public author publishes 1,500 m ascent for this Biancograt route. Approach distance is derived from the same public map up to the main Piz Bernina summit, not stopping at Piz Bianco: 4.257 km to the nearest mapped summit point plus approximately 51 m, rounded to 4.3 km. Excludes the following Marco e Rosa descent and does not halve the traverse. Hut approach excluded; valley walk to Tschiervahütte separately required. Sparse mapped estimate, not a navigable track or a technical-readiness equivalence."),
  carstensz: reference("Helicopter-access Yellow Valley Base Camp to Carstensz Pyramid via normal North Face / summit ridge", 680, 1.2,
    ["https://alpenglowexpeditions.com/expedition/carstensz-pyramid-expedition"],
    "Operator summit day publishes 684 m ascent and 1–2 miles for the Base Camp-to-summit-and-same-route-return outing. Ascent rounded to 680 m. Midpoint 1.5 miles of that same outing, then halve for the approach = 0.75 miles / 1.2 km (roughly 0.8–1.6 km approach range). Includes the camp approach and ridge, not just technical pitch length. Helicopter access assumed; jungle approach excluded. Highly technical rock, fixed lines and exposure."),
  "ama-dablam": reference("Ama Dablam Base Camp via Yak Camp, C1 and C2.7 to summit on Southwest Ridge", 2300, 7.4,
    ["https://alpenglowexpeditions.com/wp-content/uploads/2026/02/Ama-Dablam-Rapid-Ascent-Trip-Packet.pdf"],
    "Published outbound gains 2,000 + 1,500 + 2,300 + 1,725 ft = 2,294 m, rounded to 2,300 m. Camp legs before the summit section: 2.5 + 1 + 0.75 miles. Summit day gives 0.6–1.6 miles depending on return to C2.7 or C1: remove the nonshared C2.7–C1 leg for that latter case, then halve the remaining summit return only. The resulting estimates for the same complete outbound approach are about 7.3–7.5 km; use 7.4 km. Operator camp/summit heights are approximate and do not replace canonical summit altitudes. Lower trek, acclimatisation rotations and descent excluded. Exposed technical climbing."),
};
