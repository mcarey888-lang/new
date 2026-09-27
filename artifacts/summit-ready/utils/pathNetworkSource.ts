/**
 * Where a snap-to-path network comes from.
 *
 * Kept behind an interface because the drawing feature must not wait on a
 * decision nobody has made yet. Today the only path network in the repository
 * is a 3.7 MB GeoJSON under `summit-data-engine/data/processed/`, which is not
 * shipped with the app. Three ways it could be:
 *
 *   bundled   a small per-region extract as an app asset — works offline from
 *             the first launch, but the regions are fixed at release
 *   fetched   an endpoint returning ways for a bounding box — any region, but
 *             needs network at plan time
 *   cached    fetched once, then held on device for the regions a person uses
 *
 * All three satisfy `PathNetworkSource`, so the screen and the drawing state
 * machine are written once and the choice can be made later, or changed, or
 * mixed. `describe()` exists so the UI can tell a person where the paths came
 * from, which matters when the answer is "a snapshot from March".
 *
 * NOT a place for rights decisions. A network snapped against carries whatever
 * licence its source carried, and that has to travel with the drawn route —
 * see `attribution`, which the drawing screen is obliged to display.
 */

import type { LatLng, PathWay } from "./pathSnapping";

export interface NetworkRegion {
  minLatitude: number;
  minLongitude: number;
  maxLatitude: number;
  maxLongitude: number;
}

export interface PathNetworkBundle {
  ways: PathWay[];
  /** Shown on the drawing screen. ODbL requires it; honesty requires it too. */
  attribution: string;
  /** Where these paths came from, in words a person can read. */
  describe: string;
  /** ISO date the underlying extract was taken, when the source knows it. */
  retrievedAt: string | null;
  region: NetworkRegion | null;
}

export interface PathNetworkSource {
  /**
   * Ways covering `region`, or null when this source has nothing for it.
   *
   * Null is a real answer, not a failure: most of the world has no extract
   * loaded, and the screen must say "no path data here — draw freehand" rather
   * than present an empty map as if every path were missing.
   */
  load(region: NetworkRegion): Promise<PathNetworkBundle | null>;
}

/** `[minLon, minLat, maxLon, maxLat]`, the order GeoJSON `bbox` uses. */
export type BboxTuple = [number, number, number, number];

export function regionFromBbox(bbox: BboxTuple): NetworkRegion {
  return {
    minLongitude: bbox[0],
    minLatitude: bbox[1],
    maxLongitude: bbox[2],
    maxLatitude: bbox[3],
  };
}

export function regionContains(region: NetworkRegion, point: LatLng): boolean {
  return (
    point.latitude >= region.minLatitude &&
    point.latitude <= region.maxLatitude &&
    point.longitude >= region.minLongitude &&
    point.longitude <= region.maxLongitude
  );
}

export function regionsOverlap(a: NetworkRegion, b: NetworkRegion): boolean {
  return (
    a.minLatitude <= b.maxLatitude &&
    a.maxLatitude >= b.minLatitude &&
    a.minLongitude <= b.maxLongitude &&
    a.maxLongitude >= b.minLongitude
  );
}

/**
 * Read ways out of a path-network FeatureCollection.
 *
 * The shape the data engine's `tryfan_candidate_path_network.geojson` exports:
 * LineString or MultiLineString features carrying `osm_id`, `name`, `highway`.
 * A MultiLineString is one way exported as its individual segments, so the
 * parts concatenate back into the way.
 *
 * Permissive about a single feature on purpose — one unreadable geometry must
 * not cost a person the whole region's paths. It is skipped and counted.
 */
export function parsePathNetworkGeoJson(
  document: unknown,
): { ways: PathWay[]; skipped: number } {
  const doc = document as {
    type?: unknown;
    features?: unknown;
  };
  if (doc?.type !== "FeatureCollection" || !Array.isArray(doc.features)) {
    throw new Error("expected a GeoJSON FeatureCollection of path ways");
  }

  const ways: PathWay[] = [];
  let skipped = 0;

  for (const raw of doc.features) {
    const feature = raw as {
      properties?: Record<string, unknown> | null;
      geometry?: { type?: unknown; coordinates?: unknown } | null;
    };
    const properties = feature?.properties ?? {};
    const geometry = feature?.geometry;
    const kind = geometry?.type;

    if (kind !== "LineString" && kind !== "MultiLineString") {
      skipped += 1;
      continue;
    }
    const raws = geometry?.coordinates;
    if (!Array.isArray(raws)) {
      skipped += 1;
      continue;
    }
    const parts = (kind === "LineString" ? [raws] : raws) as unknown[];

    const points: LatLng[] = [];
    let malformed = false;
    for (const part of parts) {
      if (!Array.isArray(part)) {
        malformed = true;
        break;
      }
      for (const position of part) {
        if (!Array.isArray(position) || position.length < 2) {
          malformed = true;
          break;
        }
        const longitude = Number(position[0]);
        const latitude = Number(position[1]);
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
          malformed = true;
          break;
        }
        const last = points[points.length - 1];
        // Consecutive repeats carry no length and break endpoint comparison.
        if (!last || last.latitude !== latitude || last.longitude !== longitude) {
          points.push({ latitude, longitude });
        }
      }
      if (malformed) break;
    }

    const wayId = Number(properties.osm_id ?? properties.wayId);
    if (malformed || points.length < 2 || !Number.isFinite(wayId)) {
      skipped += 1;
      continue;
    }
    const name = properties.name;
    ways.push({
      wayId,
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      points,
    });
  }

  return { ways, skipped };
}

/**
 * A source backed by GeoJSON already in hand — a bundled asset, or a response
 * body. Serves its ways whenever the asked-for region overlaps its own.
 */
export function staticPathNetworkSource(input: {
  document: unknown;
  attribution: string;
  describe: string;
  retrievedAt?: string | null;
  region?: NetworkRegion | null;
}): PathNetworkSource {
  const parsed = parsePathNetworkGeoJson(input.document);
  const region = input.region ?? boundingRegion(parsed.ways);
  const bundle: PathNetworkBundle = {
    ways: parsed.ways,
    attribution: input.attribution,
    describe: input.describe,
    retrievedAt: input.retrievedAt ?? null,
    region,
  };
  return {
    async load(asked) {
      if (region && !regionsOverlap(region, asked)) return null;
      return bundle;
    },
  };
}

/** The region a set of ways covers, or null when there are none. */
export function boundingRegion(ways: PathWay[]): NetworkRegion | null {
  let minLatitude = Infinity;
  let minLongitude = Infinity;
  let maxLatitude = -Infinity;
  let maxLongitude = -Infinity;
  for (const way of ways) {
    for (const point of way.points) {
      if (point.latitude < minLatitude) minLatitude = point.latitude;
      if (point.latitude > maxLatitude) maxLatitude = point.latitude;
      if (point.longitude < minLongitude) minLongitude = point.longitude;
      if (point.longitude > maxLongitude) maxLongitude = point.longitude;
    }
  }
  if (!Number.isFinite(minLatitude)) return null;
  return { minLatitude, minLongitude, maxLatitude, maxLongitude };
}

/** A source that has nothing, for the case where no extract is configured. */
export const emptyPathNetworkSource: PathNetworkSource = {
  async load() {
    return null;
  },
};
