import { describe, expect, it } from "vitest";
import { buildGpx, escapeXml, gpxFilename } from "../services/routing/gpx";

const AT = new Date("2026-03-14T09:30:00.000Z");
const PTS = [
  { latitude: 53.12250, longitude: -3.99700, elevationM: 339.2 },
  { latitude: 53.11800, longitude: -3.99750, elevationM: 589.4 },
  { latitude: 53.11500, longitude: -3.99860, elevationM: 839.1 },
];

describe("escaping", () => {
  it("makes a name with XML characters safe", () => {
    /* A route called "Tryfan & Bristly Ridge" must not produce a file no
       parser will open. */
    expect(escapeXml(`A & B <c> "d" 'e'`)).toBe("A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;");
  });

  it("escapes the name everywhere it appears", () => {
    const gpx = buildGpx({ points: PTS, name: "Tryfan & Glyders", time: AT });
    expect(gpx).not.toMatch(/Tryfan & /);
    expect((gpx.match(/Tryfan &amp; Glyders/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("filenames", () => {
  it("is safe on a device that mounts as a plain filesystem", () => {
    /* A colon or a slash is how a download silently fails on one device and
       not another. */
    const f = gpxFilename("Tryfan: North Ridge / Heather Terrace", AT);
    expect(f).not.toMatch(/[:/\\?*"<>|]/);
    expect(f.endsWith(".gpx")).toBe(true);
  });

  it("dates the file, so a second attempt is distinguishable", () => {
    expect(gpxFilename("Route", AT)).toContain("2026-03-14");
  });

  it("still produces something for a nameless or unusable name", () => {
    expect(gpxFilename(undefined, AT)).toBe("route-2026-03-14.gpx");
    expect(gpxFilename("！！！", AT)).toBe("route-2026-03-14.gpx");
  });

  it("does not run away with a very long name", () => {
    expect(gpxFilename("x".repeat(500), AT).length).toBeLessThan(90);
  });
});

describe("the file itself", () => {
  const gpx = buildGpx({
    points: PTS, name: "North Ridge", time: AT,
    unsnappedSections: 0, ascentM: 500, lengthM: 840,
  });

  it("declares GPX 1.1 with its schema, for strict readers", () => {
    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain('version="1.1"');
    expect(gpx).toContain("http://www.topografix.com/GPX/1/1/gpx.xsd");
  });

  it("carries every point, in order", () => {
    const lats = [...gpx.matchAll(/lat="([\d.-]+)"/g)].map(m => Number(m[1]));
    expect(lats).toEqual([53.1225, 53.118, 53.115]);
  });

  it("carries elevations where they are known", () => {
    expect(gpx).toContain("<ele>339.2</ele>");
    expect(gpx).toContain("<ele>839.1</ele>");
  });

  it("omits the elevation tag rather than writing zero", () => {
    /* Zero is sea level. A watch reading it would compute a climb out of a
       cliff that is not there. */
    const partial = buildGpx({
      points: [
        { latitude: 53.1, longitude: -4, elevationM: 300 },
        { latitude: 53.11, longitude: -4, elevationM: null },
      ],
      time: AT,
    });
    expect(partial).toContain("<ele>300.0</ele>");
    expect(partial).not.toContain("<ele>0");
    expect((partial.match(/<ele>/g) ?? []).length).toBe(1);
  });

  it("is structurally sound, every tag opened and closed", () => {
    /* This project has no XML parser, and adding one for a test is not worth a
       dependency. The output was checked against a real parser out of band —
       Python's ElementTree read the downloaded file and found 122 track points
       — and what is asserted here is the balance that would break first if the
       template were edited carelessly. */
    for (const tag of ["gpx", "metadata", "trk", "trkseg"]) {
      expect((gpx.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length)
        .toBe((gpx.match(new RegExp(`</${tag}>`, "g")) ?? []).length);
    }
    expect(gpx.split("<trkpt").length - 1).toBe(gpx.split("</trkpt>").length - 1);
    expect(gpx.split("<trkpt").length - 1).toBe(3);
  });
});

describe("the file says where it came from", () => {
  /* GPX has no field for "this part is a guess". Loaded onto a watch, a line
     drawn with a finger looks exactly like one surveyed on the ground. The
     description is the only place provenance can go, and most software shows
     it. */

  it("says it was drawn, not walked", () => {
    expect(buildGpx({ points: PTS, time: AT })).toContain("not a recorded track");
  });

  it("counts the sections that do not follow a path", () => {
    const g = buildGpx({ points: PTS, unsnappedSections: 3, time: AT });
    expect(g).toContain("3 sections do not follow a mapped path");
  });

  it("says so plainly when every section does follow one", () => {
    expect(buildGpx({ points: PTS, unsnappedSections: 0, time: AT }))
      .toContain("Every section follows a path mapped in OpenStreetMap");
  });

  it("gets the singular right, because a file that reads wrong is read less", () => {
    /* This test previously asserted "1 section do", which locked in the bug it
       was meant to catch. Written against correct English now, not against
       whatever the code happened to emit. */
    const one = buildGpx({ points: PTS, unsnappedSections: 1, time: AT });
    expect(one).toContain("1 section does not follow a mapped path and is a straight line");
    expect(one).not.toContain("1 sections");
    const many = buildGpx({ points: PTS, unsnappedSections: 3, time: AT });
    expect(many).toContain("3 sections do not follow a mapped path and are straight lines");
  });

  it("does not let the heights pass as surveyed", () => {
    expect(buildGpx({ points: PTS, time: AT }))
      .toContain("terrain model of about 30 m resolution, not a survey");
  });

  it("says when there are no heights at all", () => {
    const flat = buildGpx({
      points: [{ latitude: 53.1, longitude: -4 }, { latitude: 53.11, longitude: -4 }],
      time: AT,
    });
    expect(flat).toContain("No elevation data is included");
  });

  it("includes the figures it was given", () => {
    const g = buildGpx({ points: PTS, ascentM: 500, lengthM: 840, time: AT });
    expect(g).toContain("Length 0.84 km");
    expect(g).toContain("Estimated ascent 500 m");
  });
});
