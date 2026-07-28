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

export type BundleCategory = "Alpine" | "Trek" | "Technical" | "Classic";

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
  /** Small flag emoji shown next to mountain name */
  flag: string;
  difficulty: "Easy" | "Moderate" | "Hard" | "Alpine";
  /** Approximate summit ASL — used for the card only, real figure comes from API */
  summitElevation: number;
  totalElevationGain: number;
  estimatedDays: 1 | 2;
  /** Card category — drives accent colour throughout the card */
  category: BundleCategory;
  /** Human-readable typical duration for this objective */
  duration: string;
  /** Country / region string shown in the subtitle */
  country: string;
  /** Contextual 4th badge */
  contextBadge: string;
  /** Label shown in the first stat badge (route type) — e.g. "Alpine", "Trek", "Mountain" */
  routeTypeLabel: string;
  /**
   * Optional hero image — pass a require() result when a mountain photo is available.
   * Falls back to the category gradient when absent.
   * e.g. heroImage: require("@/assets/images/mountains/mont-blanc.jpg")
   */
  heroImage?: number;
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
    exampleHills: ["Snowdon", "Glyder Fawr", "Tryfan"],
    tagline: "Every step to the roof of Africa demands unshakeable mental endurance — exactly the kind you forge on dark, rainy Welsh mornings.",
    emoji: "🏔️",
    flag: "🇹🇿",
    difficulty: "Hard",
    summitElevation: 5895,
    totalElevationGain: 1245,
    estimatedDays: 2,
    category: "Trek",
    duration: "7–8 Days",
    country: "Tanzania",
    contextBadge: "High Altitude",
    routeTypeLabel: "Trek",
  },
  {
    id: "mont-blanc-lake-district",
    free: true,
    goalMountain: "Mont Blanc",
    region: "Lake District",
    regionDisplay: "Lake District",
    regionCountry: "England",
    exampleHills: ["Helvellyn", "Scafell Pike", "Great Gable"],
    tagline: "The roof of the Alps rewards those who dare to summit after summit. The Lake District fells are your proving ground.",
    emoji: "⛰️",
    flag: "🇫🇷",
    difficulty: "Alpine",
    summitElevation: 4808,
    totalElevationGain: 1500,
    estimatedDays: 2,
    category: "Alpine",
    duration: "2–3 Days",
    country: "France / Italy",
    contextBadge: "High Altitude",
    routeTypeLabel: "Alpine",
  },
  {
    id: "ben-nevis-brecon-beacons",
    free: true,
    goalMountain: "Ben Nevis",
    region: "Brecon Beacons",
    regionDisplay: "Brecon Beacons",
    regionCountry: "Wales",
    exampleHills: ["Pen y Fan", "Fan y Big", "Corn Du"],
    tagline: "Britain's highest is the perfect first big mountain adventure. Every Brecon Beacons ridge brings you one step closer.",
    emoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    difficulty: "Hard",
    summitElevation: 1345,
    totalElevationGain: 1345,
    estimatedDays: 1,
    category: "Classic",
    duration: "1 Day",
    country: "Scotland",
    contextBadge: "Great for Beginners",
    routeTypeLabel: "Mountain",
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
    tagline: "EBC rewards relentless willpower across 14 grinding days at altitude. Your Peak District miles are building exactly that resilience.",
    emoji: "🏔️",
    flag: "🇳🇵",
    difficulty: "Hard",
    summitElevation: 5364,
    totalElevationGain: 3700,
    estimatedDays: 2,
    category: "Trek",
    duration: "14 Days",
    country: "Nepal",
    contextBadge: "High Altitude",
    routeTypeLabel: "Trek",
  },
  {
    id: "matterhorn-yorkshire-dales",
    free: false,
    goalMountain: "Matterhorn",
    region: "Yorkshire Dales",
    regionDisplay: "Yorkshire Dales",
    regionCountry: "England",
    exampleHills: ["Whernside", "Ingleborough", "Pen-y-Ghent"],
    tagline: "The Matterhorn's near-vertical ridges demand precise, calm technical movement. There is no room for hesitation at 4,478m.",
    emoji: "🗻",
    flag: "🇨🇭",
    difficulty: "Alpine",
    summitElevation: 4478,
    totalElevationGain: 1220,
    estimatedDays: 2,
    category: "Technical",
    duration: "2 Days",
    country: "Switzerland",
    contextBadge: "Technical",
    routeTypeLabel: "Alpine",
  },
  {
    id: "aconcagua-scottish-highlands",
    free: false,
    goalMountain: "Aconcagua",
    region: "Cairngorms",
    regionDisplay: "Scottish Highlands",
    regionCountry: "Scotland",
    exampleHills: ["Cairn Gorm", "Ben Macdui", "Braeriach"],
    tagline: "At 6,962m, Aconcagua's altitude is the real challenge. Scotland's exposed plateau teaches you the relentless conditions you'll face.",
    emoji: "⛰️",
    flag: "🇦🇷",
    difficulty: "Alpine",
    summitElevation: 6962,
    totalElevationGain: 3000,
    estimatedDays: 2,
    category: "Alpine",
    duration: "20 Days",
    country: "Argentina",
    contextBadge: "High Altitude",
    routeTypeLabel: "Alpine",
  },
  {
    id: "elbrus-cairngorms",
    free: false,
    goalMountain: "Mount Elbrus",
    region: "Cairngorms",
    regionDisplay: "Cairngorms",
    regionCountry: "Scotland",
    exampleHills: ["Ben Macdui", "Braeriach", "Cairn Toul"],
    tagline: "Europe's highest peak rewards the patient, resilient climber who has spent long hours on cold, windswept ridges.",
    emoji: "⛰️",
    flag: "🇷🇺",
    difficulty: "Alpine",
    summitElevation: 5642,
    totalElevationGain: 2200,
    estimatedDays: 2,
    category: "Alpine",
    duration: "8 Days",
    country: "Russia",
    contextBadge: "High Altitude",
    routeTypeLabel: "Alpine",
  },
  {
    id: "fuji-north-york-moors",
    free: false,
    goalMountain: "Mount Fuji",
    region: "North York Moors",
    regionDisplay: "North York Moors",
    regionCountry: "England",
    exampleHills: ["Urra Moor", "Round Hill", "Cringle Moor"],
    tagline: "Japan's sacred volcano is a bucket-list icon any fit hiker can conquer. This is where your bigger ambitions begin.",
    emoji: "🗻",
    flag: "🇯🇵",
    difficulty: "Moderate",
    summitElevation: 3776,
    totalElevationGain: 1450,
    estimatedDays: 1,
    category: "Classic",
    duration: "1–2 Days",
    country: "Japan",
    contextBadge: "Iconic Summit",
    routeTypeLabel: "Mountain",
  },
  {
    id: "snowdon-dartmoor",
    free: false,
    goalMountain: "Snowdon",
    region: "Dartmoor",
    regionDisplay: "Dartmoor",
    regionCountry: "England",
    exampleHills: ["High Willhays", "Yes Tor", "Brown Willy"],
    tagline: "Wales's crown is an achievable adventure for any determined hill-goer. Your Dartmoor miles will get you there comfortably.",
    emoji: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    difficulty: "Moderate",
    summitElevation: 1085,
    totalElevationGain: 700,
    estimatedDays: 1,
    category: "Classic",
    duration: "1 Day",
    country: "Wales",
    contextBadge: "Great for Beginners",
    routeTypeLabel: "Mountain",
  },
  {
    id: "denali-lake-district",
    free: false,
    goalMountain: "Denali",
    region: "Lake District",
    regionDisplay: "Lake District",
    regionCountry: "England",
    exampleHills: ["Scafell Pike", "Helvellyn", "Great Gable"],
    tagline: "Denali is a serious, multi-week mountaineering objective. It requires elite fitness, precise technique, and absolute commitment.",
    emoji: "⛰️",
    flag: "🇺🇸",
    difficulty: "Alpine",
    summitElevation: 6190,
    totalElevationGain: 3000,
    estimatedDays: 2,
    category: "Technical",
    duration: "21 Days",
    country: "Alaska, USA",
    contextBadge: "Technical",
    routeTypeLabel: "Alpine",
  },
  {
    id: "tour-du-mont-blanc-cotswolds",
    free: false,
    goalMountain: "Tour du Mont Blanc",
    region: "Malvern Hills",
    regionDisplay: "Malvern Hills",
    regionCountry: "England",
    exampleHills: ["Worcestershire Beacon", "Herefordshire Beacon", "North Hill"],
    tagline: "165km around the Alps tests your mind as much as your legs. Your local days are building the deep, quiet endurance you'll need.",
    emoji: "🥾",
    flag: "🇫🇷",
    difficulty: "Hard",
    summitElevation: 2500,
    totalElevationGain: 3300,
    estimatedDays: 2,
    category: "Trek",
    duration: "11 Days",
    country: "France / Italy / Switzerland",
    contextBadge: "Multi-Day",
    routeTypeLabel: "Trek",
  },
  {
    id: "grand-canyon-south-downs",
    free: false,
    goalMountain: "Grand Canyon Rim to Rim",
    region: "South Downs",
    regionDisplay: "South Downs",
    regionCountry: "England",
    exampleHills: ["Ditchling Beacon", "Devil's Dyke", "Chanctonbury Ring"],
    tagline: "Rim to Rim is a lesson in pacing, heat management, and pure stubbornness. The South Downs are your engine room.",
    emoji: "🏜️",
    flag: "🇺🇸",
    difficulty: "Hard",
    summitElevation: 2480,
    totalElevationGain: 1500,
    estimatedDays: 2,
    category: "Trek",
    duration: "3 Days",
    country: "Arizona, USA",
    contextBadge: "Desert Terrain",
    routeTypeLabel: "Trail",
  },
];

export const FREE_BUNDLE_IDS = new Set(
  VIRTUAL_BUNDLES.filter(b => b.free).map(b => b.id),
);
