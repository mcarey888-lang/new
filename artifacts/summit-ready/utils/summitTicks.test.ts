import { describe, expect, it } from "vitest";
import {
  isTicked,
  normaliseSummitId,
  parseTicks,
  tickedIds,
  toggleTick,
  type SummitTick,
} from "./summitTicks";

const UUID_A = "7b2f4f1e-3a9c-4d21-8f6b-0c1d2e3f4a5b";
const UUID_B = "91c8d6a2-55b4-4f0e-9a3d-6e7f8a9b0c1d";

const tick = (id: string, name = "Tryfan"): SummitTick => ({
  summitId: id, name, tickedAt: "2026-10-15T09:00:00.000Z", source: "self_reported",
});

describe("identities line up between the app and the map", () => {
  it("strips the prefix the app stores so both sides compare the same string", () => {
    expect(normaliseSummitId(`sde:mountain:${UUID_A}`)).toBe(UUID_A);
    expect(normaliseSummitId(UUID_A)).toBe(UUID_A);
  });

  it("ignores case and surrounding space", () => {
    expect(normaliseSummitId(`  SDE:MOUNTAIN:${UUID_A.toUpperCase()} `)).toBe(UUID_A);
  });

  it("refuses an empty identity rather than inventing one", () => {
    expect(normaliseSummitId("")).toBeNull();
    expect(normaliseSummitId("   ")).toBeNull();
    expect(normaliseSummitId(null)).toBeNull();
    expect(normaliseSummitId(undefined)).toBeNull();
  });

  it("matches a prefixed id against a bare stored one", () => {
    expect(isTicked([tick(UUID_A)], `sde:mountain:${UUID_A}`)).toBe(true);
    expect(isTicked([tick(UUID_A)], UUID_B)).toBe(false);
  });
});

describe("ticking and unticking", () => {
  it("adds a hill that was not ticked", () => {
    const after = toggleTick([], { id: UUID_A, name: "Tryfan" }, new Date("2026-10-15T09:00:00Z"));
    expect(after).toHaveLength(1);
    expect(after[0]!.summitId).toBe(UUID_A);
    expect(after[0]!.name).toBe("Tryfan");
    expect(after[0]!.tickedAt).toBe("2026-10-15T09:00:00.000Z");
  });

  it("removes one already ticked, because a mis-tap must be undoable", () => {
    const after = toggleTick([tick(UUID_A)], { id: UUID_A, name: "Tryfan" });
    expect(after).toHaveLength(0);
  });

  it("matches on identity, not on name", () => {
    /* Two hills share a name often enough that it cannot be the key. */
    const after = toggleTick([tick(UUID_A, "Great Hill")], { id: UUID_B, name: "Great Hill" });
    expect(after).toHaveLength(2);
  });

  it("puts the newest first", () => {
    const after = toggleTick([tick(UUID_A)], { id: UUID_B, name: "Snowdon" });
    expect(after[0]!.summitId).toBe(UUID_B);
  });

  it("does nothing at all without an identity", () => {
    const before = [tick(UUID_A)];
    expect(toggleTick(before, { id: null, name: "Nowhere" })).toBe(before);
    expect(toggleTick(before, { id: "", name: "Nowhere" })).toBe(before);
  });

  it("never loses the hill behind a blank name", () => {
    const after = toggleTick([], { id: UUID_A, name: "   " });
    expect(after[0]!.name).toBe("Unnamed summit");
  });
});

describe("a tick records nothing it did not measure", () => {
  it("stores only an identity, a name, a time and how it was claimed", () => {
    const [stored] = toggleTick([], { id: UUID_A, name: "Tryfan" });
    expect(Object.keys(stored!).sort()).toEqual(["name", "source", "summitId", "tickedAt"]);
  });

  it("marks it self-reported, because nothing measured it", () => {
    const [stored] = toggleTick([], { id: UUID_A, name: "Tryfan" });
    expect(stored!.source).toBe("self_reported");
  });
});

describe("reading what was stored", () => {
  it("survives nothing, rubbish and the wrong shape", () => {
    expect(parseTicks(null)).toEqual([]);
    expect(parseTicks("")).toEqual([]);
    expect(parseTicks("{ not json")).toEqual([]);
    expect(parseTicks('{"summitId":"x"}')).toEqual([]);
    expect(parseTicks('[null, 3, "x"]')).toEqual([]);
  });

  it("drops a row with no usable identity or time rather than guessing", () => {
    const raw = JSON.stringify([
      { summitId: UUID_A, name: "Tryfan", tickedAt: "2026-10-15T09:00:00.000Z" },
      { summitId: "", name: "Nowhere", tickedAt: "2026-10-15T09:00:00.000Z" },
      { summitId: UUID_B, name: "Snowdon" },
    ]);
    const ticks = parseTicks(raw);
    expect(ticks).toHaveLength(1);
    expect(ticks[0]!.summitId).toBe(UUID_A);
  });

  it("collapses a duplicate, which would otherwise untick in one tap and not the next", () => {
    const raw = JSON.stringify([
      { summitId: UUID_A, name: "Tryfan", tickedAt: "2026-10-15T09:00:00.000Z" },
      { summitId: `sde:mountain:${UUID_A}`, name: "Tryfan", tickedAt: "2026-10-16T09:00:00.000Z" },
    ]);
    expect(parseTicks(raw)).toHaveLength(1);
  });

  it("reads a stored source as self-reported whatever it claims to be", () => {
    /* Nothing has ever written another kind, so a file claiming one was not
       written by this app and its claim is not evidence. */
    const raw = JSON.stringify([
      { summitId: UUID_A, name: "Tryfan", tickedAt: "2026-10-15T09:00:00.000Z", source: "gps_verified" },
    ]);
    expect(parseTicks(raw)[0]!.source).toBe("self_reported");
  });
});

describe("tickedIds", () => {
  it("hands the map bare ids, which is what it compares", () => {
    expect(tickedIds([tick(UUID_A), tick(UUID_B)])).toEqual([UUID_A, UUID_B]);
  });

  it("is empty when nothing is ticked", () => {
    expect(tickedIds([])).toEqual([]);
  });
});
