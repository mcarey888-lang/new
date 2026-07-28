/**
 * Curated Virtual Expedition bundles.
 *
 * Each bundle pairs a famous goal mountain with a UK hiking region.
 * The API fills in the actual recommended local hills at runtime —
 * this file only holds the card metadata used to render the browse grid.
 *
 * First 3 (free: true) are always accessible.
 * The rest require a subscription.
 */

export interface VirtualBundle {
  id: string;
  free: boolean;
  /** Exact name passed to /api/virtual-expedition as targetMountain */
  goalMountain: string;
  /** Passed to API as userLocation */
  region: string;
  /** Shown on the card */
  regionDisplay: string;
  regionCountry: string;
  /** Teaser — shown before API results load */
  exampleHills: string[];
  tagline: string;
  emoji: string;
  difficulty: "Easy" | "Moderate" | "Hard" | "Alpine";
  /** Approximate summit ASL — used for the card only, real figure comes from API */
  summitElevation: number;
  totalElevationGain: number;
  estimatedDays: 1 | 2;
}

export const VIRTUAL_BUNDLES: VirtualBundle[] = [
  // ── FREE (3) ────────────────────────────────────────────────────────────────
  {
    id: "kilimanjaro-snowdonia",
    free: true,
    goalMountain: "Kilimanjaro",
    region: "Snowdonia",
    regionDisplay: "Snowdonia",
    regionCountry: "Wales",
    exampleHills: ["Snowdon", "Glyder Fawr"],
    tagline: "Africa's roof, from the mountains of Wales",
    emoji: "🌍",
    difficulty: "Hard",
    summitElevation: 5895,
    totalElevationGain: 1245,
    estimatedDays: 2,
  },
  {
    id: "mont-blanc-lake-district",
    free: true,
    goalMountain: "Mont Blanc",
    region: "Lake District",
    regionDisplay: "Lake District",
    regionCountry: "England",
    exampleHills: ["Helvellyn", "Scafell Pike"],
    tagline: "The Alps, distilled into a Lake District weekend",
    emoji: "🇫🇷",
    difficulty: "Alpine",
    summitElevation: 4808,
    totalElevationGain: 1500,
    estimatedDays: 2,
  },
  {
    id: "ben-nevis-brecon-beacons",
    free: true,
    goalMountain: "Ben Nevis",
    region: "Brecon Beacons",
    regionDisplay: "Brecon Beacons",
    regionCountry: "Wales",
    exampleHills: ["Pen y Fan", "Fan y Big"],
    tagline: "Scotland's highest, prepared on the Beacons",
    emoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    difficulty: "Hard",
    summitElevation: 1345,
    totalElevationGain: 1345,
    estimatedDays: 1,
  },

  // ── PREMIUM ─────────────────────────────────────────────────────────────────
  {
    id: "everest-base-camp-peak-district",
    free: false,
    goalMountain: "Everest Base Camp Trek",
    region: "Peak District",
    regionDisplay: "Peak District",
    regionCountry: "England",
    exampleHills: ["Kinder Scout", "Bleaklow", "Mam Tor"],
    tagline: "The world's most iconic trek, on home turf",
    emoji: "🏔️",
    difficulty: "Hard",
    summitElevation: 5364,
    totalElevationGain: 3700,
    estimatedDays: 2,
  },
  {
    id: "matterhorn-yorkshire-dales",
    free: false,
    goalMountain: "Matterhorn",
    region: "Yorkshire Dales",
    regionDisplay: "Yorkshire Dales",
    regionCountry: "England",
    exampleHills: ["Whernside", "Ingleborough"],
    tagline: "The iconic pyramid, mirrored in the Three Peaks",
    emoji: "🇨🇭",
    difficulty: "Alpine",
    summitElevation: 4478,
    totalElevationGain: 1220,
    estimatedDays: 2,
  },
  {
    id: "aconcagua-scottish-highlands",
    free: false,
    goalMountain: "Aconcagua",
    region: "Cairngorms",
    regionDisplay: "Scottish Highlands",
    regionCountry: "Scotland",
    exampleHills: ["Cairn Gorm", "Ben Macdui"],
    tagline: "South America's summit, trained in the Cairngorms",
    emoji: "🇦🇷",
    difficulty: "Alpine",
    summitElevation: 6962,
    totalElevationGain: 3000,
    estimatedDays: 2,
  },
  {
    id: "elbrus-cairngorms",
    free: false,
    goalMountain: "Mount Elbrus",
    region: "Cairngorms",
    regionDisplay: "Cairngorms",
    regionCountry: "Scotland",
    exampleHills: ["Ben Macdui", "Braeriach"],
    tagline: "Europe's highest, prepared in Scotland's plateau",
    emoji: "🇷🇺",
    difficulty: "Alpine",
    summitElevation: 5642,
    totalElevationGain: 2200,
    estimatedDays: 2,
  },
  {
    id: "fuji-north-york-moors",
    free: false,
    goalMountain: "Mount Fuji",
    region: "North York Moors",
    regionDisplay: "North York Moors",
    regionCountry: "England",
    exampleHills: ["Urra Moor", "Round Hill"],
    tagline: "Japan's sacred volcano, trained on Yorkshire moors",
    emoji: "🗻",
    difficulty: "Moderate",
    summitElevation: 3776,
    totalElevationGain: 1450,
    estimatedDays: 1,
  },
  {
    id: "snowdon-dartmoor",
    free: false,
    goalMountain: "Snowdon",
    region: "Dartmoor",
    regionDisplay: "Dartmoor",
    regionCountry: "England",
    exampleHills: ["High Willhays", "Yes Tor"],
    tagline: "Wales's crown, trained on Devon's high moor",
    emoji: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    difficulty: "Moderate",
    summitElevation: 1085,
    totalElevationGain: 700,
    estimatedDays: 1,
  },
  {
    id: "denali-lake-district",
    free: false,
    goalMountain: "Denali",
    region: "Lake District",
    regionDisplay: "Lake District",
    regionCountry: "England",
    exampleHills: ["Scafell Pike", "Helvellyn", "Great Gable"],
    tagline: "North America's roof, spread across the fells",
    emoji: "🇺🇸",
    difficulty: "Alpine",
    summitElevation: 6190,
    totalElevationGain: 3000,
    estimatedDays: 2,
  },
  {
    id: "tour-du-mont-blanc-cotswolds",
    free: false,
    goalMountain: "Tour du Mont Blanc",
    region: "Malvern Hills",
    regionDisplay: "Malvern Hills",
    regionCountry: "England",
    exampleHills: ["Worcestershire Beacon", "Herefordshire Beacon"],
    tagline: "Europe's greatest trail, pieced together locally",
    emoji: "🥾",
    difficulty: "Hard",
    summitElevation: 2500,
    totalElevationGain: 3300,
    estimatedDays: 2,
  },
  {
    id: "grand-canyon-south-downs",
    free: false,
    goalMountain: "Grand Canyon Rim to Rim",
    region: "South Downs",
    regionDisplay: "South Downs",
    regionCountry: "England",
    exampleHills: ["Ditchling Beacon", "Devil's Dyke"],
    tagline: "The canyon's epic descent and climb, on chalk downs",
    emoji: "🇺🇸",
    difficulty: "Hard",
    summitElevation: 2480,
    totalElevationGain: 1500,
    estimatedDays: 2,
  },
];

export const FREE_BUNDLE_IDS = new Set(
  VIRTUAL_BUNDLES.filter(b => b.free).map(b => b.id),
);
