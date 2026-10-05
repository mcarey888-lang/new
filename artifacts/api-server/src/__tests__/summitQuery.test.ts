import { describe, expect, it } from "vitest";
import { buildSummitQuery, withTiedVariants } from "../services/summits/summitQuery";
import { ALL_SUMMITS_ZOOM, MIN_PIN_ZOOM, pinCap, type BBox } from "../services/summits/summitPins";

/** Snowdonia, roughly. */
const box: BBox = { minLat: 52.98, maxLat: 53.15, minLng: -4.2, maxLng: -3.9 };

describe("using the index that exists", () => {
  /* public.mountains has a GiST index on geom. The && operator uses it.
     Comparing extracted ST_X and ST_Y values against bounds does not, and
     would scan 21,792 rows on every pan while looking entirely reasonable in
     the source. This is the test that catches that rewrite. */

  it("matches the rectangle against geom", () => {
    const q = buildSummitQuery(box, 12)!;
    expect(q.text).toContain("m.geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)");
  });

  it("never filters on extracted coordinates", () => {
    for (const zoom of [MIN_PIN_ZOOM, 9, 10, 12, ALL_SUMMITS_ZOOM, 17]) {
      const q = buildSummitQuery(box, zoom);
      if (!q) continue;
      const where = q.text.slice(q.text.indexOf("WHERE"));
      expect(where, `zoom ${zoom} compares extracted coordinates`).not.toMatch(/ST_[XY]\s*\(\s*m\.geom\s*\)\s*[<>]/);
    }
  });

  it("passes the envelope west, south, east, north", () => {
    // Swapped, this returns an empty rectangle rather than an error, and an
    // empty result looks exactly like moorland with no hills on it.
    const q = buildSummitQuery(box, 12)!;
    expect(q.params.slice(0, 4)).toEqual([box.minLng, box.minLat, box.maxLng, box.maxLat]);
  });
});

describe("what the cap costs you", () => {
  it("always has one", () => {
    for (const zoom of [MIN_PIN_ZOOM, 9, 11, ALL_SUMMITS_ZOOM, 18]) {
      const q = buildSummitQuery(box, zoom)!;
      expect(q.text).toMatch(/LIMIT \$\d+$/);
      expect(q.params[q.params.length - 1]).toBe(pinCap(zoom));
    }
  });

  it("orders by prominence, so truncating drops the least significant", () => {
    // Without an order, the rows that survive are whichever the planner
    // reached first, and a busy area would lose Munros and keep nameless
    // bumps.
    const q = buildSummitQuery(box, ALL_SUMMITS_ZOOM)!;
    expect(q.text).toContain("ORDER BY m.prominence_m DESC NULLS LAST");
  });

  it("breaks ties on something stable, so paging cannot repeat a hill", () => {
    expect(buildSummitQuery(box, 14)!.text).toMatch(/ORDER BY[^]*m\.id/);
  });
});

describe("the zoom bands", () => {
  it("builds nothing at all on a globe", () => {
    for (const zoom of [0, 4, MIN_PIN_ZOOM - 1]) expect(buildSummitQuery(box, zoom)).toBeNull();
  });

  it("asks for the named lists when a country is on screen", () => {
    const q = buildSummitQuery(box, MIN_PIN_ZOOM)!;
    expect(q.text).toContain("mountain_classifications");
    expect(q.text).toContain("classification_code = ANY(");
    const codes = q.params[4] as string[];
    expect(codes).toContain("M");
    expect(codes).toContain("W");
    expect(codes).toContain("C");
  });

  it("asks by prominence in the middle bands", () => {
    const q = buildSummitQuery(box, 9)!;
    expect(q.text).toContain("m.prominence_m >= $5");
    expect(q.params[4]).toBe(150);
  });

  it("leaves out a hill with no prominence recorded, rather than assuming", () => {
    // Every DoBIH row has one; the 216 international rows may not, and
    // guessing on their behalf would put them on the map at a zoom they did
    // not earn.
    expect(buildSummitQuery(box, 10)!.text).toContain("m.prominence_m IS NOT NULL");
  });

  it("stops filtering once you are close in", () => {
    const q = buildSummitQuery(box, ALL_SUMMITS_ZOOM)!;
    expect(q.text).not.toContain("prominence_m >=");
    expect(q.text).not.toContain("classification_code = ANY");
    expect(q.params).toHaveLength(5); // four for the box, one for the cap
  });
});

describe("tied tops", () => {
  it("asks for both spellings, so a tied Marilyn is still a Marilyn", () => {
    expect(withTiedVariants(["Ma"]).sort()).toEqual(["Ma", "Ma="]);
  });

  it("does not double up when given the tied form", () => {
    expect(withTiedVariants(["Hu="]).sort()).toEqual(["Hu", "Hu="]);
    expect(withTiedVariants(["M", "M="]).sort()).toEqual(["M", "M="]);
  });

  it("ignores an empty code", () => {
    expect(withTiedVariants(["", "=", "W"]).sort()).toEqual(["W", "W="]);
  });
});

describe("nothing reaches the database as text", () => {
  it("keeps every value in parameters", () => {
    // A bounding box arrives straight from a query string. Interpolated, it is
    // an injection; parameterised, it is four numbers.
    for (const zoom of [MIN_PIN_ZOOM, 9, 11, 14]) {
      const q = buildSummitQuery(box, zoom)!;
      for (const value of [box.minLat, box.maxLat, box.minLng, box.maxLng]) {
        expect(q.text, `zoom ${zoom} inlined a coordinate`).not.toContain(String(value));
      }
    }
  });

  it("numbers its placeholders in order, with no gaps", () => {
    for (const zoom of [MIN_PIN_ZOOM, 9, 14]) {
      const q = buildSummitQuery(box, zoom)!;
      const used = [...q.text.matchAll(/\$(\d+)/g)].map(m => Number(m[1]));
      const distinct = [...new Set(used)].sort((a, b) => a - b);
      expect(distinct, `zoom ${zoom}`).toEqual(
        Array.from({ length: q.params.length }, (_, i) => i + 1),
      );
    }
  });
});

describe("the classifications a pin needs", () => {
  it("gathers them per row rather than multiplying the result", () => {
    // A hill carries several — Ben Nevis has eight. Joined plainly, it would
    // come back eight times and the cap would spend itself on one mountain.
    const q = buildSummitQuery(box, 14)!;
    expect(q.text).toContain("LEFT JOIN LATERAL");
    expect(q.text).toContain("array_agg(DISTINCT mc.classification_code)");
  });

  it("gives a hill with none an empty list, not a null", () => {
    expect(buildSummitQuery(box, 14)!.text).toContain("COALESCE(c.codes, ARRAY[]::text[])");
  });
});
