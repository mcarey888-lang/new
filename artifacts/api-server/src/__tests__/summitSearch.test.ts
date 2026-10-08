import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ARRIVAL_ZOOM, MIN_QUERY_LENGTH, matchKind, normalise, rankHits, scoreRow, searchResults,
  type SearchHit,
} from "../services/summits/summitSearch";
import { toPin, type MountainRow } from "../services/summits/summitPins";

const row = (name: string, prominenceM: number, elevationM = 900): MountainRow => ({
  id: `id-${name}`, name,
  latitude: 56.8, longitude: -5.0,
  elevationM, prominenceM,
  country: "Scotland", region: null, county: "Highland",
  classificationCodes: [],
});

describe("what somebody actually types", () => {
  it("ignores accents, because nobody reaches for them on a phone", () => {
    expect(normalise("Sgùrr a' Mhàim")).toBe("sgurr a mhaim");
    expect(matchKind("Sgùrr a' Mhàim", "sgurr")).toBe("prefix");
  });

  it("ignores apostrophes and hyphens", () => {
    expect(matchKind("Pen-y-ghent", "pen y ghent")).toBe("exact");
  });

  it("finds a name people run together", () => {
    /* Pen-y-ghent is written Penyghent on some Ordnance Survey sheets, and
       people type it both ways. One spelling finding nothing reads as the
       hill being missing from the catalogue. */
    expect(matchKind("Pen-y-ghent", "penyghent")).toBe("exact");
    expect(matchKind("Pen-y-ghent", "penygh")).toBe("prefix");
    expect(matchKind("Bwlch-y-Groes", "bwlchygroes")).toBe("exact");
  });

  it("still refuses a query that matches neither spelling", () => {
    expect(matchKind("Pen-y-ghent", "scafell")).toBe("none");
    expect(matchKind("Ben Nevis", "zzz")).toBe("none");
  });

  it("ignores case and stray spacing", () => {
    expect(matchKind("Ben Nevis", "  BEN nevis ")).toBe("exact");
  });

  it("matches nothing on an empty query", () => {
    expect(matchKind("Ben Nevis", "")).toBe("none");
    expect(matchKind("Ben Nevis", "   ")).toBe("none");
  });
});

describe("how well a name answers", () => {
  it("ranks a whole-name match above a start-of-name one", () => {
    expect(matchKind("Tryfan", "tryfan")).toBe("exact");
    expect(matchKind("Tryfan North Top", "tryfan")).toBe("prefix");
  });

  it("puts a word start above letters buried mid-word", () => {
    /* Typing "nevis" should find Ben Nevis ahead of anything that merely
       contains those letters inside a longer word. */
    expect(matchKind("Ben Nevis", "nevis")).toBe("word");
    expect(matchKind("Carnevissock", "nevis")).toBe("contains");
  });

  it("says so when nothing matches", () => {
    expect(matchKind("Ben Nevis", "snowdon")).toBe("none");
  });
});

describe("a hill with two names", () => {
  it("is found by either", () => {
    /* The catalogue stores them as one string and a person knows the hill by
       one or the other. Both have to work. */
    expect(scoreRow("Snowdon - Yr Wyddfa", "snowdon")).toEqual({ kind: "exact", matchedAlternative: false });
    expect(scoreRow("Snowdon - Yr Wyddfa", "yr wyddfa")).toEqual({ kind: "exact", matchedAlternative: true });
  });

  it("is found by the bracketed form too", () => {
    expect(scoreRow("Ben Nevis [Beinn Nibheis]", "beinn nibheis").matchedAlternative).toBe(true);
  });

  it("takes the better of the two rather than always the primary", () => {
    /* Searching the Welsh name should not push a result down the list. */
    const scored = scoreRow("Something - Yr Wyddfa", "yr wyddfa");
    expect(scored.kind).toBe("exact");
    expect(scored.matchedAlternative).toBe(true);
  });

  it("says which name matched, so the card does not look wrong", () => {
    expect(scoreRow("Snowdon - Yr Wyddfa", "wyddfa").matchedAlternative).toBe(true);
    expect(scoreRow("Snowdon - Yr Wyddfa", "snow").matchedAlternative).toBe(false);
  });
});

describe("the order of the answers", () => {
  const hit = (name: string, kind: SearchHit["kind"], prom: number, height = 900): SearchHit => ({
    pin: toPin(row(name, prom, height))!, kind, matchedAlternative: false,
  });

  it("puts a better match first however small the hill", () => {
    const ranked = rankHits([hit("Ben Alder", "word", 800), hit("Ben", "exact", 20)]);
    expect(ranked[0]!.pin.name).toBe("Ben");
  });

  it("puts the bigger hill first among equals", () => {
    /* Type "ben" and the answer wanted is almost always Ben Nevis. A list that
       opens with Ben Aden has failed even though every row matches. */
    const ranked = rankHits([
      hit("Ben Aden", "prefix", 349),
      hit("Ben Nevis", "prefix", 1345),
      hit("Ben Lomond", "prefix", 870),
    ]);
    expect(ranked.map(h => h.pin.name)).toEqual(["Ben Nevis", "Ben Lomond", "Ben Aden"]);
  });

  it("falls back to height when prominence ties", () => {
    const ranked = rankHits([hit("Lower", "prefix", 500, 700), hit("Higher", "prefix", 500, 900)]);
    expect(ranked[0]!.pin.name).toBe("Higher");
  });

  it("never wobbles between identical queries", () => {
    /* A list that reshuffles on every keystroke is worse than one in the wrong
       order, because at least a wrong order can be learned. */
    const hits = [hit("Beta", "prefix", 500, 800), hit("Alpha", "prefix", 500, 800)];
    expect(rankHits(hits).map(h => h.pin.name)).toEqual(["Alpha", "Beta"]);
    expect(rankHits([...hits].reverse()).map(h => h.pin.name)).toEqual(["Alpha", "Beta"]);
  });

  it("sorts a hill with no prominence below one that has it", () => {
    const ranked = rankHits([
      { pin: toPin({ ...row("Unknown", 0), prominenceM: null })!, kind: "prefix", matchedAlternative: false },
      hit("Known", "prefix", 100),
    ]);
    expect(ranked[0]!.pin.name).toBe("Known");
  });
});

describe("the whole search", () => {
  const rows = [
    row("Ben Nevis [Beinn Nibheis]", 1345, 1345),
    row("Ben Lomond", 870, 974),
    row("Ben Aden", 349, 887),
    row("Snowdon - Yr Wyddfa", 1039, 1085),
    row("Tryfan", 92, 918),
  ];

  it("finds the hill somebody means", () => {
    const results = searchResults(rows, "ben", toPin);
    expect(results[0]!.pin.name).toBe("Ben Nevis");
  });

  it("finds a hill by its Welsh name", () => {
    const results = searchResults(rows, "yr wyddfa", toPin);
    expect(results[0]!.pin.name).toBe("Snowdon");
    expect(results[0]!.matchedAlternative).toBe(true);
  });

  it("leaves out everything that does not match", () => {
    expect(searchResults(rows, "tryfan", toPin)).toHaveLength(1);
    expect(searchResults(rows, "kilimanjaro", toPin)).toEqual([]);
  });

  it("keeps the list short enough to read", () => {
    const many = Array.from({ length: 40 }, (_, i) => row(`Ben Number ${i}`, i));
    expect(searchResults(many, "ben", toPin, 12)).toHaveLength(12);
  });

  it("drops a row that cannot be drawn", () => {
    const noPoint = { ...row("Ben Nowhere", 500), latitude: null };
    expect(searchResults([noPoint], "ben", toPin)).toEqual([]);
  });

  it("needs something to go on", () => {
    expect(MIN_QUERY_LENGTH).toBeGreaterThanOrEqual(2);
    expect(searchResults(rows, "", toPin)).toEqual([]);
  });
});

describe("where the map lands", () => {
  it("arrives close enough to see the paths off the hill", () => {
    /* Too far out and there is nothing to plan with; too close and the summit
       fills the screen with no surroundings to get your bearings from. */
    expect(ARRIVAL_ZOOM).toBeGreaterThanOrEqual(12);
    expect(ARRIVAL_ZOOM).toBeLessThanOrEqual(15);
  });
});

describe("what reaches the database", () => {
  const SRC = readFileSync(join(__dirname, "..", "routes/summits.ts"), "utf8");

  it("escapes the wildcards before they reach LIKE", () => {
    /* A name containing % would otherwise match everything, and _ would match
       any single character. Both arrive straight from a query string. */
    expect(SRC).toContain("raw.replace(/[\\\\%_]/g");
    expect(SRC).toContain("ESCAPE '\\\\'");
  });

  it("keeps the query itself a parameter", () => {
    expect(SRC).toContain("ILIKE $1");
    expect(SRC).toContain("[pattern]");
  });

  it("narrows in SQL but orders here, where it can be tested", () => {
    /* SQL ordering cannot tell "the hill somebody means" from "a row that
       matches". It fetches a wide net; rankHits decides. */
    expect(SRC).toContain("LIMIT 200");
    expect(SRC).toContain("searchResults(");
  });

  it("answers a too-short query without hitting the database", () => {
    const head = SRC.slice(SRC.indexOf('router.get("/summits/search"'));
    const guard = head.slice(0, head.indexOf("executeEngineReadOnlyQuery"));
    expect(guard).toContain("MIN_QUERY_LENGTH");
    expect(guard).toContain("tooShort: true");
  });

  it("does not log the error object", () => {
    // A connection failure carries the database URL, and that carries a password.
    const tail = SRC.slice(SRC.indexOf('router.get("/summits/search"'));
    expect(tail.slice(0, tail.indexOf("});"))).not.toContain("{ err }");
  });
});
