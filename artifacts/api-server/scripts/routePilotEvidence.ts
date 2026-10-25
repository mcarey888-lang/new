import { createHash } from "node:crypto";

export const sha256 = (bytes: string | Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

type Node = { id: string; version: string; lat: number; lon: number };
type Way = { id: string; version: string; nodes: string[]; tags: Record<string, string> };
export interface PilotCandidate {
  format: string;
  candidateId: string;
  navigationReady: boolean;
  imported: boolean;
  geometrySha256: string;
  sourceSnapshotSha256: string;
  source: { relationId: string; relationVersion: string };
  catalogueMountain: { name: string; elevationM: number };
  distance: { existingExpeditionDistanceKm: number; existingExpeditionAscentM: number };
  orderedSourceEdges: { fromNode: string; toNode: string; wayId: string; wayVersion: string }[];
}
export interface PilotSnapshot {
  licence: string;
  attribution: string;
  nodes: Node[];
  ways: Way[];
  relation: { id: string; version: string };
}
export interface PilotGeometry {
  type: string;
  features: { geometry: { type: string; coordinates: number[][] } }[];
}

function requireEvidence(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Structural/source consistency only. Never route approval or a rights clearance. */
export function validatePilotEvidence(
  candidate: PilotCandidate, geometryBytes: Buffer, snapshotBytes: Buffer,
) {
  requireEvidence(candidate.format === "summitready-route-review-candidate-v1", "Unsupported candidate format");
  requireEvidence(candidate.navigationReady === false && candidate.imported === false, "Expected an unimported review candidate");
  requireEvidence(sha256(geometryBytes) === candidate.geometrySha256, "Geometry checksum mismatch");
  requireEvidence(sha256(snapshotBytes) === candidate.sourceSnapshotSha256, "Source snapshot checksum mismatch");
  const geometry = JSON.parse(geometryBytes.toString("utf8")) as PilotGeometry;
  const snapshot = JSON.parse(snapshotBytes.toString("utf8")) as PilotSnapshot;
  requireEvidence(geometry.type === "FeatureCollection" && geometry.features?.length === 1, "Expected one route feature");
  const feature = geometry.features[0]!.geometry;
  requireEvidence(feature?.type === "LineString" && Array.isArray(feature.coordinates), "Expected a route LineString");
  const coordinates = feature.coordinates;
  requireEvidence(coordinates.length >= 2 && coordinates.length <= 10_000, "Route point limit exceeded or empty");
  requireEvidence(coordinates.every(p => p.length === 2 && p.every(Number.isFinite)
    && Math.abs(p[0]!) <= 180 && Math.abs(p[1]!) < 85), "Invalid route coordinates");
  requireEvidence(snapshot.relation?.id === candidate.source.relationId
    && snapshot.relation.version === candidate.source.relationVersion, "Relation identity/version mismatch");
  requireEvidence(snapshot.licence === "ODbL-1.0" && !!snapshot.attribution, "Missing OSM licence/attribution declaration");
  const nodes = new Map(snapshot.nodes.map(n => [n.id, n]));
  const ways = new Map(snapshot.ways.map(w => [w.id, w]));
  requireEvidence(nodes.size === snapshot.nodes.length && ways.size === snapshot.ways.length, "Duplicate source identities");
  requireEvidence(snapshot.nodes.every(n => !!n.version && Number.isFinite(n.lat) && Number.isFinite(n.lon)), "Unversioned/invalid source node");
  requireEvidence(candidate.orderedSourceEdges?.length === coordinates.length - 1, "Geometry/edge count mismatch");
  const usedWays = new Set<string>();
  for (const [index, edge] of candidate.orderedSourceEdges.entries()) {
    const way = ways.get(edge.wayId);
    requireEvidence(way && way.version === edge.wayVersion, "Source way version mismatch");
    requireEvidence(way.nodes.some((a, i) => {
      const b = way.nodes[i + 1];
      return (a === edge.fromNode && b === edge.toNode) || (a === edge.toNode && b === edge.fromNode);
    }), "Geometry edge is not an actual adjacent source-node pair");
    const from = nodes.get(edge.fromNode), to = nodes.get(edge.toNode);
    requireEvidence(from && to, "Missing source node");
    requireEvidence(coordinates[index]![0] === from.lon && coordinates[index]![1] === from.lat
      && coordinates[index + 1]![0] === to.lon && coordinates[index + 1]![1] === to.lat, "Geometry coordinates differ from source");
    usedWays.add(way.id);
  }
  const accessReviewFlags: { wayId: string; field: string; value: string }[] = [];
  for (const id of usedWays) {
    const way = ways.get(id)!;
    for (const field of ["foot", "access", "foot:conditional", "access:conditional", "oneway:foot"]) {
      const value = way.tags[field];
      if (value && ((field.endsWith(":conditional"))
        || (field === "oneway:foot" ? !["no", "false", "0"].includes(value)
          : !["yes", "designated", "permissive", "official"].includes(value)))) {
        accessReviewFlags.push({ wayId: id, field, value });
      }
    }
  }
  return { coordinates, sourceEdgesChecked: candidate.orderedSourceEdges.length,
    usedSourceWays: usedWays.size, accessReviewFlags,
    structuralSourceConsistencyPassed: true, humanReviewed: false, publicationEligible: false };
}
