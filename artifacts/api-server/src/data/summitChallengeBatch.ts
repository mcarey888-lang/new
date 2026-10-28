/**
 * Owner-agreed approximate challenge batch. Immutable revision IDs protect
 * existing saved plans. These are approach estimates, never navigable tracks.
 */
export const APPROACH_NOTE = "Approach distance is one-way to the summit, including pre-summit undulations. Return walking is additional. Approximate planning figures, not a GPS track or a safe descent plan. Local walks do not reproduce alpine difficulty, altitude or glaciation.";

type Stage = {
  id: string; name: string; ascentM: number; approachDistanceKm: number;
  approach: string; start: string; safetyWarning?: string; evidenceNote?: string;
};
type BatchChallenge = {
  sourceId: string; challengeId: string; title: string; target: string;
  slug: string; region: string; referenceRoute: string;
  referenceAscentM: number; referenceApproachKm: number;
  comparison: string; sources: string[]; stages: Stage[];
};

export const SUMMIT_CHALLENGE_BATCH: BatchChallenge[] = [
  {
    sourceId: "SIG024", challengeId: "SIG024-SUMMITS-1",
    title: "The Welsh Matterhorn", target: "Matterhorn", slug: "matterhorn",
    region: "Eryri / Snowdonia", referenceRoute: "Hörnlihütte to the Swiss summit via Hörnli Ridge, excluding the hut approach",
    referenceAscentM: 1200, referenceApproachKm: 1.7,
    comparison: "Local ascent is 3.3% below the reference; approach distance is 170.6% longer. Ascent is the main equivalence measure, not distance or technical difficulty.",
    sources: ["https://blackbirdguides.com/blogs/alpine-climbing/the-matterhorn-hornli-ridge-route"],
    stages: [
      { id: "76187fe7-2d70-452f-b89e-73526af374a4", name: "Tryfan", ascentM: 600, approachDistanceKm: 2,
        approach: "North Ridge to the main summit", start: "A5 lay-by below the North Ridge near Milestone Buttress",
        safetyWarning: "North Ridge is exposed scrambling requiring route-finding and appropriate experience. Wet, windy or icy conditions increase the risk. Plan a safe descent separately." },
      { id: "da8533db-1fba-4568-bbe5-0649b86237ad", name: "Crib Goch", ascentM: 560, approachDistanceKm: 2.6,
        approach: "Pyg Track approach, East Ridge and crest to the canonical Crib Goch summit", start: "Pen y Pass",
        safetyWarning: "Crib Goch is a very exposed scrambling ridge with serious fall consequences. Suitable experience and conditions are essential. Reaching the credit endpoint does not define a safe descent.",
        evidenceNote: "560 m / 2.6 km is a publisher planning estimate with an inconsistent terrain model. Summit identity and location come from the trusted catalogue, not that terrain model." },
    ],
  },
  {
    sourceId: "SIG054", challengeId: "SIG054-SUMMITS-1",
    title: "The Lake District Mont Blanc", target: "Mont Blanc", slug: "mont-blanc",
    region: "Lake District", referenceRoute: "Nid d'Aigle to summit via Goûter, assuming tram access",
    referenceAscentM: 2400, referenceApproachKm: 9,
    comparison: "Rounded local ascent matches the reference; approach distance is 74.4% longer. This is not an equivalent alpine climb.",
    sources: ["https://www.chamoniarde.com/vos-activites/mont-blanc", "https://www.expedreview.com/blog/comparing-the-different-mountaineering-routes-on-mont-blanc"],
    stages: [
      { id: "f035f006-c2e1-43b4-b1bd-cce2221072ee", name: "Skiddaw", ascentM: 650, approachDistanceKm: 5,
        approach: "Jenkin Hill path from Gale Road", start: "Gale Road car park above Latrigg" },
      { id: "a4bf692f-2b58-463e-9960-a293e6c6a687", name: "Scafell Pike", ascentM: 900, approachDistanceKm: 4.2,
        approach: "Brown Tongue and Hollow Stones from Wasdale", start: "Lake Head National Trust car park, Wasdale" },
      { id: "0a3d3334-cb82-4659-a8bc-9f8658557731", name: "Helvellyn", ascentM: 850, approachDistanceKm: 6.5,
        approach: "Glenridding via Birkhouse Moor and Striding Edge", start: "Glenridding village",
        safetyWarning: "Striding Edge involves exposed scrambling and serious fall risk. Choose suitable conditions and experience, and plan a safe descent separately." },
    ],
  },
  {
    sourceId: "SIG055", challengeId: "SIG055-SUMMITS-1",
    title: "The Yorkshire Kilimanjaro", target: "Kilimanjaro", slug: "kilimanjaro",
    region: "Yorkshire", referenceRoute: "Machame Gate to Uhuru via the seven-day Machame approach, including pre-summit acclimatisation descents and re-ascents; excluding Mweka descent",
    referenceAscentM: 5000, referenceApproachKm: 40,
    comparison: "Local ascent is 8.8% below the reference; approach distance is 26.8% longer. Machame's approximate 5,000 m is the midpoint of a published 4,800–5,200 m range for that route.",
    sources: ["https://www.tranquilkilimanjaro.com/elevation-gain-on-your-kilimanjaro-trek-for-lemosho-machame-and-marangu-routes/", "https://www.ultimatekilimanjaro.com/machame-route/"],
    stages: [
      { id: "8e90bcd9-35a9-456c-aee5-1ceb9a9a67b7", name: "Pen-y-ghent", ascentM: 500, approachDistanceKm: 4.5,
        approach: "Brackenbottom Scar and Pennine Way from Horton-in-Ribblesdale", start: "Horton-in-Ribblesdale National Park car park" },
      { id: "02a57334-867a-440c-9744-a3074da3f3b1", name: "Whernside", ascentM: 450, approachDistanceKm: 4.3,
        approach: "Ribblehead approach via the established northern ascent", start: "Ribblehead" },
      { id: "9bbcba26-82be-430a-9887-27f6112d5c0b", name: "Ingleborough", ascentM: 570, approachDistanceKm: 4.7,
        approach: "Ingleton via Fell Lane and Crina Bottom", start: "Fell Lane parking on the eastern edge of Ingleton" },
      { id: "f7b70cb6-c823-48da-9865-d62f4cffed26", name: "Great Whernside", ascentM: 480, approachDistanceKm: 3.2,
        approach: "Kettlewell via Hag Dyke", start: "Scabbate Gate, Kettlewell",
        evidenceNote: "Approximate race dimensions are used as a walking proxy, not permission to follow race-only lines. Use lawful walking access." },
      { id: "2b176378-13cb-4d28-a373-677575c81147", name: "Buckden Pike", ascentM: 490, approachDistanceKm: 3.1,
        approach: "Buckden Rake and Cow Close approach", start: "Buckden National Park car park" },
      { id: "9158abaa-5398-4f99-8670-49d2950b333c", name: "Great Shunner Fell", ascentM: 460, approachDistanceKm: 7.5,
        approach: "Pennine Way from Hardraw", start: "Hardraw village, west-end Pennine Way access" },
      { id: "46b4d192-eb4b-4a6b-bfde-abccd617abb3", name: "Rogan's Seat", ascentM: 420, approachDistanceKm: 6,
        approach: "Keld via Crackpot Hall and Swinner Gill", start: "Keld" },
      { id: "89f05499-580b-4832-b53f-e9c00e161843", name: "Fountains Fell", ascentM: 390, approachDistanceKm: 4.5,
        approach: "Pennine Way from Tennant Gill", start: "Tennant Gill Farm, near Malham Tarn" },
      { id: "8e01bd2d-4cbd-4027-9ea0-2fa701b149d4", name: "Birks Fell", ascentM: 400, approachDistanceKm: 6.6,
        approach: "Starbotton via the ridge to the actual Birks Fell summit", start: "Starbotton",
        evidenceNote: "Estimate derived from sparse public author waypoints and may omit small undulations." },
      { id: "62a11f4e-41bc-49bb-9954-40db6955646d", name: "Dodd Fell Hill", ascentM: 400, approachDistanceKm: 6.3,
        approach: "Pennine Way from Gayle to Dodd Fell Hill", start: "Gayle, near Wensleydale Creamery",
        evidenceNote: "Estimate derived from sparse public author waypoints and may omit small undulations." },
    ],
  },
];

export function sourceArtworkId(id: string): string {
  return SUMMIT_CHALLENGE_BATCH.find(challenge => challenge.challengeId === id)?.sourceId ?? id;
}
