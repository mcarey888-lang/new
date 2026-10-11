import { describe, expect, it } from "vitest";
import { primaryTabBarHeight } from "./tabBarLayout";

describe("primary navigation footprint", () => {
  it("reserves the entire web navigation height", () => {
    expect(primaryTabBarHeight("web", 0)).toBe(80);
    expect(primaryTabBarHeight("web", 34)).toBe(80);
  });
  it("includes native home-indicator space without counting it twice", () => {
    expect(primaryTabBarHeight("ios", 34)).toBe(96);
    expect(primaryTabBarHeight("android", 24)).toBe(86);
    expect(primaryTabBarHeight("android", 0)).toBe(62);
  });
});
