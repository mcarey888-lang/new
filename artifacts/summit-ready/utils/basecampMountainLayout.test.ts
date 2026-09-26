import { describe, expect, it } from "vitest";
import { BASECAMP_AXIS_WIDTH, basecampMountainLayout } from "./basecampMountainLayout";

describe("Basecamp progress mountain viewport", () => {
  it.each([320, 375, 402, 430])("fits the artwork and route at %spx phone width", screenWidth => {
    const contentWidth = screenWidth - 2 * 17 - 2; // Basecamp gutters and card border
    const layout = basecampMountainLayout(contentWidth);
    expect(layout.plotWidth * 406 / 380 + BASECAMP_AXIS_WIDTH).toBeCloseTo(contentWidth);
    expect(layout.plotHeight).toBeCloseTo(layout.plotWidth * 344 / 380);
    expect(layout.topSpace).toBeGreaterThan(layout.plotWidth * 22 / 380);
    expect(layout.totalHeight - layout.topSpace - layout.plotHeight).toBeGreaterThan(0);
  });
});