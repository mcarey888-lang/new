import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Figures on screen have to come from somewhere real.
 *
 * Both faults here shipped the same way: a mock-up's placeholder numbers were
 * left in place when the screen was wired to real data, and nothing told a
 * reader which was which. A wrong number presented confidently is worse than
 * a missing one, because the reader has no way to check it.
 */

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("Base Camp region cards", () => {
  const body = code(read("app/(expedition)/base-camp.tsx"));

  it("states no route count it cannot stand behind", () => {
    /* These read "48 routes", "52 routes" and so on, hand-written and
       matching nothing in the catalogue. */
    expect(body).not.toMatch(/routes:\s*\d+/);
    expect(body).not.toMatch(/\{\s*r\.routes\s*\}/);
  });

  it("still lists the regions", () => {
    /* Removing the invented part must not quietly remove the feature. */
    for (const region of ["Snowdonia", "Lake District", "Scotland", "Peak District"]) {
      expect(body).toContain(region);
    }
  });
});

describe("the ready-for peak list", () => {
  const body = read("app/(tabs)/account.tsx");

  it("calls an ascent figure an ascent", () => {
    /* The number is the climb on a normal route, not the summit height.
       Unlabelled it reads as the height, and "Tanzania · 1200m" next to
       Kilimanjaro — a mountain of 5,895 m — is simply a wrong fact. */
    expect(body).toMatch(/\{peak\.elevation\}m ascent/);
    expect(body).not.toMatch(/\{peak\.location\} · \{peak\.elevation\}m</);
  });

  it("keeps the figures that drive the comparison", () => {
    const peaks = body.match(/elevation:\s*\d+/g) ?? [];
    expect(peaks.length).toBeGreaterThan(10);
  });
});
