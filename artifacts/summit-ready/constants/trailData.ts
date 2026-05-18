export type TrailDifficulty = "Easy" | "Moderate" | "Hard";
export type TrailTerrain = "woodland" | "hill" | "mountain" | "coastal" | "road" | "mixed";
export type TrailRouteType = "loop" | "out-and-back" | "point-to-point";
export type TrailBestFor = "training" | "family walk" | "summit prep" | "scenic walk";
export type TrailBenefit = "cardio" | "elevation" | "endurance" | "pack weight";

export interface Trail {
  id: string;
  name: string;
  location: string;
  distance: number;
  elevationGain: number;
  estimatedTime: string;
  difficulty: TrailDifficulty;
  terrain: TrailTerrain;
  routeType: TrailRouteType;
  bestFor: TrailBestFor[];
  description: string;
  trainingBenefits: TrailBenefit[];
  emoji: string;
  lat?: number;
  lng?: number;
  isCustom?: boolean;
  notes?: string;
  createdAt?: string;
}

export const SAMPLE_TRAILS: Trail[] = [
  {
    id: "t001",
    name: "Kinder Scout Circular",
    location: "Peak District, Derbyshire",
    distance: 14.2,
    elevationGain: 490,
    estimatedTime: "5h 30m",
    difficulty: "Hard",
    terrain: "mountain",
    routeType: "loop",
    bestFor: ["summit prep", "training"],
    description:
      "A challenging circular route taking in the vast plateau of Kinder Scout, the highest point in the Peak District. Expect exposed moorland, rocky edges and dramatic views. This is serious mountain terrain — a perfect proving ground before a major alpine summit.",
    trainingBenefits: ["elevation", "endurance", "pack weight"],
    emoji: "🏔️",
  },
  {
    id: "t002",
    name: "Mam Tor & Great Ridge",
    location: "Peak District, Derbyshire",
    distance: 8.4,
    elevationGain: 260,
    estimatedTime: "3h 00m",
    difficulty: "Moderate",
    terrain: "hill",
    routeType: "loop",
    bestFor: ["training", "scenic walk", "family walk"],
    description:
      "One of the Peak District's most iconic walks, following the dramatic shivering mountain ridge to Hollins Cross and back. Short enough for a quick training day, challenging enough to build real hill strength. Stunning views over Edale and the Hope Valley.",
    trainingBenefits: ["elevation", "cardio"],
    emoji: "⛰️",
  },
  {
    id: "t003",
    name: "Cat Bells via Newlands Valley",
    location: "Lake District, Cumbria",
    distance: 7.1,
    elevationGain: 450,
    estimatedTime: "2h 45m",
    difficulty: "Easy",
    terrain: "mountain",
    routeType: "loop",
    bestFor: ["training", "family walk", "scenic walk"],
    description:
      "Cat Bells is one of the Lake District's most loved fells — a compact mountain with a ridgeline walk that punches well above its height. The short but steep ascent makes it ideal for elevation training without committing a full day. Superb views over Derwentwater.",
    trainingBenefits: ["elevation", "cardio"],
    emoji: "🌿",
  },
  {
    id: "t004",
    name: "Snowdon via Pyg Track",
    location: "Snowdonia, Wales",
    distance: 11.5,
    elevationGain: 900,
    estimatedTime: "5h 30m",
    difficulty: "Hard",
    terrain: "mountain",
    routeType: "out-and-back",
    bestFor: ["summit prep", "training"],
    description:
      "The Pyg Track offers the most dramatic approach to Snowdon's summit at 1,085m — Wales's highest peak. A sustained ascent over increasingly rocky terrain tests both lungs and legs. Essential preparation for any alpine objective and a serious mountain day in its own right.",
    trainingBenefits: ["elevation", "endurance", "pack weight"],
    emoji: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  },
  {
    id: "t005",
    name: "Pen y Fan South Ridge",
    location: "Brecon Beacons, Wales",
    distance: 9.8,
    elevationGain: 420,
    estimatedTime: "3h 30m",
    difficulty: "Moderate",
    terrain: "mountain",
    routeType: "out-and-back",
    bestFor: ["summit prep", "training"],
    description:
      "Pen y Fan at 886m is the highest peak in South Wales. The classic south ridge approach via the Storey Arms follows a broad track before steepening considerably near the summit. A staple for military and civilian athletes alike — unforgiving in bad weather, exhilarating in good.",
    trainingBenefits: ["elevation", "cardio", "endurance"],
    emoji: "🏔️",
  },
  {
    id: "t006",
    name: "Stanage Edge Long Walk",
    location: "Peak District, Derbyshire",
    distance: 9.2,
    elevationGain: 210,
    estimatedTime: "2h 45m",
    difficulty: "Easy",
    terrain: "mixed",
    routeType: "out-and-back",
    bestFor: ["training", "scenic walk"],
    description:
      "Stanage Edge is the Peak District's finest gritstone escarpment — a 5km sweep of crag with open moorland views. The approach and ridge walk makes for a superb fast-paced training run or steady hike. Low technical difficulty but long enough to build solid base fitness.",
    trainingBenefits: ["cardio", "endurance"],
    emoji: "🪨",
  },
  {
    id: "t007",
    name: "Dove Dale & Thorpe Cloud",
    location: "Peak District, Derbyshire",
    distance: 6.3,
    elevationGain: 130,
    estimatedTime: "2h 00m",
    difficulty: "Easy",
    terrain: "woodland",
    routeType: "point-to-point",
    bestFor: ["family walk", "scenic walk"],
    description:
      "A beautiful limestone valley walk through towering rock spires, stepping stones and ancient woodland. Thorpe Cloud at the entrance gives a short but steep optional climb. Ideal for a gentle active recovery day or a family outing — the stepping stones at the start are a favourite.",
    trainingBenefits: ["cardio"],
    emoji: "🌲",
  },
  {
    id: "t008",
    name: "Helvellyn via Striding Edge",
    location: "Lake District, Cumbria",
    distance: 14.4,
    elevationGain: 760,
    estimatedTime: "6h 00m",
    difficulty: "Hard",
    terrain: "mountain",
    routeType: "loop",
    bestFor: ["summit prep", "training"],
    description:
      "One of England's great mountain days. The approach via Striding Edge — a narrow, exposed rocky arête — demands confidence and sure footing. The return via Swirral Edge completes a classic horseshoe. A perfect day out for anyone preparing for a scrambling or alpine route.",
    trainingBenefits: ["elevation", "endurance", "pack weight"],
    emoji: "🏔️",
  },
  {
    id: "t009",
    name: "Rivington Pike Circuit",
    location: "West Pennine Moors, Lancashire",
    distance: 5.4,
    elevationGain: 200,
    estimatedTime: "1h 45m",
    difficulty: "Easy",
    terrain: "hill",
    routeType: "loop",
    bestFor: ["training", "family walk"],
    description:
      "A popular local circuit around Rivington Reservoir with the steep pull up to Rivington Pike's 18th-century tower. Short enough for a midweek training hit — many local runners complete several laps. Good underfoot with varied terrain including woodland tracks and open fell.",
    trainingBenefits: ["cardio", "elevation"],
    emoji: "🗼",
  },
  {
    id: "t010",
    name: "Old Man of Storr",
    location: "Isle of Skye, Scotland",
    distance: 6.8,
    elevationGain: 380,
    estimatedTime: "3h 00m",
    difficulty: "Moderate",
    terrain: "mountain",
    routeType: "loop",
    bestFor: ["summit prep", "scenic walk"],
    description:
      "One of Scotland's most iconic landscapes — a surreal cluster of basalt pinnacles above the sea. The ascent is steep but on good paths, rewarding you with extraordinary views over the Sound of Raasay. The terrain and exposure are excellent preparation for bigger mountain objectives.",
    trainingBenefits: ["elevation", "cardio"],
    emoji: "🗿",
  },
  {
    id: "t011",
    name: "Pembrokeshire Coastal Path Section",
    location: "Pembrokeshire, Wales",
    distance: 8.2,
    elevationGain: 230,
    estimatedTime: "2h 45m",
    difficulty: "Easy",
    terrain: "coastal",
    routeType: "point-to-point",
    bestFor: ["scenic walk", "family walk", "training"],
    description:
      "A spectacular section of one of Britain's finest coastal paths. Constant undulation over cliff tops and coves gives more elevation than the numbers suggest — a deceptively good training route. The dramatic sea stacks, arches and wildflower-covered headlands make it one of the UK's most beautiful walks.",
    trainingBenefits: ["cardio", "endurance"],
    emoji: "🌊",
  },
  {
    id: "t012",
    name: "Ben Nevis Tourist Route",
    location: "Fort William, Scotland",
    distance: 17.2,
    elevationGain: 1350,
    estimatedTime: "7h 30m",
    difficulty: "Hard",
    terrain: "mountain",
    routeType: "out-and-back",
    bestFor: ["summit prep"],
    description:
      "Ben Nevis at 1,345m is the highest peak in the British Isles. The Mountain Track (Tourist Route) is the safest ascent but don't be fooled — this is a serious mountain day demanding full mountain kit, navigation skills and respect for rapidly changing weather. A milestone for any UK mountaineer.",
    trainingBenefits: ["elevation", "endurance", "pack weight"],
    emoji: "🏔️",
  },
  {
    id: "t013",
    name: "Tissington Trail Easy Day",
    location: "Ashbourne, Derbyshire",
    distance: 10.0,
    elevationGain: 65,
    estimatedTime: "2h 30m",
    difficulty: "Easy",
    terrain: "road",
    routeType: "out-and-back",
    bestFor: ["family walk", "training"],
    description:
      "A gentle traffic-free trail along a converted railway line through the beautiful limestone villages of the White Peak. Perfect for a rest-day walk, an easy active recovery, or introducing younger hikers to longer distances. The flat profile and excellent surface make it accessible for all abilities.",
    trainingBenefits: ["cardio", "endurance"],
    emoji: "🚂",
  },
  {
    id: "t014",
    name: "Ingleborough Three Peaks Route",
    location: "Yorkshire Dales, North Yorkshire",
    distance: 12.6,
    elevationGain: 460,
    estimatedTime: "4h 30m",
    difficulty: "Moderate",
    terrain: "hill",
    routeType: "loop",
    bestFor: ["training", "summit prep"],
    description:
      "A challenging loop taking in Ingleborough (723m), one of Yorkshire's iconic Three Peaks. The approach across limestone pavements and the steep final pull to the flat summit plateau is a genuine test of hill fitness. Exposed and demanding in poor conditions — perfect training terrain.",
    trainingBenefits: ["elevation", "endurance", "cardio"],
    emoji: "⛰️",
  },
  {
    id: "t015",
    name: "Bleaklow Head Circuit",
    location: "Dark Peak, Derbyshire",
    distance: 11.8,
    elevationGain: 395,
    estimatedTime: "4h 15m",
    difficulty: "Hard",
    terrain: "mountain",
    routeType: "loop",
    bestFor: ["summit prep", "training"],
    description:
      "Bleaklow is wild, boggy and unforgiving — an essential Peak District challenge for serious mountain aspirants. Navigation skills are needed across the featureless moorland plateau. The demanding underfoot conditions (deep peat groughs) will strengthen your legs far more than the modest altitude suggests.",
    trainingBenefits: ["endurance", "elevation", "pack weight"],
    emoji: "🌫️",
  },
];
