import type { LatLng } from "./pathSnapping";

/**
 * GPX for a drawn route.
 *
 * GPX is what a watch, a handheld GPS and every other hill app will read, so
 * this is how a route planned here leaves the building.
 *
 * THE HONESTY PROBLEM GPX HAS
 * ---------------------------
 * A GPX file says nothing about where its data came from. Loaded onto a watch,
 * a line somebody drew with their finger looks exactly like a line surveyed on
 * the ground, and an elevation interpolated from a 30 m grid looks exactly
 * like one measured by a barometer. The format has no field for "this part is
 * a guess".
 *
 * What it does have is a metadata description and a track description, and
 * both are shown by most software. So the provenance goes there, in plain
 * words: that the route was drawn rather than walked, how many sections do not
 * follow a mapped path, and that the heights come from a terrain model. It is
 * not enforcement — nothing can stop a file being trusted — but it means the
 * file never silently claims more than it knows.
 *
 * Elevations are included despite that, because a route without them is worse:
 * the device computes its own climb from a flat line and reports zero, which
 * is a confident wrong answer rather than an honest approximate one.
 */

export interface GpxPoint extends LatLng {
  /** Metres. Omitted where the terrain model had no answer — never zero,
   *  which a device would read as sea level. */
  elevationM?: number | null;
}

export interface GpxInput {
  points: readonly GpxPoint[];
  name?: string;
  /** Sections that do not follow a mapped path, so the file can say so. */
  unsnappedSections?: number;
  ascentM?: number | null;
  lengthM?: number | null;
  /** Fixed by the caller in tests; defaults to now. */
  time?: Date;
}

/** XML text escaping. A route named with an ampersand must not produce a file
 *  no parser will open. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * A filename that is safe on every platform.
 *
 * Phones and watches mount as plain filesystems, and a colon or a slash in a
 * track name is how a download silently fails on one device and not another.
 */
export function gpxFilename(name: string | undefined, time = new Date()): string {
  const base = (name ?? "route")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  const stamp = time.toISOString().slice(0, 10);
  return `${base || "route"}-${stamp}.gpx`;
}

/** Six decimal places is about 11 cm. More is noise dressed as precision. */
const coord = (v: number) => v.toFixed(6);

export function buildGpx(input: GpxInput): string {
  const time = input.time ?? new Date();
  const name = input.name?.trim() || "Planned route";

  const provenance: string[] = [
    "Drawn in SummitReady — a planned line, not a recorded track.",
  ];
  if (input.unsnappedSections && input.unsnappedSections > 0) {
    const one = input.unsnappedSections === 1;
    provenance.push(
      `${input.unsnappedSections} section${one ? "" : "s"} ` +
        `${one ? "does" : "do"} not follow a mapped path and ` +
        `${one ? "is a straight line" : "are straight lines"} between points.`,
    );
  } else {
    provenance.push("Every section follows a path mapped in OpenStreetMap.");
  }
  const hasElevation = input.points.some(p => typeof p.elevationM === "number");
  provenance.push(
    hasElevation
      ? "Elevations are from a terrain model of about 30 m resolution, not a survey."
      : "No elevation data is included.",
  );
  if (typeof input.lengthM === "number") {
    provenance.push(`Length ${(input.lengthM / 1000).toFixed(2)} km.`);
  }
  if (typeof input.ascentM === "number") {
    provenance.push(`Estimated ascent ${input.ascentM} m.`);
  }
  const desc = escapeXml(provenance.join(" "));

  const trkpts = input.points
    .map(p => {
      const ele =
        typeof p.elevationM === "number" && Number.isFinite(p.elevationM)
          ? `<ele>${p.elevationM.toFixed(1)}</ele>`
          : "";
      return `<trkpt lat="${coord(p.latitude)}" lon="${coord(p.longitude)}">${ele}</trkpt>`;
    })
    .join("\n      ");

  /* GPX 1.1, declared properly. A file without the schema location is accepted
     by forgiving readers and rejected by strict ones, and which device someone
     owns is not something to leave to luck. */
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SummitReady"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <desc>${desc}</desc>
    <time>${time.toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <desc>${desc}</desc>
    <trkseg>
      ${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}
