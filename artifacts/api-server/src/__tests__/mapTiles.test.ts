import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_TILE_ZOOM,
  TILESETS,
  cacheStats,
  clearTileCache,
  validTile,
} from "../routes/map-tiles";
import { baseLayers } from "../routes/route-map-web";

afterEach(() => clearTileCache());

describe("validTile", () => {
  it("accepts a real tile address", () => {
    expect(validTile(13, 4019, 2666)).toBe(true);
    expect(validTile(0, 0, 0)).toBe(true);
  });

  it("rejects coordinates outside the grid that zoom has", () => {
    /* z1 is a 2x2 grid, so 2 is off the edge. Forwarding this would spend a
       billed Mapbox request to be told what we already know. */
    expect(validTile(1, 2, 0)).toBe(false);
    expect(validTile(1, 0, 2)).toBe(false);
    expect(validTile(1, -1, 0)).toBe(false);
  });

  it("rejects anything that is not a whole number", () => {
    /* Number("") is 0 and Number("abc") is NaN, so a missing or junk path
       parameter must be caught here rather than reaching the upstream URL. */
    expect(validTile(NaN, 0, 0)).toBe(false);
    expect(validTile(13, 1.5, 2666)).toBe(false);
    expect(validTile(Infinity, 0, 0)).toBe(false);
  });

  it("refuses zoom past what the proxy will serve", () => {
    expect(validTile(MAX_TILE_ZOOM, 0, 0)).toBe(true);
    expect(validTile(MAX_TILE_ZOOM + 1, 0, 0)).toBe(false);
    expect(validTile(-1, 0, 0)).toBe(false);
  });
});

describe("tileset allowlist", () => {
  it("is the security boundary, so it holds only what we intend", () => {
    expect(Object.keys(TILESETS).sort()).toEqual(["satellite", "satellite-streets"]);
  });

  it("builds URLs that carry the token and the address", () => {
    const url = TILESETS["satellite"]!.url(13, 4019, 2666, "tok");
    expect(url.startsWith("https://api.mapbox.com/")).toBe(true);
    expect(url).toContain("/13/4019/2666");
    expect(url).toContain("access_token=tok");
  });

  it("declares the tile scheme each endpoint actually serves", () => {
    /* These are different Mapbox APIs. The v4 raster endpoint is a 256 scheme;
       the style-rendering endpoint asked for 512 tiles is a 512 scheme. Telling
       the map the wrong one offsets imagery against the terrain, which looks
       like bad data rather than a config mistake. */
    expect(TILESETS["satellite"]!.tileSize).toBe(256);
    expect(TILESETS["satellite-streets"]!.tileSize).toBe(512);
  });
});

describe("cache", () => {
  it("starts empty and reports itself honestly", () => {
    expect(cacheStats()).toEqual({ entries: 0, bytes: 0 });
  });
});

describe("baseLayers with satellite", () => {
  const prefix = "/api/map-tiles";

  it("offers no satellite layer without a token", () => {
    const ids = baseLayers("oskey", prefix, false).map((l) => l.id);
    expect(ids).not.toContain("satellite");
    /* A missing token must not take the rest of the map down with it. */
    expect(ids).toContain("osm");
  });

  it("offers no satellite layer without somewhere to proxy to", () => {
    const ids = baseLayers("oskey", undefined, true).map((l) => l.id);
    expect(ids).not.toContain("satellite");
  });

  it("points satellite at this server, never at Mapbox directly", () => {
    const sat = baseLayers("oskey", prefix, true).find((l) => l.id === "satellite");
    expect(sat).toBeDefined();
    expect(sat!.tiles).toBe("/api/map-tiles/satellite/{z}/{x}/{y}");
    /* The entire reason the proxy exists. If a Mapbox URL ever appears in a
       layer the token is about to ship to every browser that loads the page. */
    expect(sat!.tiles).not.toContain("mapbox.com");
    expect(sat!.tiles).not.toContain("access_token");
  });

  it("honours the mount point it was given", () => {
    const sat = baseLayers("oskey", "/elsewhere/map-tiles", true).find(
      (l) => l.id === "satellite",
    );
    expect(sat!.tiles).toBe("/elsewhere/map-tiles/satellite/{z}/{x}/{y}");
  });

  it("keeps OS first, because that is the layer a route is drawn on", () => {
    /* Imagery is the layer you check a line against; it marks no rights of way,
       so it must not become the default anyone lands on. */
    expect(baseLayers("oskey", prefix, true)[0]!.id).toBe("Outdoor_3857");
  });

  it("never asks for zoom the proxy will refuse", () => {
    for (const l of baseLayers("oskey", prefix, true)) {
      if (l.id.startsWith("satellite")) expect(l.maxZoom).toBeLessThanOrEqual(MAX_TILE_ZOOM);
    }
  });

  it("credits the imagery, which the licence requires", () => {
    const sat = baseLayers("oskey", prefix, true).find((l) => l.id === "satellite");
    expect(sat!.attribution).toContain("Mapbox");
  });
});
