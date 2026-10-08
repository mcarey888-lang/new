import { splitName, type MountainRow, type SummitPin } from "./summitPins";

/**
 * Finding a hill by name.
 *
 * The hard part is not the matching, it is the order. Type "ben" and there are
 * hundreds of answers; the one wanted is almost always Ben Nevis, and a list
 * that opens with Ben Aden has failed even though every row in it matches.
 *
 * Two rules decide it. What somebody typed at the start of a name beats the
 * same letters buried in the middle, and among equals the bigger hill wins —
 * bigger meaning prominence, because that is what makes a hill a destination
 * rather than a bump on the way to one.
 */

/** Below this, a search is too vague to answer usefully. */
export const MIN_QUERY_LENGTH = 2;
export const MAX_RESULTS = 12;

/**
 * What the person typed, reduced to something comparable.
 *
 * Accents go, because somebody typing on a phone will not reach for them and
 * "Sgurr a Mhaim" should find "Sgùrr a' Mhàim". Apostrophes and hyphens go for
 * the same reason: nobody types Pen-y-ghent consistently.
 */
export function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The same text with every separator gone, not just flattened to spaces.
 *
 * Pen-y-ghent is written Penyghent on some Ordnance Survey sheets, and people
 * type it both ways. Without this, one of those two spellings finds nothing at
 * all, which reads as the hill being missing from the catalogue.
 */
export function squash(text: string): string {
  return normalise(text).replace(/ /g, "");
}

export type MatchKind = "exact" | "prefix" | "word" | "contains" | "none";

/**
 * How well a name answers a query, ignoring which name it was.
 *
 * "word" sits between prefix and contains on purpose: typing "nevis" should
 * find Ben Nevis ahead of anything that merely contains those letters inside a
 * longer word.
 */
export function matchKind(name: string, query: string): MatchKind {
  const n = normalise(name);
  const q = normalise(query);
  if (!q || !n) return "none";
  if (n === q) return "exact";
  if (n.startsWith(q)) return "prefix";
  if (n.split(" ").some(word => word.startsWith(q))) return "word";
  if (n.includes(q)) return "contains";

  /* Then without separators at all, for the names people run together. The
     best of the two wins rather than this being a lesser tier: a query only
     reaches here when the spaced form found nothing, so there is nothing for
     it to unfairly outrank. */
  const ns = squash(name);
  const qs = squash(query);
  if (!qs) return "none";
  if (ns === qs) return "exact";
  if (ns.startsWith(qs)) return "prefix";
  if (ns.includes(qs)) return "contains";
  return "none";
}

const KIND_RANK: Record<MatchKind, number> = {
  exact: 0, prefix: 1, word: 2, contains: 3, none: 4,
};

export interface SearchHit {
  pin: SummitPin;
  /** Which of the hill's names matched. The card shows the primary name, so a
   *  hit on the Welsh or Gaelic form has to say so or the result looks wrong. */
  matchedAlternative: boolean;
  kind: MatchKind;
}

/**
 * Rank one row against a query, or reject it.
 *
 * Both names are tried. "Yr Wyddfa" must find Snowdon, and so must "Snowdon",
 * because the catalogue stores them as one string and a person knows the hill
 * by one or the other.
 */
export function scoreRow(name: string, query: string): { kind: MatchKind; matchedAlternative: boolean } {
  const { name: primary, alternative } = splitName(name);
  const onPrimary = matchKind(primary, query);
  const onAlternative = alternative ? matchKind(alternative, query) : "none";
  if (onPrimary === "none" && onAlternative === "none") return { kind: "none", matchedAlternative: false };
  /* A better match on the alternative beats a worse one on the primary: a
     person searching the Welsh name should not be pushed down the list for it. */
  if (KIND_RANK[onAlternative] < KIND_RANK[onPrimary]) {
    return { kind: onAlternative, matchedAlternative: true };
  }
  return { kind: onPrimary, matchedAlternative: false };
}

/**
 * Order the matches.
 *
 * Match quality first, then prominence, then height, then name so the order
 * never wobbles between identical queries. A list that reshuffles on every
 * keystroke is worse than a list in the wrong order, because at least the
 * wrong order can be learned.
 */
export function rankHits(hits: readonly SearchHit[]): SearchHit[] {
  return [...hits].sort((a, b) => {
    const kind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (kind !== 0) return kind;
    const prominence = (b.pin.prominenceM ?? -1) - (a.pin.prominenceM ?? -1);
    if (prominence !== 0) return prominence;
    const height = (b.pin.heightM ?? -1) - (a.pin.heightM ?? -1);
    if (height !== 0) return height;
    return a.pin.name.localeCompare(b.pin.name);
  });
}

/** Turn rows into an ordered answer, dropping anything that does not match. */
export function searchResults(
  rows: readonly MountainRow[],
  query: string,
  toPinFn: (row: MountainRow) => SummitPin | null,
  limit = MAX_RESULTS,
): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const row of rows) {
    const scored = scoreRow(row.name, query);
    if (scored.kind === "none") continue;
    const pin = toPinFn(row);
    if (!pin) continue;
    hits.push({ pin, kind: scored.kind, matchedAlternative: scored.matchedAlternative });
  }
  return rankHits(hits).slice(0, Math.max(0, limit));
}

/**
 * How far out to put the map when flying to a hill.
 *
 * Close enough to see the paths off it, not so close that the summit fills the
 * screen with nothing around it to get your bearings from.
 */
export const ARRIVAL_ZOOM = 14;
