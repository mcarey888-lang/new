import type { Stage } from "./summitChallengeBatch";

/** Additions are isolated from the already reviewed 28 challenges: enlarging
 * a curation pool must never silently select new stages for an old revision.
 */
export const PENDING_SOURCE_IDS = new Set([
  "SIG001", "SIG002", "SIG003", "SIG004", "SIG005", "SIG006", "SIG007",
  "SIG008", "SIG009", "SIG010", "SIG011", "SIG012", "SIG013", "SIG014",
  "SIG016", "SIG020", "SIG021", "SIG033", "SIG034", "SIG036", "SIG037",
  "SIG039", "SIG048", "SIG050", "SIG057", "SIG058", "SIG059", "SIG060",
]);

/** A separate substantial Scottish summit keeps the two approved Eiger
 * editions useful and distinguishable without altering any other stage set.
 */
export const EIGER_BEN_RINNES_STAGE: Stage = {
  id: "478e9dce-d163-44f8-ae12-d66c28412b26", name: "Ben Rinnes", area: "Scotland",
  ascentM: 540, approachDistanceKm: 3.8,
  approach: "Normal path over Round Hill and Roy's Hill to Ben Rinnes summit",
  start: "Ben Rinnes roadside parking area, grid reference NJ284359",
  sources: ["https://www.walkhighlands.co.uk/moray/ben-rinnes.shtml"],
  evidenceNote: "Published 7.5 km / 541 m ascent. The author explicitly recommends returning by the same way. Retain and round ascent to 540 m; halve only distance, 3.75 km rounded to 3.8 km. This is the normal valley-side trailhead, not a contrived upper start.",
  difficulty: "Moderate",
};

export const PENDING_LOCAL_APPROACHES: Stage[] = [
  { id: "943fe1c6-ad6e-474c-8103-99779e791c1e", name: "Cadair Idris - Penygadair", area: "Eryri / Snowdonia",
    ascentM: 730, approachDistanceKm: 5, approach: "Pony Path to the Penygadair main summit", start: "Tŷ Nant car park",
    sources: ["https://www.visitmidwales.co.uk/showmewales/things-to-do/cadair-idris-walking-routes-nrw-p1739631", "https://eryri.gov.wales/walk/pony-path-ty-nant/"],
    evidenceNote: "Published Pony Path: 727 m ascent and 10 km there-and-back. Retain/round ascent to 730 m; halve only same-route return distance to 5 km. Not the longer Llanfihangel route.",
    safetyWarning: "Steep mountain terrain and cliff edges around the summit; navigate in poor visibility and plan a safe return separately." },
  { id: "e48af6c8-0d63-4489-ae59-3e99d547bb9a", name: "Moel Hebog", area: "Eryri / Snowdonia",
    ascentM: 740, approachDistanceKm: 3.4, approach: "Normal ascent from Beddgelert to Moel Hebog summit", start: "Beddgelert village",
    sources: ["https://nearlyuphill.co.uk/2025/07/08/moel-hebog-walk-video-route-guide/"],
    evidenceNote: "Author's Beddgelert out-and-back publishes 2,438 ft ascent (743 m, rounded to 740 m) and shows the summit at 2.13 miles on the distance profile: 3.4 km approach. Not half a different circular route.",
    safetyWarning: "Steep rocky sections may require hands, especially near the summit. Exposure and poor visibility need care; return walking is additional." },
  { id: "8c5dd25e-8dc7-4b9f-b182-f24a7b8821e3", name: "Mam Tor", area: "Peak District",
    ascentM: 360, approachDistanceKm: 4, approach: "Hollowford Road, Hollins Cross and Great Ridge to Mam Tor summit", start: "Castleton Visitor Centre car park",
    sources: ["https://peakdistrictwalks.net/mam-tor-short-walk-from-castleton/"],
    evidenceNote: "Derived from the author's public GPX, clipped at the first Mam Tor summit point (within 10 m of the trusted summit): 4.012 km and 363 m positive published elevation increments, rounded to 4.0 km / 360 m. Includes pre-summit undulations. The subsequent circular descent is excluded, not halved. Public profile models differ slightly; this is a planning estimate, not a supplied track." },
  { id: "024656e2-d3b5-4f35-a03d-c0f042999f11", name: "Lose Hill", area: "Peak District",
    ascentM: 310, approachDistanceKm: 3, approach: "Normal path from Hope to Lose Hill summit", start: "Hope village",
    sources: ["https://peakplaces.co.uk/lose-hill"],
    evidenceNote: "Derived from the author's public mapped GPX, Hope to the first Lose Hill summit point (within 4 m): 2.986 km and 308 m positive published elevation increments, rounded to 3.0 km / 310 m. Stops before the following Great Ridge traverse. No arbitrary circular-walk halving or shared-ridge double credit." },
  { id: "54d55db4-2f09-4cbd-bc8e-f212d1b519c0", name: "Bleaklow Head", area: "Peak District",
    ascentM: 450, approachDistanceKm: 6.5, approach: "Torside Bridge, Pennine Way and Torside Clough to Bleaklow Head", start: "Crowden car park",
    sources: ["https://hillexplorer.com/bleaklow-torside-and-near-black-cloughs"],
    evidenceNote: "Author's public GPX begins at Crowden, not Torside car park. Clip the outbound part at the summit vicinity: 6.386 km / 444 m positive published elevation increments, with approximately 60 m to the canonical summit; rounded planning estimate 6.5 km / 450 m. Excludes the rest of the circular walk. No navigable connector or GPX track is supplied.",
    safetyWarning: "Featureless peat moorland can be difficult to navigate; do not treat a summit credit point as a safe route or descent." },
  { id: "180f6534-46b5-4b37-8e48-048741b0afe6", name: "Shining Tor", area: "Peak District",
    ascentM: 300, approachDistanceKm: 3, approach: "Errwood Hall and Stake Side approach to Shining Tor", start: "Errwood Hall car park, Errwood Reservoir",
    sources: ["https://walkpeakdistrict.com/shining-tor"],
    evidenceNote: "Guide explicitly describes approximately 300 m ascent from the reservoir. Approach length is a rounded derived estimate of about 3 km from its pre-summit described legs (500 m, 1 km and 1 km, plus the car-park/woodland access). This is not half its circular outing and is intentionally approximate; the post-summit ridge and woodland return are excluded." },
  { id: "4129f7e7-666d-4920-899d-f1de566a2afc", name: "Win Hill", area: "Peak District",
    ascentM: 300, approachDistanceKm: 2.3, approach: "Parkin Clough to Win Hill summit", start: "Yorkshire Bridge",
    sources: ["https://www.peakybaggers.com/blog/win-hill-via-parkin-clough"],
    evidenceNote: "Publisher's same-route 4.5 km out-and-back with approximately 300 m ascent. Retain ascent; half distance 2.25 km, rounded to 2.3 km. Not a different Ladybower circular walk.",
    safetyWarning: "Parkin Clough is steep and can be slippery. Plan a suitable safe return." },
  { id: "5da6e630-ca05-4e16-82d8-52f581da49d7", name: "Shutlingsloe", area: "Peak District",
    ascentM: 240, approachDistanceKm: 2.7, approach: "Direct ascent from Wildboarclough to Shutlingsloe summit", start: "Wildboarclough",
    sources: ["https://aliwalks.blogspot.com/2024/07/24th-feb-shuttlingsloe-from.html"],
    evidenceNote: "Author explicitly gives the direct ascent as approximately 790 ft in 1.7 miles: rounded to 240 m / 2.7 km. Uses that outbound segment, not half the whole 3.5-mile outing or a high roadside start." },
].map(stage => ({ ...stage, difficulty: "Hard" }));
