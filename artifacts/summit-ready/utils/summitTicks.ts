/**
 * Hills you have ticked off.
 *
 * WHAT THIS IS NOT, because the distinction is the whole design:
 *
 * A tick is somebody saying "I have been up that". It is SELF-REPORTED and
 * nothing measured it. It is not an activity, it has no activity id, it
 * records no distance, no ascent and no duration, and it reaches neither the
 * Elevation Bank, Readiness, expedition crediting nor the canonical ledger.
 * Nothing here may ever be presented as a recorded ascent, counted towards
 * training, or added to any total that a recorded hike contributes to.
 *
 * Every tick carries `source`, so that a future GPS-verified tick can be told
 * apart from a hand-written one without having to guess from its age. If the
 * two are ever shown together, they are still two different claims.
 *
 * It lives on the device. There is no table for this and no sync: adding one
 * is a schema change, which is not mine to make. So a tick survives the app
 * closing and does not survive a reinstall, and the UI should not imply
 * otherwise.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const SUMMIT_TICKS_KEY = "summitready_summit_ticks";

/** Only kind there is today. Named rather than assumed so adding a verified
 *  kind later does not silently reclassify everything already stored. */
export type TickSource = "self_reported";

export interface SummitTick {
  /** The catalogue mountain id, bare — see `normaliseSummitId`. */
  summitId: string;
  /** Kept so a list of ticks can be read without the catalogue to hand. */
  name: string;
  /** ISO 8601. When it was ticked, which is not when it was climbed. */
  tickedAt: string;
  source: TickSource;
}

/**
 * The app stores catalogue identities prefixed (`sde:mountain:<uuid>`); the
 * map is given the bare `mountains.id`. One of them has to give, and it is
 * cheaper to strip than to teach the map about the prefix — so everything in
 * here is stored bare and compared bare.
 */
export function normaliseSummitId(id: string | null | undefined): string | null {
  const trimmed = id?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^sde:mountain:/i, "").toLowerCase();
}

/** True when this summit is already ticked. */
export function isTicked(ticks: readonly SummitTick[], id: string | null | undefined): boolean {
  const key = normaliseSummitId(id);
  if (!key) return false;
  return ticks.some(tick => tick.summitId === key);
}

/**
 * Tick a hill, or untick one already ticked. Deliberately reversible and
 * deliberately silent about it: a mis-tap on a map is easy, and anything that
 * cannot be taken back has to justify itself first.
 *
 * Returns the same array when there is nothing to do, so a caller can skip
 * the write.
 */
export function toggleTick(
  ticks: readonly SummitTick[],
  summit: { id: string | null | undefined; name: string },
  now: Date = new Date(),
): SummitTick[] {
  const key = normaliseSummitId(summit.id);
  if (!key) return ticks as SummitTick[];

  if (ticks.some(tick => tick.summitId === key)) {
    return ticks.filter(tick => tick.summitId !== key);
  }
  /* Newest first: the only list anyone reads is "what have I done lately". */
  return [
    { summitId: key, name: summit.name.trim() || "Unnamed summit", tickedAt: now.toISOString(), source: "self_reported" },
    ...ticks,
  ];
}

/** The ids the map needs, in the shape it compares them in. */
export function tickedIds(ticks: readonly SummitTick[]): string[] {
  return ticks.map(tick => tick.summitId);
}

/**
 * Anything unreadable is treated as nothing ticked rather than as a reason to
 * fail. A corrupt file loses ticks, which is a disappointment; throwing here
 * would take the map down with it, which is worse.
 */
export function parseTicks(raw: string | null): SummitTick[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ticks: SummitTick[] = [];
    const seen = new Set<string>();
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const record = row as Partial<SummitTick>;
      const id = normaliseSummitId(record.summitId);
      /* A duplicate would draw once and untick twice. */
      if (!id || seen.has(id)) continue;
      if (typeof record.tickedAt !== "string") continue;
      seen.add(id);
      ticks.push({
        summitId: id,
        name: typeof record.name === "string" && record.name.trim() ? record.name : "Unnamed summit",
        tickedAt: record.tickedAt,
        /* Anything that does not name a source it was stored with is treated
           as self-reported, which is the weaker of the two claims. */
        source: "self_reported",
      });
    }
    return ticks;
  } catch {
    return [];
  }
}

export async function readTicks(): Promise<SummitTick[]> {
  try {
    return parseTicks(await AsyncStorage.getItem(SUMMIT_TICKS_KEY));
  } catch {
    return [];
  }
}

export async function writeTicks(ticks: readonly SummitTick[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SUMMIT_TICKS_KEY, JSON.stringify(ticks));
  } catch {
    /* A failed write loses one tick. It must not take the map with it. */
  }
}
