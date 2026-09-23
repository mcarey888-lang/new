/**
 * "Recent evidence" — the activities Readiness actually used.
 *
 * The approved design lists the activities behind the score. Readiness 2.0
 * already reports exactly which evidence it included (`includedEvidenceIds`),
 * and the evidence ids are the session / explore-hike ids, so the list is a
 * join rather than a guess: nothing appears here that the engine did not
 * count, and nothing the engine counted is renamed or re-measured.
 *
 * Names are the user's own. An explore hike carries its name; a plan session
 * carries a hill name when it has one, and otherwise gets the plain label for
 * its type — never an invented place.
 */

export interface EvidenceSessionLike {
  id: string;
  date: string;
  type?: "cardio" | "hill" | "bigDay" | string;
  hillName?: string | null;
  distance?: number | null;
  elevationGain?: number | null;
  duration?: number | null;
  completed?: boolean;
}

export interface EvidenceHikeLike {
  id: string;
  name?: string | null;
  date: string;
  distance?: number | null;
  elevationGain?: number | null;
  timeTaken?: number | null;
}

export interface EvidenceStat {
  kind: "ascent" | "distance" | "duration";
  text: string;
}

export interface EvidenceRow {
  id: string;
  name: string;
  /** Formatted date, or null when the record's date cannot be read. */
  date: string | null;
  /** Sort key. */
  at: number;
  stats: EvidenceStat[];
  /** Where the row came from, so the screen can route to the right detail. */
  origin: "session" | "hike";
}

/** Plain labels for a plan session with no hill of its own. */
const TYPE_LABEL: Record<string, string> = {
  cardio: "Cardio session",
  hill: "Hill session",
  bigDay: "Big day",
};

function formatDate(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Minutes → "4h 32m" / "45 min". Null in, null out. */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return null;
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole} min`;
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function stats(
  ascentM: number | null | undefined,
  distanceKm: number | null | undefined,
  minutes: number | null | undefined,
): EvidenceStat[] {
  const out: EvidenceStat[] = [];
  if (typeof ascentM === "number" && Number.isFinite(ascentM) && ascentM > 0) {
    out.push({ kind: "ascent", text: `${Math.round(ascentM).toLocaleString()} m` });
  }
  if (typeof distanceKm === "number" && Number.isFinite(distanceKm) && distanceKm > 0) {
    out.push({ kind: "distance", text: `${Number(distanceKm.toFixed(1))} km` });
  }
  const d = formatDuration(minutes);
  if (d) out.push({ kind: "duration", text: d });
  return out;
}

export interface EvidenceRowsInput {
  sessions: readonly EvidenceSessionLike[];
  hikes: readonly EvidenceHikeLike[];
  /** The engine's own list. Only these appear. */
  includedEvidenceIds: readonly string[];
  limit?: number;
}

/**
 * The rows to list, newest first.
 *
 * An id the engine included but that no longer resolves to a record is simply
 * omitted — an "Unknown activity" row would tell the user nothing and would
 * imply the score rests on something that is not there.
 */
export function evidenceRows(input: EvidenceRowsInput): EvidenceRow[] {
  const included = new Set(input.includedEvidenceIds);
  const rows: EvidenceRow[] = [];

  for (const s of input.sessions) {
    if (!included.has(s.id)) continue;
    const at = Date.parse(s.date);
    rows.push({
      id: s.id,
      name: s.hillName?.trim() || TYPE_LABEL[String(s.type)] || "Training session",
      date: formatDate(s.date),
      at: Number.isFinite(at) ? at : 0,
      stats: stats(s.elevationGain, s.distance, s.duration),
      origin: "session",
    });
  }

  for (const h of input.hikes) {
    if (!included.has(h.id)) continue;
    const at = Date.parse(h.date);
    rows.push({
      id: h.id,
      name: h.name?.trim() || "Recorded hike",
      date: formatDate(h.date),
      at: Number.isFinite(at) ? at : 0,
      stats: stats(h.elevationGain, h.distance, h.timeTaken),
      origin: "hike",
    });
  }

  rows.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  return typeof input.limit === "number" ? rows.slice(0, input.limit) : rows;
}

/** The earliest evidence the user has, for the history window. Null if none. */
export function earliestEvidenceAt(
  sessions: readonly EvidenceSessionLike[],
  hikes: readonly EvidenceHikeLike[],
): string | null {
  let best: number | null = null;
  let bestIso: string | null = null;
  const consider = (iso: string) => {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return;
    if (best === null || t < best) { best = t; bestIso = iso; }
  };
  for (const s of sessions) if (s.completed !== false) consider(s.date);
  for (const h of hikes) consider(h.date);
  return bestIso;
}

/**
 * Average pace as m:ss per km.
 *
 * Rounds to whole seconds FIRST and then splits, so 5.999 min/km prints 6:00
 * and never 5:60. Null for a distance or time that cannot produce a pace —
 * a dash is honest, "0:00/km" is not.
 */
export function formatPace(
  minutes: number | null | undefined,
  distanceKm: number | null | undefined,
): string | null {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return null;
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  const totalSeconds = Math.round((minutes / distanceKm) * 60);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${m}:${String(sec).padStart(2, "0")}/km`;
}
