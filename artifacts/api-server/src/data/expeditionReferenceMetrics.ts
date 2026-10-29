/** Published planning estimates; no summit-height-to-ascent conversion.
 * Sources and conversion notes travel with every reference in the export.
 */
import { PENDING_RESOLVED_REFERENCES } from "./pendingExpeditionReferenceMetrics";

export type MountainReference = {
  route: string; ascentM: number; approachKm: number;
  sources: string[]; note: string;
};
const ref = (route: string, ascentM: number, approachKm: number, sources: string[], note: string): MountainReference =>
  ({ route, ascentM, approachKm, sources, note });
export const REFERENCE_METRICS: Record<string, MountainReference> = {
  ...PENDING_RESOLVED_REFERENCES,
  "aconcagua": ref("Plaza de Mulas base camp to Aconcagua summit via the Normal Route", 2650, 10.5,
    ["https://www.alpineascents.com/climbs/aconcagua/itinerary/"], "Uses the Normal Route's outbound camp moves: 2,300 + 1,700 + 1,400 + 3,300 ft ascent. Distances 1.5 + 1.5 + 1.5 miles plus half the 4-mile same-route summit-and-return day = 6.5 miles / 10.5 km. Rounded ascent 2,650 m. Excludes the Horcones approach, acclimatisation hikes, duplicate carries and descent. Only the explicit same-route summit-day return distance is halved, never ascent."),
  "vinson": ref("Branscomb Glacier fly-in base camp via Low Camp and High Camp to Vinson summit", 2750, 22.5,
    ["https://www.alpineascents.com/climbs/mount-vinson/itinerary/", "https://fastestknowntime.com/route/mount-vinson-antarctica"], "Operator itinerary: 2,000 + 3,400 + 3,650 ft ascent, rounded from 2,759 m. Outbound 5.5 + 4 miles, plus half the 9-mile summit-and-return day = 14 miles / 22.5 km. Only the same-route summit-day distance is halved. Independent account gives approximately 7 km for that summit leg, consistent with the rounded 7.2 km used here. Fly-in base camp assumed; repeated carries excluded."),
  "rysy": ref("PTTK shelter at Morskie Oko via Czarny Staw to the Polish summit of Rysy (2,499 m)", 1220, 4.7,
    ["https://www.zakopane.pl/en/tourist-area/tourism/tatra-mountains/aktywny-wypoczynek-lato/summer-trails/morskie-oko-czarny-staw-rysy"], "Official Zakopane route sheet: 4.7 km, +1,222 m / -129 m before the summit. Ascent rounded to 1,220 m; includes pre-summit undulations. Starts at the Morskie Oko shelter, excluding the Palenica road approach. Endpoint is the Polish summit, not a claim to reach the slightly higher Slovak summit. Published figures retained in the research search snapshot."),
  "matterhorn": ref("Hörnlihütte to Swiss summit via Hörnli Ridge; hut approach excluded", 1200, 1.7,
    ["https://blackbirdguides.com/blogs/alpine-climbing/the-matterhorn-hornli-ridge-route"], "Reuses the agreed first-batch comparison. Technical alpine climbing, not equivalent to local walking."),
  "mont-blanc": ref("Nid d'Aigle to summit via Goûter; tram access assumed", 2400, 9,
    ["https://www.chamoniarde.com/vos-activites/mont-blanc", "https://www.expedreview.com/blog/comparing-the-different-mountaineering-routes-on-mont-blanc"], "Reuses the agreed first-batch comparison. Tram journey and post-summit descent excluded."),
  "kilimanjaro": ref("Machame Gate to Uhuru via the seven-day Machame approach; Mweka descent excluded", 5000, 40,
    ["https://www.tranquilkilimanjaro.com/elevation-gain-on-your-kilimanjaro-trek-for-lemosho-machame-and-marangu-routes/", "https://www.ultimatekilimanjaro.com/machame-route/"], "Reuses the agreed first-batch comparison: midpoint of 4,800–5,200 m for this route, including pre-summit acclimatisation descents/re-ascents."),
  "denali": ref("Kahiltna Glacier air-taxi base camp to summit via West Buttress", 4100, 26.7,
    ["https://www.summitpost.org/west-buttress/159690"], "Sum of five outbound legs: 1,000 + 3,200 + 3,200 + 3,000 + 3,120 ft ascent; 5.5 + 4 + 2.8 + 1.8 + 2.5 miles. Rounded from 4,121 m / 26.7 km. Includes initial descent/re-ascent; excludes repeated load carries and acclimatisation rotations. Air taxi to base camp assumed."),
  "elbrus": ref("Garabashi to western summit via South Route; cable-car access, no snowcat", 1800, 6.4,
    ["https://www.thebestviewpoints.com/2025/01/01/peak-44-russia-elbrus/"], "Publisher states 1,778 m climbed and 6.4 km one-way, without acclimatisation hikes; ascent rounded to 1,800 m."),
  "lenana": ref("Sirimon Gate via Old Moses and Shipton's Camp to Point Lenana; Chogoria descent excluded", 2550, 32,
    ["http://mountkenyaclimbingtours.com/trip/mtkenya-climb-sirimonchogoria-route"], "Detailed outbound itinerary: 860 + 900 + 785 m; 9 + 17 + 6 km. Rounded from 2,545 m. The overview gives a different middle-leg length: this comparison consistently uses the detailed itinerary. Excludes the acclimatisation circuit and 26 km post-summit Chogoria descent."),
  "whitney": ref("Whitney Portal to Mount Whitney summit via Mount Whitney Trail", 2030, 17.7,
    ["https://highpoint.guide/ca"], "Publisher gives 6,663 ft gain and 22 miles round trip. Retain ascent, halve same-route return distance: 11 miles / 17.7 km. Pre-summit undulations included in the approximate published gain."),
  "rainier": ref("Paradise Ranger Station to Columbia Crest via Disappointment Cleaver", 2750, 14,
    ["https://www.nps.gov/mora/planyourvisit/upload/Disappointment-Cleaver-Routebrief-2017_FINAL.pdf"], "NPS route brief: 2,750 m gain and approximately 13–15 km approach; distance is the midpoint for that same route. No lift access assumed."),
  "shasta": ref("Bunny Flat to summit via Avalanche Gulch", 2150, 8.9,
    ["https://www.shastaavalanche.org/page/frequently-asked-questions-about-climbing-mount-shasta"], "Official avalanche centre: over 7,000 ft of gain and 5–6 miles one-way. Approx. 2,150 m; distance midpoint 5.5 miles / 8.9 km. Conditions can change the line."),
  "toubkal": ref("Imlil via Toubkal Refuge to summit on the normal route", 2430, 17,
    ["https://www.morocco-escape.com/guides/toubkal-trek-guide/"], "Uses the publisher's explicit two outbound legs: 1,467 + 960 m and 12 + 5 km. Rounded from 2,427 m; not the page's inconsistent approximately 2,000 m overview. Refuge overnight assumed; no return leg included."),
  "kinabalu": ref("Timpohon Gate to Low's Peak via the summit trail", 2250, 8.7,
    ["https://sohikers.com/mount-kinabalu", "https://mountkinabalu.com/"], "Published 2,229 m gain and 8.72 km each way, rounded for planning. Published gain approximates the overall climb and may omit small undulations such as the initial dip; not an exact uphill-only measurement."),
  "gran-paradiso": ref("Rifugio Vittorio Emanuele II to Gran Paradiso summit; published ski-mountaineering normal ascent", 1330, 5.4,
    ["https://www.bergwelten.com/t/s/37911"], "Publisher's ascent-only stage: 1,330 m gain, 12 m pre-summit descent, 5.4 km to the 4,061 m summit. Hut approach excluded. This is a winter/spring ski-mountaineering reference, not a summer navigable track."),
  "fuji": ref("Fuji Subaru Line 5th Station to Yoshida summit/crater rim via Yoshida Trail", 1450, 6.8,
    ["https://www.fujisan-climb.jp/en/comparison-of-routes/"], "Official ascending-route figures: approximately 1,450 m / 6.8 km. Road/bus access to the fifth station assumed. Endpoint is the Yoshida summit at the crater rim, not a claim to include the additional rim walk to Kengamine."),
  "teide": ref("Montaña Blanca via PNT-07 and PNT-10 Telesforo Bravo to Teide summit; no cable car", 1490, 9,
    ["https://www.tenerifeon.es/en/routes/hiking/pnt-07-montana-blanca-la-rambleta", "https://www.tenerifeon.es/en/routes/hiking/pnt-10-telesforo-bravo"], "Official linear paths: 1,309.08 + 182.54 m cumulative gain; 8.29 + 0.66 km. Rounded from 1,491.62 m / 8.95 km. Includes the final summit section beyond La Rambleta. Permits/access restrictions apply."),
  "monch": ref("Jungfraujoch railway station to Mönch via Southeast Ridge", 650, 2.5,
    ["https://www.outdoor.ch/en/outdoor-mountaineering/moench/"], "Operator: 5 km total, +650 / -650 m, ascending and descending the Southeast Ridge. Half the same-route return distance, retain ascent. Railway to Jungfraujoch assumed; hut detours excluded."),
  "olympus": ref("Prionia via Spilios Agapitos Refuge and Skala to Mytikas", 1830, 11.5,
    ["https://mountolympus.gr/area/e4-route/other-routes/prionia-zolota-skala-mytikas/?lang=en_GB", "https://globalsummitguide.com/mountains-mount-olympus-greece"], "Published combined uphill route: 11.5 km / +1,830 m. Road access to Prionia assumed. Includes the Skala–Mytikas scrambling section; technical risk is not reproduced by the local challenge."),
  "triglav": ref("Krma Valley via Kredarica to Triglav summit", 1950, 11.5,
    ["https://triglavtours.com/climbing-triglav", "https://www.visitmojstrana.si/en/tours/triglav-krma-valley-across-kredarica-2-515-m"], "Published Krma approach: 1,955 m gain / 11.5 km, rounded to 1,950 m. Includes protected climbing; not a claim of equivalent local technical readiness."),
  "carrauntoohil": ref("Cronin's Yard to Carrauntoohil via Devil's Ladder, Republic of Ireland", 900, 5.9,
    ["https://www.thebestviewpoints.com/2025/07/08/peak-19-ireland-carrauntoohil/", "https://kerrymountainrescue.ie/carrauntoohil-route-descriptions/"], "Published 881 m / 5.9 km one-way; ascent rounded. Uses a conventional measured ascent rather than the Coomloughra Horseshoe research lead: no circular-walk distance was halved. Republic of Ireland target retained."),
  "kosciuszko": ref("Charlotte Pass to Mount Kosciuszko via Summit Walk", 430, 9.3,
    ["https://www.beyondtracks.com/walks/kosciuszko-national-park/mount-kosciuszko-summit-walk-from-charlotte-pass", "https://www.nationalparks.nsw.gov.au/things-to-do/walking-tracks/mount-kosciuszko-summit-walk"], "428 m published gain rounded to 430 m. Official 18.6 km return on the same route, halved to 9.3 km approach; ascent is not halved."),
};
