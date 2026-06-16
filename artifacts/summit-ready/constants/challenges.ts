export type ChallengeDifficulty = "Beginner" | "Intermediate" | "Advanced" | "Expedition";
export type ChallengeMetric = "elevation" | "hikes";

export interface Milestone {
  pct: number;
  label: string;
  emoji: string;
}

export interface ChallengeTemplate {
  id: string;
  title: string;
  description: string;
  tagline: string;
  metric: ChallengeMetric;
  targetValue: number;
  difficulty: ChallengeDifficulty;
  durationDays: number | null;
  mountain: string;
  emoji: string;
  isPremium: boolean;
  recommendedFor: string[];
  milestones: Milestone[];
  color: string;
}

export const CHALLENGES: ChallengeTemplate[] = [
  {
    id: "everest-basecamp",
    title: "Everest: Base Camp to Summit",
    description:
      "3,485m of elevation — the vertical gain from Everest Base Camp (5,364m) to the summit. The hardest 3.5k you'll ever train for.",
    tagline: "Summit training for the world's highest peak.",
    metric: "elevation",
    targetValue: 3485,
    difficulty: "Advanced",
    durationDays: null,
    mountain: "Everest",
    emoji: "⛺",
    isPremium: true,
    recommendedFor: ["Everest Base Camp trek", "High altitude expeditions"],
    milestones: [
      { pct: 25, label: "Camp I level", emoji: "🏕️" },
      { pct: 50, label: "Camp III level", emoji: "🧊" },
      { pct: 75, label: "South Col reached", emoji: "💀" },
      { pct: 100, label: "Summit — 8,849m", emoji: "🏔️" },
    ],
    color: "#38BDF8",
  },
  {
    id: "everest-sea-level",
    title: "Everest: Sea Level to Summit",
    description:
      "8,849m of total elevation — the full height of Everest from sea level. Accumulated across your local hills, this is the ultimate long-game challenge.",
    tagline: "The full height of Everest. Every metre counts.",
    metric: "elevation",
    targetValue: 8849,
    difficulty: "Expedition",
    durationDays: null,
    mountain: "Everest",
    emoji: "🏔️",
    isPremium: true,
    recommendedFor: ["Everest expedition", "Elite mountain athletes"],
    milestones: [
      { pct: 10, label: "Lukla altitude", emoji: "✈️" },
      { pct: 25, label: "Namche Bazaar level", emoji: "🏘️" },
      { pct: 50, label: "Base Camp reached", emoji: "⛺" },
      { pct: 75, label: "Death Zone entry", emoji: "🧊" },
      { pct: 100, label: "Top of the world", emoji: "🏔️" },
    ],
    color: "#A78BFA",
  },
  {
    id: "1000m-7days",
    title: "1,000m in 7 Days",
    description:
      "One week. One thousand metres. A short, sharp challenge that builds the habit of getting out consistently.",
    tagline: "Small hills. Big goals.",
    metric: "elevation",
    targetValue: 1000,
    difficulty: "Beginner",
    durationDays: 7,
    mountain: "Local Hills",
    emoji: "⛰️",
    isPremium: false,
    recommendedFor: ["Beginners", "Base fitness"],
    milestones: [
      { pct: 25, label: "First quarter done", emoji: "🌱" },
      { pct: 50, label: "Halfway there", emoji: "💚" },
      { pct: 75, label: "Almost there", emoji: "🔥" },
      { pct: 100, label: "Challenge complete", emoji: "✅" },
    ],
    color: "#3ECF75",
  },
  {
    id: "5-hikes-30days",
    title: "5 Hikes in 30 Days",
    description:
      "Five sessions in thirty days. Consistency over intensity — the foundation of every mountain athlete.",
    tagline: "Progress toward your summit one climb at a time.",
    metric: "hikes",
    targetValue: 5,
    difficulty: "Beginner",
    durationDays: 30,
    mountain: "Local Hills",
    emoji: "🥾",
    isPremium: false,
    recommendedFor: ["Beginners", "Explore mode users"],
    milestones: [
      { pct: 20, label: "First hike logged", emoji: "🌱" },
      { pct: 60, label: "Building momentum", emoji: "💪" },
      { pct: 80, label: "Final push", emoji: "🔥" },
      { pct: 100, label: "Consistent climber", emoji: "✅" },
    ],
    color: "#4A9FF5",
  },
  {
    id: "2500m-14days",
    title: "2,500m in 14 Days",
    description:
      "Two weeks of focused elevation training. This is where real base fitness starts to take shape.",
    tagline: "Stop guessing. Build mountain-specific fitness.",
    metric: "elevation",
    targetValue: 2500,
    difficulty: "Intermediate",
    durationDays: 14,
    mountain: "Local Hills",
    emoji: "📈",
    isPremium: false,
    recommendedFor: ["Intermediate", "Kilimanjaro prep"],
    milestones: [
      { pct: 25, label: "Momentum building", emoji: "🌱" },
      { pct: 50, label: "Halfway mark", emoji: "💚" },
      { pct: 75, label: "Strong finish ahead", emoji: "🔥" },
      { pct: 100, label: "Elevation target hit", emoji: "✅" },
    ],
    color: "#F59E0B",
  },
  {
    id: "mont-blanc-elevation",
    title: "Mont Blanc Elevation Challenge",
    description:
      "4,809m of total elevation gain — the height of Mont Blanc. Train for the real thing by climbing it in sections on your local hills.",
    tagline: "Train for big mountains using your local hills.",
    metric: "elevation",
    targetValue: 4809,
    difficulty: "Intermediate",
    durationDays: 30,
    mountain: "Mont Blanc",
    emoji: "🗻",
    isPremium: true,
    recommendedFor: ["Mont Blanc", "Alpine routes"],
    milestones: [
      { pct: 25, label: "Valley start", emoji: "🌿" },
      { pct: 50, label: "High hut ready", emoji: "🏠" },
      { pct: 75, label: "Summit ridge", emoji: "🧗" },
      { pct: 100, label: "Mont Blanc complete", emoji: "🗻" },
    ],
    color: "#A78BFA",
  },
  {
    id: "kilimanjaro-elevation",
    title: "Kilimanjaro Elevation Challenge",
    description:
      "5,895m — the roof of Africa. Use your local hills to simulate the relentless elevation of a Kilimanjaro ascent.",
    tagline: "Climb Africa's highest peak, one local hill at a time.",
    metric: "elevation",
    targetValue: 5895,
    difficulty: "Advanced",
    durationDays: 30,
    mountain: "Kilimanjaro",
    emoji: "🌍",
    isPremium: true,
    recommendedFor: ["Kilimanjaro", "High altitude trekking"],
    milestones: [
      { pct: 25, label: "Rainforest zone", emoji: "🌿" },
      { pct: 50, label: "Moorland zone", emoji: "🌾" },
      { pct: 75, label: "Alpine desert", emoji: "🏜️" },
      { pct: 100, label: "Uhuru Peak", emoji: "🌍" },
    ],
    color: "#F59E0B",
  },
  {
    id: "alpine-legs",
    title: "Alpine Legs Challenge",
    description:
      "6,000m of elevation in 30 days. This is the kind of volume that builds genuine alpine fitness — legs that won't quit on descent.",
    tagline: "Build the legs every alpine route demands.",
    metric: "elevation",
    targetValue: 6000,
    difficulty: "Advanced",
    durationDays: 30,
    mountain: "Alps",
    emoji: "⛷️",
    isPremium: true,
    recommendedFor: ["Mont Blanc", "Matterhorn", "Alpine routes"],
    milestones: [
      { pct: 25, label: "Legs warming up", emoji: "🦵" },
      { pct: 50, label: "Alpine conditioning", emoji: "💪" },
      { pct: 75, label: "Summit-ready strength", emoji: "🔥" },
      { pct: 100, label: "Alpine legs earned", emoji: "⛷️" },
    ],
    color: "#EF4444",
  },
  {
    id: "aconcagua-prep",
    title: "Aconcagua Expedition Prep",
    description:
      "10,000m over 60 days — the volume you need before attempting the highest peak in the Americas. This is expedition-level preparation.",
    tagline: "Expedition fitness starts at your local hill.",
    metric: "elevation",
    targetValue: 10000,
    difficulty: "Expedition",
    durationDays: 60,
    mountain: "Aconcagua",
    emoji: "🏔️",
    isPremium: true,
    recommendedFor: ["Aconcagua", "High altitude expeditions"],
    milestones: [
      { pct: 25, label: "Expedition base", emoji: "⛺" },
      { pct: 50, label: "High camp ready", emoji: "🏕️" },
      { pct: 75, label: "Summit push", emoji: "🧗" },
      { pct: 100, label: "Aconcagua prep complete", emoji: "🏔️" },
    ],
    color: "#EF4444",
  },

  // ── UK Multi-Peak Challenges ─────────────────────────────────────────────────

  {
    id: "yorkshire-3-peaks",
    title: "Yorkshire Three Peaks",
    description:
      "Pen-y-Ghent (694m), Whernside (736m), and Ingleborough (723m) — 39km with 1,585m of ascent in the Yorkshire Dales. The original British multi-peak challenge, first completed in 1887. Tradition says under 12 hours.",
    tagline: "Three Dales peaks. One epic day.",
    metric: "elevation",
    targetValue: 1585,
    difficulty: "Intermediate",
    durationDays: 1,
    mountain: "Yorkshire Dales",
    emoji: "🐑",
    isPremium: true,
    recommendedFor: ["Yorkshire Three Peaks", "Intermediate hikers", "Day challenges"],
    milestones: [
      { pct: 30, label: "Pen-y-Ghent summit", emoji: "⛰️" },
      { pct: 62, label: "Whernside summit", emoji: "🌾" },
      { pct: 90, label: "Ingleborough summit", emoji: "🔥" },
      { pct: 100, label: "Back in Horton — done!", emoji: "✅" },
    ],
    color: "#3ECF75",
  },
  {
    id: "national-3-peaks",
    title: "National Three Peaks",
    description:
      "Ben Nevis (1,345m), Scafell Pike (978m), and Snowdon (1,085m) — the highest peaks in Scotland, England, and Wales. Around 3,000m of combined ascent, traditionally completed in 24 hours with driving between peaks.",
    tagline: "Three countries. Three summits. 24 hours.",
    metric: "elevation",
    targetValue: 3000,
    difficulty: "Advanced",
    durationDays: 1,
    mountain: "UK National Peaks",
    emoji: "🏔️",
    isPremium: true,
    recommendedFor: ["National Three Peaks", "Endurance hikers", "UK challenges"],
    milestones: [
      { pct: 45, label: "Ben Nevis — Scotland done", emoji: "🏔️" },
      { pct: 75, label: "Scafell Pike — England done", emoji: "⛰️" },
      { pct: 100, label: "Snowdon — all three nations", emoji: "🎉" },
    ],
    color: "#EF4444",
  },
  {
    id: "welsh-3-peaks",
    title: "Welsh Three Peaks",
    description:
      "Snowdon (1,085m), Cadair Idris (893m), and Pen y Fan (886m) — the three iconic peaks spread across Wales. Around 2,500m of total ascent, usually tackled with driving between start points in 24 hours.",
    tagline: "Wales's three great summits in a single push.",
    metric: "elevation",
    targetValue: 2500,
    difficulty: "Intermediate",
    durationDays: 1,
    mountain: "Wales",
    emoji: "🐉",
    isPremium: true,
    recommendedFor: ["Welsh Three Peaks", "Snowdonia", "Intermediate challenges"],
    milestones: [
      { pct: 43, label: "Snowdon summit", emoji: "🏔️" },
      { pct: 77, label: "Cadair Idris summit", emoji: "⛰️" },
      { pct: 100, label: "Pen y Fan — Wales complete", emoji: "🎉" },
    ],
    color: "#4A9FF5",
  },
  {
    id: "lakeland-3000s",
    title: "Lakeland 3000s",
    description:
      "Scafell Pike (978m), Scafell (964m), Helvellyn (950m), and Skiddaw (931m) — the four Lake District peaks over 3,000 feet. A rugged 72km route with around 3,350m of ascent through England's finest mountain landscape.",
    tagline: "England's four highest summits in one day.",
    metric: "elevation",
    targetValue: 3350,
    difficulty: "Advanced",
    durationDays: 1,
    mountain: "Lake District",
    emoji: "💧",
    isPremium: true,
    recommendedFor: ["Lakeland 3000s", "Lake District", "Advanced UK challenges"],
    milestones: [
      { pct: 29, label: "Scafell Pike — highest in England", emoji: "🏔️" },
      { pct: 55, label: "Scafell summit", emoji: "⛰️" },
      { pct: 79, label: "Helvellyn via Striding Edge", emoji: "🔥" },
      { pct: 100, label: "Skiddaw — Lakeland 3000s done", emoji: "✅" },
    ],
    color: "#38BDF8",
  },
  {
    id: "welsh-3000s",
    title: "Welsh 3000s",
    description:
      "All 15 Welsh summits above 3,000 feet — spanning the Snowdon Massif, the Glyderau, and the Carneddau. Around 50km with 4,200m of ascent, making this arguably the hardest single-day challenge in the UK.",
    tagline: "All 15 Welsh peaks above 3,000ft — in one day.",
    metric: "elevation",
    targetValue: 4200,
    difficulty: "Advanced",
    durationDays: 1,
    mountain: "Snowdonia",
    emoji: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    isPremium: true,
    recommendedFor: ["Welsh 3000s", "Snowdonia", "Elite UK challenges"],
    milestones: [
      { pct: 25, label: "Snowdon Massif complete", emoji: "🏔️" },
      { pct: 55, label: "Glyderau range done", emoji: "⛰️" },
      { pct: 80, label: "Into the Carneddau", emoji: "🔥" },
      { pct: 100, label: "All 15 summits bagged", emoji: "🎉" },
    ],
    color: "#EF4444",
  },
  {
    id: "cairngorms-4000s",
    title: "Cairngorms 4000s",
    description:
      "The five Cairngorm peaks over 4,000 feet — Ben Macdui (1,309m), Braeriach (1,296m), Cairn Toul (1,291m), Sgor an Lochain Uaine (1,258m), and Cairn Gorm (1,244m). Scotland's high plateau at its finest.",
    tagline: "Scotland's five highest peaks on the great plateau.",
    metric: "elevation",
    targetValue: 2800,
    difficulty: "Advanced",
    durationDays: 2,
    mountain: "Cairngorms",
    emoji: "🦌",
    isPremium: true,
    recommendedFor: ["Cairngorms", "Scottish Munros", "Advanced Scotland"],
    milestones: [
      { pct: 30, label: "Cairn Gorm summit", emoji: "⛰️" },
      { pct: 58, label: "Ben Macdui — second highest in UK", emoji: "🏔️" },
      { pct: 80, label: "Braeriach plateau", emoji: "🌬️" },
      { pct: 100, label: "All five Cairngorm 4000s", emoji: "✅" },
    ],
    color: "#F59E0B",
  },
  {
    id: "ring-of-steall",
    title: "Ring of Steall",
    description:
      "Four Munros in a single horseshoe loop above Glen Nevis — Sgurr a'Mhàim (1,099m), An Gearanach (982m), Am Bodach (1,032m), and Stob Coire a'Chàirn (981m). A classic 16km circuit with 1,800m of ascent and a famous wire bridge crossing.",
    tagline: "The finest Munro circuit above Ben Nevis.",
    metric: "elevation",
    targetValue: 1800,
    difficulty: "Intermediate",
    durationDays: 1,
    mountain: "Glen Nevis",
    emoji: "💎",
    isPremium: true,
    recommendedFor: ["Scottish Munros", "Ring of Steall", "Glen Nevis"],
    milestones: [
      { pct: 30, label: "Wire bridge crossed", emoji: "🌉" },
      { pct: 55, label: "Sgurr a'Mhàim summit", emoji: "⛰️" },
      { pct: 80, label: "Am Bodach reached", emoji: "🏔️" },
      { pct: 100, label: "Ring complete — back to Glen Nevis", emoji: "✅" },
    ],
    color: "#A78BFA",
  },
  {
    id: "mourne-7-sevens",
    title: "Mourne Seven Sevens",
    description:
      "Seven peaks above 700m in the Mourne Mountains of Northern Ireland — including Slieve Donard (850m), the highest peak in Northern Ireland. A demanding ridge traverse through one of Ireland's most dramatic landscapes.",
    tagline: "Northern Ireland's seven highest summits in one day.",
    metric: "elevation",
    targetValue: 1900,
    difficulty: "Intermediate",
    durationDays: 1,
    mountain: "Mourne Mountains",
    emoji: "🍀",
    isPremium: true,
    recommendedFor: ["Mourne Mountains", "Northern Ireland", "Irish challenges"],
    milestones: [
      { pct: 25, label: "First two peaks done", emoji: "⛰️" },
      { pct: 50, label: "Slieve Donard — highest point", emoji: "🏔️" },
      { pct: 75, label: "Five down, two to go", emoji: "🔥" },
      { pct: 100, label: "All seven sevens complete", emoji: "🍀" },
    ],
    color: "#3ECF75",
  },

  // ── UK & Ireland — Extended ──────────────────────────────────────────────────

  {
    id: "uk-ireland-5-peaks",
    title: "UK & Ireland Five Peaks",
    description:
      "The five highest peaks across all five nations — Ben Nevis (Scotland), Scafell Pike (England), Snowdon (Wales), Slieve Donard (Northern Ireland), and Carrauntoohil (Ireland). Around 5,300m of combined ascent across a 48-hour push.",
    tagline: "Five nations. Five summits. One unforgettable challenge.",
    metric: "elevation",
    targetValue: 5300,
    difficulty: "Expedition",
    durationDays: 2,
    mountain: "UK & Ireland",
    emoji: "🌊",
    isPremium: true,
    recommendedFor: ["UK & Ireland Five Peaks", "Elite challenges", "Endurance"],
    milestones: [
      { pct: 25, label: "Ben Nevis — Scotland", emoji: "🏔️" },
      { pct: 50, label: "Scafell + Snowdon done", emoji: "⛰️" },
      { pct: 75, label: "Slieve Donard — Northern Ireland", emoji: "🍀" },
      { pct: 100, label: "Carrauntoohil — all five nations", emoji: "🎉" },
    ],
    color: "#A78BFA",
  },
  {
    id: "bob-graham-round",
    title: "Bob Graham Round",
    description:
      "42 Lakeland summits, 106km, and 8,200m of ascent — all within 24 hours. First completed by Bob Graham in 1932, this is the ultimate Lake District endurance challenge and one of the most respected feats in British fell running.",
    tagline: "42 Lakeland summits. 24 hours. The ultimate test.",
    metric: "elevation",
    targetValue: 8200,
    difficulty: "Expedition",
    durationDays: 1,
    mountain: "Lake District",
    emoji: "⚡",
    isPremium: true,
    recommendedFor: ["Bob Graham Round", "Fell running", "Elite endurance"],
    milestones: [
      { pct: 20, label: "Leg 1 complete — Skiddaw group", emoji: "🌙" },
      { pct: 45, label: "Leg 2 — Helvellyn range", emoji: "⛰️" },
      { pct: 70, label: "Leg 3 — Scafell group", emoji: "🔥" },
      { pct: 100, label: "Moot Hall — the round complete", emoji: "⚡" },
    ],
    color: "#EF4444",
  },

  // ── European Classic Routes ──────────────────────────────────────────────────

  {
    id: "tour-du-mont-blanc",
    title: "Tour du Mont Blanc",
    description:
      "A 170km circuit around the Mont Blanc massif through France, Italy, and Switzerland. With 10,000m of cumulative ascent across 7–11 days, the TMB is one of the world's most iconic long-distance mountain treks.",
    tagline: "170km. Three countries. The world's greatest mountain circuit.",
    metric: "elevation",
    targetValue: 10000,
    difficulty: "Advanced",
    durationDays: 11,
    mountain: "Mont Blanc Massif",
    emoji: "🗻",
    isPremium: true,
    recommendedFor: ["Tour du Mont Blanc", "TMB", "Alpine trekking"],
    milestones: [
      { pct: 20, label: "Col de Voza — France begins", emoji: "🇫🇷" },
      { pct: 45, label: "Val Ferret — into Italy", emoji: "🇮🇹" },
      { pct: 70, label: "Swiss Alps — Champex-Lac", emoji: "🇨🇭" },
      { pct: 100, label: "Chamonix — circuit complete", emoji: "🗻" },
    ],
    color: "#A78BFA",
  },
  {
    id: "haute-route",
    title: "Haute Route",
    description:
      "The classic high-level trek from Chamonix to Zermatt — 180km across the heart of the Alps with 12,000m of ascent. Passing beneath Mont Blanc and the Matterhorn, this is one of the finest mountain walks in Europe.",
    tagline: "Chamonix to Zermatt. The roof of the Alps.",
    metric: "elevation",
    targetValue: 12000,
    difficulty: "Advanced",
    durationDays: 14,
    mountain: "Alps",
    emoji: "🏔️",
    isPremium: true,
    recommendedFor: ["Haute Route", "Alpine trekking", "Chamonix", "Zermatt"],
    milestones: [
      { pct: 20, label: "Champex reached", emoji: "🇨🇭" },
      { pct: 45, label: "Col de la Croix du Bonhomme", emoji: "⛰️" },
      { pct: 70, label: "Cabane de Prafleuri", emoji: "🏕️" },
      { pct: 100, label: "Zermatt — Matterhorn in view", emoji: "🏔️" },
    ],
    color: "#38BDF8",
  },
  {
    id: "gr20-corsica",
    title: "GR20 — Corsica",
    description:
      "The GR20 traverses the rugged spine of Corsica from Calenzana to Conca — 180km with 13,000m of ascent, often called the toughest long-distance trail in Europe. Dramatic granite ridges, alpine lakes, and wild camping.",
    tagline: "Europe's toughest long-distance trail. 15 days of granite.",
    metric: "elevation",
    targetValue: 13000,
    difficulty: "Advanced",
    durationDays: 15,
    mountain: "Corsica",
    emoji: "🌊",
    isPremium: true,
    recommendedFor: ["GR20", "Corsica", "European long routes"],
    milestones: [
      { pct: 20, label: "Refuge de Carozzu", emoji: "🏕️" },
      { pct: 45, label: "Monte Cinto — highest point", emoji: "🏔️" },
      { pct: 70, label: "Vizzavona — midpoint", emoji: "🌲" },
      { pct: 100, label: "Conca — GR20 complete", emoji: "🌊" },
    ],
    color: "#F59E0B",
  },
  {
    id: "dolomites-tre-cime",
    title: "Dolomites Tre Cime Loop",
    description:
      "A 9km circuit around the iconic Tre Cime di Lavaredo — three towering rock spires in South Tyrol, Italy. One of the most photographed landscapes in the Alps, this accessible loop gains around 500m and is achievable by most hikers.",
    tagline: "Three towers. The most iconic view in the Dolomites.",
    metric: "elevation",
    targetValue: 500,
    difficulty: "Beginner",
    durationDays: 1,
    mountain: "Dolomites",
    emoji: "🗼",
    isPremium: false,
    recommendedFor: ["Dolomites", "Italy", "Accessible Alpine hiking"],
    milestones: [
      { pct: 40, label: "Rifugio Lavaredo reached", emoji: "🏠" },
      { pct: 75, label: "North face of Tre Cime in view", emoji: "📸" },
      { pct: 100, label: "Loop complete — Tre Cime done", emoji: "🗼" },
    ],
    color: "#3ECF75",
  },
  {
    id: "eiger-trail",
    title: "Eiger Trail",
    description:
      "A dramatic 15km high-level trail below the sheer north face of the Eiger in the Bernese Oberland, Switzerland — with around 1,700m of total ascent and stunning views of Grindelwald, the Jungfrau, and the Mönch.",
    tagline: "Walk beneath the most famous north face in the Alps.",
    metric: "elevation",
    targetValue: 1700,
    difficulty: "Intermediate",
    durationDays: 1,
    mountain: "Eiger",
    emoji: "🧗",
    isPremium: true,
    recommendedFor: ["Eiger", "Grindelwald", "Bernese Oberland"],
    milestones: [
      { pct: 30, label: "Eigergletscher station", emoji: "🚠" },
      { pct: 60, label: "Beneath the north face", emoji: "🧗" },
      { pct: 85, label: "Alpiglen meadows", emoji: "🌿" },
      { pct: 100, label: "Grindelwald — Eiger Trail done", emoji: "✅" },
    ],
    color: "#4A9FF5",
  },
  {
    id: "all-wainwrights",
    title: "All 214 Wainwrights",
    description:
      "Every one of Alfred Wainwright's 214 Lake District fells — from the gentle Latrigg to the dramatic Striding Edge of Helvellyn. Around 35,000m of total ascent across ~540km of some of England's finest mountain terrain. No time limit. This one might take years.",
    tagline: "214 Lake District fells. The ultimate tick list.",
    metric: "elevation",
    targetValue: 35000,
    difficulty: "Expedition",
    durationDays: null,
    mountain: "Lake District",
    emoji: "📖",
    isPremium: true,
    recommendedFor: ["Wainwrights", "Lake District", "Long-term challenges", "Fell walking"],
    milestones: [
      { pct: 10,  label: "First 21 fells bagged",          emoji: "📖" },
      { pct: 25,  label: "Over 50 Wainwrights",            emoji: "🥾" },
      { pct: 50,  label: "Halfway — 107 fells",            emoji: "⛰️" },
      { pct: 75,  label: "Into the final stretch",         emoji: "🔥" },
      { pct: 100, label: "All 214 — a Wainwright compleat", emoji: "📖" },
    ],
    color: "#F59E0B",
  },
];

export const DIFF_COLOR: Record<ChallengeDifficulty, string> = {
  Beginner: "#3ECF75",
  Intermediate: "#F59E0B",
  Advanced: "#EF4444",
  Expedition: "#A78BFA",
};

export function getChallenge(id: string): ChallengeTemplate | undefined {
  return CHALLENGES.find(c => c.id === id);
}
