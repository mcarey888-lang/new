/** Fictional, presentation-only history. Never pass these entries to activity, rank or Bank APIs. */
export const DEMO_MONTHLY_ASCENT = [380, 560, 740, 820, 1150, 1330, 1460, 1590, 1700, 1310, 990, 820] as const;

const HILLS = [
  "Mam Tor", "Kinder Scout", "Pen-y-Ghent", "Ingleborough",
  "Catbells", "Helvellyn", "Scafell Pike", "Great Gable",
  "Snowdon", "Tryfan", "Ben Lomond", "Ben Nevis",
] as const;

export type DemoHike = { id: string; name: string; date: string; ascentM: number };
export type DemoExpedition = { name: string; completedAt: string };

function monthDate(anchor: Date, offset: number, day: number): string {
  return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, day))
    .toISOString().slice(0, 10);
}

export function savedDemoYear(createdAt: string) {
  const parsed = new Date(createdAt);
  const anchor = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const hikes: DemoHike[] = DEMO_MONTHLY_ASCENT.flatMap((gain, index) => {
    const first = Math.floor(gain * 0.46);
    const offset = index - 11;
    return [
      { id: `demo-${index}-a`, name: HILLS[index], date: monthDate(anchor, offset, 6), ascentM: first },
      { id: `demo-${index}-b`, name: HILLS[(index + 3) % HILLS.length], date: monthDate(anchor, offset, 19), ascentM: gain - first },
    ];
  });
  const expeditions: DemoExpedition[] = [
    { name: "Snowdon · Yr Wyddfa", completedAt: monthDate(anchor, -9, 23) },
    { name: "Scafell Pike", completedAt: monthDate(anchor, -5, 18) },
    { name: "Ben Nevis", completedAt: monthDate(anchor, -1, 21) },
  ];
  return {
    hikes: hikes.reverse(),
    expeditions,
    ascentM: DEMO_MONTHLY_ASCENT.reduce((total, gain) => total + gain, 0),
  };
}