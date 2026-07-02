export type MountainEntry = {
  id: string;
  name: string;
  elevation: string;
  location: string;
  type: string;
  difficulty: "Easy" | "Moderate" | "Hard" | "Challenging" | "Expert";
  diffColorBase: string;
  emoji: string;
  tagline: string;
  description: string;
  available: boolean;
  trainingHref: string | null;
  cicHref: string | null;
  readinessHref: string | null;
  mountainHref: string;
  beginner: string;
  beginnerOk: boolean;
  trainingTime: string;
  cicDescription: string;
};

export const MOUNTAINS: MountainEntry[] = [
  {
    id: "mont-blanc",
    name: "Mont Blanc",
    elevation: "4,808m",
    location: "Chamonix, France / Italy",
    type: "Alpine",
    difficulty: "Hard",
    diffColorBase: "orange",
    emoji: "🏔️",
    tagline: "The roof of Western Europe",
    description:
      "Mont Blanc is the highest peak in the Alps and Western Europe. The standard Goûter route involves a long summit day with significant altitude, steep terrain, and unpredictable weather.",
    available: true,
    trainingHref: "/training-guides/mont-blanc-training-plan",
    cicHref: "/can-i-climb/mont-blanc",
    readinessHref: "/readiness-check?mountain=mont-blanc",
    mountainHref: "/mountains/mont-blanc",
    beginner: "No — experience needed",
    beginnerOk: false,
    trainingTime: "12–16 weeks",
    cicDescription:
      "Western Europe's highest peak. The standard Goûter route is non-technical but long, cold, and at serious altitude. A realistic goal for fit, experienced hikers willing to train properly.",
  },
  {
    id: "kilimanjaro",
    name: "Kilimanjaro",
    elevation: "5,895m",
    location: "Tanzania",
    type: "Volcanic",
    difficulty: "Moderate",
    diffColorBase: "blue",
    emoji: "🌋",
    tagline: "The roof of Africa",
    description:
      "Africa's highest peak and one of the Seven Summits. No technical climbing required, but altitude is the decisive factor. The Machame route offers the best acclimatisation profile.",
    available: true,
    trainingHref: "/training-guides/kilimanjaro-training-plan",
    cicHref: "/can-i-climb/kilimanjaro",
    readinessHref: "/readiness-check?mountain=kilimanjaro",
    mountainHref: "/mountains/kilimanjaro",
    beginner: "Yes — with preparation",
    beginnerOk: true,
    trainingTime: "12–16 weeks",
    cicDescription:
      "Africa's highest peak. No technical climbing required — but altitude is relentless. With the right preparation, this is achievable for determined beginners.",
  },
  {
    id: "matterhorn",
    name: "Matterhorn",
    elevation: "4,478m",
    location: "Zermatt, Switzerland / Italy",
    type: "Alpine",
    difficulty: "Expert",
    diffColorBase: "red",
    emoji: "⛰️",
    tagline: "The most photographed mountain on Earth",
    description:
      "The Matterhorn's pyramid silhouette is instantly recognisable. The Hörnli Ridge demands technical rock climbing ability, alpine rope techniques, and significant prior experience.",
    available: true,
    trainingHref: "/training-guides/matterhorn-preparation-guide",
    cicHref: "/can-i-climb/matterhorn",
    readinessHref: "/readiness-check?mountain=matterhorn",
    mountainHref: "/mountains/matterhorn",
    beginner: "No — technical skills required",
    beginnerOk: false,
    trainingTime: "6–12 months",
    cicDescription:
      "One of the Alps' most iconic peaks. Rock scrambling, fixed ropes, and glacier travel are essential. Not suitable for anyone without prior alpine mountaineering experience.",
  },
  {
    id: "gran-paradiso",
    name: "Gran Paradiso",
    elevation: "4,061m",
    location: "Aosta Valley, Italy",
    type: "Alpine",
    difficulty: "Moderate",
    diffColorBase: "blue",
    emoji: "🏔️",
    tagline: "Italy's perfect first 4000er",
    description:
      "The highest entirely-Italian summit and widely considered the ideal first high-altitude alpine objective. Glacier travel is required but the route is technically straightforward.",
    available: false,
    trainingHref: null,
    cicHref: "/can-i-climb/gran-paradiso",
    readinessHref: null,
    mountainHref: "/mountains/gran-paradiso",
    beginner: "Yes — ideal first 4000er",
    beginnerOk: true,
    trainingTime: "10–14 weeks",
    cicDescription:
      "Italy's highest entirely-Italian peak and an ideal first high-altitude mountain. Glacier travel required but technically straightforward with a guide.",
  },
  {
    id: "everest-base-camp",
    name: "Everest Base Camp",
    elevation: "5,364m",
    location: "Nepal",
    type: "Trek",
    difficulty: "Challenging",
    diffColorBase: "purple",
    emoji: "🗻",
    tagline: "The world's most famous trek",
    description:
      "Not a summit, but a 130km high-altitude trek passing through Sherpa villages and across glaciers to the foot of the world's highest mountain. A serious endurance undertaking.",
    available: false,
    trainingHref: null,
    cicHref: "/can-i-climb/everest-base-camp",
    readinessHref: null,
    mountainHref: "/mountains/everest-base-camp",
    beginner: "Possible — with serious prep",
    beginnerOk: true,
    trainingTime: "16+ weeks",
    cicDescription:
      "Not a summit — but a 130km trek to 5,364m over two weeks. Achievable for non-climbers with strong cardiovascular fitness and prior multi-day trekking experience.",
  },
  {
    id: "breithorn",
    name: "Breithorn",
    elevation: "4,164m",
    location: "Zermatt, Switzerland",
    type: "Alpine",
    difficulty: "Easy",
    diffColorBase: "green",
    emoji: "❄️",
    tagline: "The most accessible 4000m peak",
    description:
      "With a cable car reaching 3,820m, the Breithorn is the most accessible 4,000m peak in the Alps. A well-tracked glacier route makes this a superb first high-altitude objective.",
    available: false,
    trainingHref: null,
    cicHref: null,
    readinessHref: null,
    mountainHref: "/mountains/breithorn",
    beginner: "Yes — most accessible 4000er",
    beginnerOk: true,
    trainingTime: "6–10 weeks",
    cicDescription:
      "Often called the easiest 4,000m peak in the Alps. Most parties use the cable car to 3,820m, then hike the remaining 344m on a well-tracked glacier. A great first high-altitude experience.",
  },
];

export function diffColor(base: string): string {
  return `text-${base}-400`;
}

export function diffColorFull(base: string): string {
  return `text-${base}-400 bg-${base}-400/10 border-${base}-400/20`;
}
