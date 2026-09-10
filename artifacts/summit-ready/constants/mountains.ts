export const MOUNTAINS = [
  "Ben Nevis", "Ben Macdui", "Braeriach", "Cairn Toul", "Cairn Gorm",
  "Aonach Beag", "Aonach Mòr", "Carn Mòr Dearg", "Ben Lawers", "Creag Meagaidh",
  "Ben Lomond", "Schiehallion", "Ben Vorlich", "The Cobbler", "Ben More",
  "Ben Cruachan", "Buachaille Etive Mòr", "Glencoe Pap", "Beinn Alligin",
  "An Teallach", "Liathach", "Torridon", "Cul Mor", "Stac Pollaidh",
  "Ben Hope", "Ben Wyvis", "Lochnagar", "Balmoral", "Beinn Eighe",
  "Helvellyn", "Scafell Pike", "Scafell", "Great Gable", "Blencathra",
  "Skiddaw", "Cross Fell", "Pillar", "High Street", "Fairfield",
  "Bowfell", "Crinkle Crags", "Langdale Pikes", "Red Pike", "Dale Head",
  "Haystacks", "Kirk Fell", "Coniston Old Man",
  "Whernside", "Ingleborough", "Pen-y-ghent", "Great Whernside",
  "Kinder Scout", "Mam Tor", "Bleaklow", "Black Hill", "Lose Hill",
  "Snowdon", "Pen y Fan", "Cadair Idris", "Tryfan", "Glyder Fawr",
  "Glyder Fach", "Y Garn", "Carnedd Llewelyn", "Carnedd Dafydd",
  "Pen Pumlumon Fawr", "Brecon Beacons",
  "Carrauntoohil", "Brandon Mountain", "Lugnaquilla", "Slieve Donard",
  "Mont Blanc", "Matterhorn", "Monte Rosa", "Dufourspitze", "Dom",
  "Weisshorn", "Liskamm", "Grandes Jorasses", "Aiguille Verte",
  "Eiger", "Jungfrau", "Mönch", "Gran Paradiso", "Ortler",
  "Grossglockner", "Zugspitze", "Dolomites", "Tre Cime di Lavaredo",
  "Denali", "Mount Rainier", "Mount Whitney", "Mount Shasta", "Mount Hood",
  "Grand Teton", "Longs Peak", "Mount Elbert", "Pikes Peak",
  "Mount Washington", "Humphreys Peak",
  "Kilimanjaro", "Mount Kenya", "Ras Dashen",
  "Aconcagua", "Huascarán", "Chimborazo", "Cotopaxi",
  "Everest", "K2", "Kangchenjunga", "Lhotse", "Makalu",
  "Cho Oyu", "Dhaulagiri", "Manaslu", "Annapurna", "Nanga Parbat",
  "Ama Dablam", "Island Peak", "Mera Peak", "Lobuche East",
  "Vesuvius", "Etna", "Olympus", "Triglav", "Rysy",
] as const;

export function mountainSuggestions(query: string, limit = 6): string[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized.length < 2) return [];

  return MOUNTAINS
    .filter(name => name.toLocaleLowerCase().includes(normalized))
    .sort((left, right) => {
      const leftStarts = left.toLocaleLowerCase().startsWith(normalized);
      const rightStarts = right.toLocaleLowerCase().startsWith(normalized);
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return left.localeCompare(right);
    })
    .slice(0, limit);
}