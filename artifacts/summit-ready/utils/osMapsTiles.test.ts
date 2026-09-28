import { describe, expect, it } from "vitest";
import {
  DEFAULT_OS_LAYER,
  OS_MAX_ZOOM,
  osTileSource,
  osTileTemplate,
} from "./osMapsTiles";

describe("osTileSource", () => {
  it("builds a Web Mercator ZXY template the map can consume", () => {
    const source = osTileSource("abc123");
    expect(source).not.toBeNull();
    /* UrlTile substitutes these itself, so they must survive into the string
       rather than being interpolated away. */
    expect(source?.urlTemplate).toContain("{z}/{x}/{y}");
    expect(source?.urlTemplate).toContain("key=abc123");
    expect(source?.layer).toBe(DEFAULT_OS_LAYER);
    expect(source?.maximumZ).toBe(OS_MAX_ZOOM);
  });

  it("requests as deep as the layer is confirmed to serve", () => {
    /* Verified against the live API over Tryfan: z15, 16 and 17 all return
       imagery, and rights of way are legible at 17. Lowering this throws away
       precision exactly where a waypoint needs placing on a ridge. */
    expect(OS_MAX_ZOOM).toBeGreaterThanOrEqual(17);
  });

  it("defaults to the only walker-facing Web Mercator layer", () => {
    /* Leisure_27700 is the 1:25k Explorer mapping people actually want, but it
       is British National Grid and would silently return tiles for the wrong
       place on a 3857 grid. The default must stay a _3857 layer. */
    expect(DEFAULT_OS_LAYER).toBe("Outdoor_3857");
    expect(DEFAULT_OS_LAYER.endsWith("_3857")).toBe(true);
  });

  it("honours a different Web Mercator layer", () => {
    expect(osTileSource("k", "Light_3857")?.urlTemplate).toContain("/Light_3857/");
  });

  it("is null without a key, which is a supported state", () => {
    expect(osTileSource(null)).toBeNull();
    expect(osTileSource(undefined)).toBeNull();
    expect(osTileSource("")).toBeNull();
    /* A secret set to whitespace is the classic broken-env case, and it must
       not produce a URL that 401s on every tile. */
    expect(osTileSource("   ")).toBeNull();
    expect(osTileTemplate(null)).toBeNull();
  });

  it("trims and escapes the key rather than pasting it raw", () => {
    expect(osTileSource("  spaced  ")?.urlTemplate).toContain("key=spaced");
    expect(osTileSource("a b&c")?.urlTemplate).toContain("key=a%20b%26c");
  });

  it("carries the attribution OS licensing requires", () => {
    expect(osTileSource("k")?.attribution).toContain("Crown copyright");
  });
});
