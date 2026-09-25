/**
 * Explicit, identity-bound names for the thirty mountain heroes approved by
 * the user. Do not fuzzy-match names: several of these occur at other summits.
 * The caller must still load the verified canonical row and check for a live
 * approval; this table never authorizes an image by itself.
 */
const featured = [
  { id: "c72f54a6-7022-4569-8573-0cb476b24a50", country: "Scotland", names: ["Ben Nevis", "Beinn Nibheis", "Ben Nevis Beinn Nibheis"] },
  { id: "d2e4f6b3-d992-4ed4-9622-4ab05c6ef1dd", country: "Wales", names: ["Snowdon", "Yr Wyddfa", "Snowdon Yr Wyddfa"] },
  { id: "a4bf692f-2b58-463e-9960-a293e6c6a687", country: "England", names: ["Scafell Pike"] },
  { id: "404a4fc5-20da-46b3-a693-0d3bbea02e28", country: "Scotland", names: ["Ben Lomond"] },
  { id: "0a3d3334-cb82-4659-a8bc-9f8658557731", country: "England", names: ["Helvellyn"] },
  { id: "76187fe7-2d70-452f-b89e-73526af374a4", country: "Wales", names: ["Tryfan"] },
  { id: "03d78457-5527-4fcc-ae4b-33897f8ca8d3", country: "Scotland", names: ["Buachaille Etive Mor", "Buachaille Etive Mor Stob Dearg"] },
  { id: "943fe1c6-ad6e-474c-8103-99779e791c1e", country: "Wales", names: ["Cadair Idris", "Cader Idris", "Cadair Idris Cader Idris", "Cadair Idris Penygadair"] },
  { id: "290278a7-1103-4d1c-8363-e8dfe95b3edb", country: "Wales", names: ["Pen y Fan"] },
  { id: "f58d263f-9cf9-4eac-a2a2-c84332fbccfa", country: "England", names: ["Old Man of Coniston", "The Old Man of Coniston", "Coniston Old Man", "The Old Man of Coniston Coniston Old Man"] },
  { id: "8a08d454-eb8c-449d-8d34-c6954df9bb86", country: "England", names: ["Blencathra", "Blencathra Hallsfell Top"] },
  { id: "30cb5f2a-c724-4fca-81e6-5f03736430f9", country: "England", names: ["Great Gable"] },
  { id: "696871ce-7baa-4ea2-8cf3-8c55869df893", country: "England", names: ["Catbells", "Cat Bells", "Cat Bells Catbells"] },
  { id: "e494f618-a3a5-447e-aceb-12297f4e3c61", country: "Scotland", names: ["Schiehallion"] },
  { id: "1f136228-983f-4360-a13a-4980c19fce10", country: "Scotland", names: ["Suilven"] },
  { id: "b0116175-ae63-48a8-b4b2-420cf1c86cc9", country: "Scotland", names: ["Liathach", "Liathach Spidean a Choire Leith"] },
  { id: "272c0a8c-1cac-456e-848e-89813b965c09", country: "Scotland", names: ["An Teallach", "An Teallach Bidein a Ghlas Thuill"] },
  { id: "ede071e6-bc65-422d-b351-48fddb160ea1", country: "Scotland", names: ["Ben Macdui", "Beinn Macduibh", "Ben Macdui Beinn Macduibh"] },
  { id: "88e5bb48-2f26-45c7-bad5-71a9887d57be", country: "Scotland", names: ["Cairn Gorm", "Cairngorm"] },
  { id: "a90c9e1f-9910-489e-81d3-214ca592dcbb", country: "Scotland", names: ["Ben A'an", "Ben Aan"] },
  { id: "add53e5b-770e-479d-8466-04889d855d36", country: "Scotland", names: ["The Cobbler", "Ben Arthur", "The Cobbler Ben Arthur"] },
  { id: "0b3eeae1-416d-42a6-892f-62254fce2d9e", country: "Scotland", names: ["Stac Pollaidh"] },
  { id: "ad6b9493-2366-4dba-963e-59cd7eff3d9d", country: "Scotland", names: ["Aonach Eagach", "Aonach Eagach Sgorr nam Fiannaidh"] },
  { id: "da8533db-1fba-4568-bbe5-0649b86237ad", country: "Wales", names: ["Crib Goch"] },
  { id: "2427f0f5-4ca7-4727-a1b9-3176c30a506e", country: "Wales", names: ["Glyder Fawr"] },
  { id: "0a435ff8-be02-45cb-9ea4-9add83762f22", country: "England", names: ["Kinder Scout"] },
  { id: "8c5dd25e-8dc7-4b9f-b182-f24a7b8821e3", country: "England", names: ["Mam Tor"] },
  { id: "9bbcba26-82be-430a-9887-27f6112d5c0b", country: "England", names: ["Ingleborough"] },
  { id: "8e90bcd9-35a9-456c-aee5-1ceb9a9a67b7", country: "England", names: ["Pen-y-ghent", "Pen y Ghent"] },
  { id: "b49901a7-989b-4ec3-bbab-c32e85eeb95d", country: "England", names: ["Roseberry Topping"] },
] as const;

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

const names = featured.flatMap(mountain =>
  mountain.names.map(name => ({ name: normalize(name), id: mountain.id, country: mountain.country })),
).sort((a, b) => b.name.length - a.name.length);

const routeTerm = /\b(?:ridge|edge|route|trail|path|way|walk|hike|horseshoe|round|traverse|circuit|loop|approach|track|scramble|via)\b/;

export function approvedFeaturedMountainId(name: string, location?: string): string | null {
  const subject = normalize(name);
  const context = normalize(location ?? "");
  if (!subject) return null;
  for (const entry of names) {
    // An explicit contradictory country must never select another mountain.
    if (context && /\b(?:england|scotland|wales|ireland)\b/.test(context) &&
        !context.includes(entry.country.toLowerCase())) continue;
    if (subject === entry.name) return entry.id;
    const suffix = subject.startsWith(entry.name + " ") ? subject.slice(entry.name.length + 1) : "";
    // A named route on this mountain can use its approved hero, but a tour
    // joining multiple mountains must retain its route-specific imagery.
    if (suffix && routeTerm.test(suffix) && !/\b(?:to|and)\b/.test(suffix)) return entry.id;
  }
  return null;
}