import { db, cachedHills } from "@workspace/db";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const POPULAR_HILLS = [
  { name: "Pen y Fan", elevation: 886, distance: 2.5, repeats: 1, totalElevation: 886, surface: "Grassy ridge", grade: "Hard", emoji: "🏔️", lat: 51.8838, lng: -3.4360 },
  { name: "Snowdon", elevation: 1085, distance: 3.0, repeats: 1, totalElevation: 1085, surface: "Rocky mountain", grade: "Alpine", emoji: "🗻", lat: 53.0685, lng: -4.0764 },
  { name: "Scafell Pike", elevation: 978, distance: 4.0, repeats: 1, totalElevation: 978, surface: "Rocky fell", grade: "Alpine", emoji: "🗻", lat: 54.4543, lng: -3.2114 },
  { name: "Ben Nevis", elevation: 1345, distance: 5.0, repeats: 1, totalElevation: 1345, surface: "Rocky mountain", grade: "Alpine", emoji: "🗻", lat: 56.7969, lng: -5.0035 },
  { name: "Helvellyn", elevation: 950, distance: 4.5, repeats: 1, totalElevation: 950, surface: "Rocky ridge", grade: "Alpine", emoji: "🗻", lat: 54.5270, lng: -3.0162 },
  { name: "Skiddaw", elevation: 931, distance: 4.0, repeats: 1, totalElevation: 931, surface: "Grassy fell", grade: "Hard", emoji: "🏔️", lat: 54.6473, lng: -3.1462 },
  { name: "Blencathra", elevation: 868, distance: 3.5, repeats: 1, totalElevation: 868, surface: "Rocky fell", grade: "Hard", emoji: "🏔️", lat: 54.6367, lng: -3.0511 },
  { name: "Great Gable", elevation: 899, distance: 4.0, repeats: 1, totalElevation: 899, surface: "Rocky fell", grade: "Hard", emoji: "🏔️", lat: 54.4822, lng: -3.2198 },
  { name: "Kinder Scout", elevation: 636, distance: 3.5, repeats: 1, totalElevation: 636, surface: "Moorland plateau", grade: "Moderate", emoji: "⛰️", lat: 53.3849, lng: -1.8718 },
  { name: "Whernside", elevation: 736, distance: 4.0, repeats: 1, totalElevation: 736, surface: "Grassy ridge", grade: "Hard", emoji: "🏔️", lat: 54.2265, lng: -2.3829 },
  { name: "Ingleborough", elevation: 723, distance: 4.5, repeats: 1, totalElevation: 723, surface: "Limestone moorland", grade: "Hard", emoji: "🏔️", lat: 54.1754, lng: -2.3695 },
  { name: "Pen-y-ghent", elevation: 694, distance: 3.5, repeats: 1, totalElevation: 694, surface: "Gritstone moorland", grade: "Moderate", emoji: "⛰️", lat: 54.1609, lng: -2.2522 },
  { name: "Mam Tor", elevation: 517, distance: 2.0, repeats: 2, totalElevation: 1034, surface: "Grassy ridge", grade: "Moderate", emoji: "⛰️", lat: 53.3479, lng: -1.8136 },
  { name: "Shutlingsloe", elevation: 506, distance: 1.5, repeats: 2, totalElevation: 1012, surface: "Moorland path", grade: "Easy–Mod", emoji: "⛰️", lat: 53.1920, lng: -2.0334 },
  { name: "The Roaches", elevation: 505, distance: 2.0, repeats: 2, totalElevation: 1010, surface: "Gritstone ridge", grade: "Easy–Mod", emoji: "⛰️", lat: 53.1480, lng: -2.0007 },
  { name: "Lose Hill", elevation: 476, distance: 2.5, repeats: 2, totalElevation: 952, surface: "Grassy hillside", grade: "Moderate", emoji: "⛰️", lat: 53.3617, lng: -1.7770 },
  { name: "Win Hill", elevation: 462, distance: 2.5, repeats: 2, totalElevation: 924, surface: "Woodland and moorland", grade: "Moderate", emoji: "⛰️", lat: 53.3552, lng: -1.7714 },
  { name: "Pendle Hill", elevation: 557, distance: 2.5, repeats: 2, totalElevation: 1114, surface: "Grassy fell", grade: "Moderate", emoji: "⛰️", lat: 53.8690, lng: -2.2967 },
  { name: "Thorpe Cloud", elevation: 287, distance: 1.0, repeats: 3, totalElevation: 861, surface: "Limestone grassland", grade: "Easy–Mod", emoji: "⛰️", lat: 53.0742, lng: -1.7785 },
  { name: "Sugar Loaf", elevation: 596, distance: 3.0, repeats: 1, totalElevation: 596, surface: "Grassy hillside", grade: "Moderate", emoji: "⛰️", lat: 51.8671, lng: -3.0851 },
  { name: "Skirrid Fawr", elevation: 486, distance: 2.5, repeats: 2, totalElevation: 972, surface: "Wooded hillside", grade: "Moderate", emoji: "⛰️", lat: 51.8434, lng: -2.9866 },
  { name: "Corn Du", elevation: 873, distance: 3.0, repeats: 1, totalElevation: 873, surface: "Grassy ridge", grade: "Hard", emoji: "🏔️", lat: 51.8823, lng: -3.4485 },
  { name: "Cribyn", elevation: 795, distance: 3.5, repeats: 1, totalElevation: 795, surface: "Grassy ridge", grade: "Hard", emoji: "🏔️", lat: 51.8802, lng: -3.4196 },
  { name: "Fan y Big", elevation: 719, distance: 4.0, repeats: 1, totalElevation: 719, surface: "Grassy plateau", grade: "Moderate", emoji: "⛰️", lat: 51.8823, lng: -3.3934 },
  { name: "Coniston Old Man", elevation: 803, distance: 3.5, repeats: 1, totalElevation: 803, surface: "Rocky fell", grade: "Hard", emoji: "🏔️", lat: 54.3648, lng: -3.0996 },
  { name: "Fairfield", elevation: 873, distance: 4.0, repeats: 1, totalElevation: 873, surface: "Rocky ridge", grade: "Hard", emoji: "🏔️", lat: 54.4996, lng: -2.9919 },
  { name: "Catbells", elevation: 451, distance: 2.0, repeats: 2, totalElevation: 902, surface: "Rocky ridge", grade: "Easy–Mod", emoji: "⛰️", lat: 54.5618, lng: -3.1809 },
  { name: "Buckden Pike", elevation: 702, distance: 3.0, repeats: 1, totalElevation: 702, surface: "Limestone grassland", grade: "Moderate", emoji: "⛰️", lat: 54.2247, lng: -1.9984 },
  { name: "Cairn Gorm", elevation: 1244, distance: 5.0, repeats: 1, totalElevation: 1244, surface: "Arctic plateau", grade: "Alpine", emoji: "🗻", lat: 57.1165, lng: -3.6429 },
  { name: "Schiehallion", elevation: 1083, distance: 4.5, repeats: 1, totalElevation: 1083, surface: "Quartzite ridge", grade: "Alpine", emoji: "🗻", lat: 56.6592, lng: -4.0973 },
  { name: "Arthur Seat", elevation: 251, distance: 1.5, repeats: 3, totalElevation: 753, surface: "Grassy volcanic hill", grade: "Easy", emoji: "🌿", lat: 55.9441, lng: -3.1619 },
  { name: "Conic Hill", elevation: 361, distance: 2.5, repeats: 2, totalElevation: 722, surface: "Highland moorland", grade: "Easy–Mod", emoji: "⛰️", lat: 56.0933, lng: -4.5506 },
  { name: "Tinto Hill", elevation: 707, distance: 3.0, repeats: 1, totalElevation: 707, surface: "Grassy hillside", grade: "Moderate", emoji: "⛰️", lat: 55.5233, lng: -3.6720 },
  { name: "Hatterrall Hill", elevation: 529, distance: 2.0, repeats: 2, totalElevation: 1058, surface: "Moorland ridge", grade: "Moderate", emoji: "⛰️", lat: 51.9226, lng: -2.9890 },
  { name: "Wetherlam", elevation: 763, distance: 3.0, repeats: 1, totalElevation: 763, surface: "Rocky fell", grade: "Hard", emoji: "🏔️", lat: 54.3923, lng: -3.0831 },
  { name: "Seat Sandal", elevation: 736, distance: 3.5, repeats: 1, totalElevation: 736, surface: "Grassy fell", grade: "Hard", emoji: "🏔️", lat: 54.5105, lng: -2.9903 },
  { name: "Great Whernside", elevation: 704, distance: 3.5, repeats: 1, totalElevation: 704, surface: "Moorland", grade: "Moderate", emoji: "⛰️", lat: 54.1823, lng: -1.9710 },
  { name: "Brown Knoll", elevation: 569, distance: 3.0, repeats: 1, totalElevation: 569, surface: "Boggy moorland", grade: "Moderate", emoji: "⛰️", lat: 53.4001, lng: -1.8926 },
  { name: "Mynydd Llangorse", elevation: 515, distance: 2.5, repeats: 2, totalElevation: 1030, surface: "Grassy hillside", grade: "Moderate", emoji: "⛰️", lat: 51.9250, lng: -3.2856 },
  { name: "Beinn a Chlachair", elevation: 1087, distance: 6.0, repeats: 1, totalElevation: 1087, surface: "Rocky Highland ridge", grade: "Alpine", emoji: "🗻", lat: 56.8767, lng: -4.5167 },
] as const;

async function main() {
  console.log(`Seeding ${POPULAR_HILLS.length} popular hills...`);
  let seeded = 0;

  for (const h of POPULAR_HILLS) {
    await db
      .insert(cachedHills)
      .values({
        slug: slugify(h.name),
        name: h.name,
        elevation: h.elevation,
        distance: h.distance,
        repeats: h.repeats,
        totalElevation: h.totalElevation,
        surface: h.surface,
        grade: h.grade,
        emoji: h.emoji,
        lat: h.lat,
        lng: h.lng,
        routeType: "hill",
        routeDistance: null,
        estimatedTime: null,
        imageUrl: null,
      })
      .onConflictDoUpdate({
        target: cachedHills.slug,
        set: {
          name: h.name,
          elevation: h.elevation,
          distance: h.distance,
          repeats: h.repeats,
          totalElevation: h.totalElevation,
          surface: h.surface,
          grade: h.grade,
          emoji: h.emoji,
          lat: h.lat,
          lng: h.lng,
          cachedAt: new Date(),
        },
      });
    seeded++;
  }

  console.log(`Done — ${seeded} hills seeded.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
