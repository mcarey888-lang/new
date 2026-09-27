import { describe, expect, it } from "vitest";
import { monthlyGain } from "./elevationBankHero";
import { DEMO_MONTHLY_ASCENT, savedDemoYear } from "./savedDemoYear";

describe("saved fictional year", () => {
  it("creates a consistent year without claiming verified credits", () => {
    const year = savedDemoYear("2026-09-26T12:00:00.000Z");
    expect(year.hikes).toHaveLength(24);
    expect(year.expeditions).toHaveLength(3);
    expect(year.ascentM).toBe(DEMO_MONTHLY_ASCENT.reduce((sum, ascent) => sum + ascent, 0));
    expect(year.hikes.reduce((sum, hike) => sum + hike.ascentM, 0)).toBe(year.ascentM);
    expect(year.hikes[0].date).toBe("2026-09-19");
    expect(year.hikes.at(-1)?.date).toBe("2025-10-06");
    expect(Object.keys(year)).toEqual(["hikes", "expeditions", "ascentM"]);
  });

  it("fills the approved hero chart with all twelve sample months", () => {
    const year = savedDemoYear("2026-09-26T12:00:00.000Z");
    const monthly = monthlyGain(
      year.hikes.map(hike => ({ effectiveAt: `${hike.date}T12:00:00`, ascentM: hike.ascentM })),
      12,
      new Date(`${year.hikes[0].date}T12:00:00`),
    );
    expect(monthly.map(month => month.ascentM)).toEqual([...DEMO_MONTHLY_ASCENT]);
    expect(monthly.reduce((sum, month) => sum + month.ascentM, 0)).toBe(year.ascentM);
  });
});