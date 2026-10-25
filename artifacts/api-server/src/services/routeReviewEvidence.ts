import { createHash } from "node:crypto";
import { z } from "zod";
import { resample, SAMPLE_INTERVAL_M } from "./routing/profile.js";
import { distanceM } from "./routing/pathSnapping.js";

export const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const digest = /^[0-9a-f]{64}$/;
export const candidateInput = z.object({
  candidateKey: z.string().trim().min(1).max(160),
  revisionVersion: z.string().trim().min(1).max(100),
  geometryFile: z.string().min(1).max(2_000_000),
  sourceManifest: z.array(z.record(z.string(), z.unknown())).min(1).max(2000),
  canonicalGeometryId: z.string().uuid().optional(),
  profileFile: z.string().min(1).max(2_000_000).optional(),
  terrainManifestFile: z.string().min(1).max(500_000).optional(),
}).strict();
export type CandidateInput = z.infer<typeof candidateInput>;
export type EvidenceFile = { name: string; bytes: Buffer; sha256: string };
export type CheckedEvidence = {
  valid: boolean; errors: string[]; warnings: string[]; blockers: string[];
  pointCount: number; bindingCurrent: boolean; profileIncluded: boolean;
  elevationCoverageComplete: boolean; files: EvidenceFile[];
  geometry: { type: "LineString"; coordinates: [number, number][] } | null;
  input: CandidateInput | null;
};
function object(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function json(text: string, label: string, errors: string[]) {
  try { return JSON.parse(text) as unknown; }
  catch { errors.push(`${label} must contain valid JSON.`); return null; }
}
export function checkEvidence(raw: unknown): CheckedEvidence {
  const checked: CheckedEvidence = {
    valid: false, errors: [], warnings: [], blockers: [],
    pointCount: 0, bindingCurrent: false, profileIncluded: false,
    elevationCoverageComplete: false, files: [], geometry: null, input: null,
  };
  const parsed = candidateInput.safeParse(raw);
  if (!parsed.success) {
    checked.errors = parsed.error.issues.map(i => `${i.path.join(".") || "input"}: ${i.message}`);
    return checked;
  }
  const input = checked.input = parsed.data;
  const addFile = (name: string, text: string) => {
    const bytes = Buffer.from(text, "utf8");
    if (bytes.length > (name === "terrain-manifest" ? 500_000 : 2_000_000)) checked.errors.push(`${name} exceeds its UTF-8 byte limit.`);
    checked.files.push({ name, bytes, sha256: sha256(bytes) });
  };
  addFile("geometry", input.geometryFile);
  const geojson = json(input.geometryFile, "Geometry file", checked.errors);
  const geometry = object(geojson) && geojson.type === "Feature" ? geojson.geometry : geojson;
  if (!object(geometry) || geometry.type !== "LineString" || !Array.isArray(geometry.coordinates)
    || geometry.coordinates.length < 2 || geometry.coordinates.length > 20000
    || !geometry.coordinates.every((p: unknown) => Array.isArray(p) && p.length === 2
      && typeof p[0] === "number" && Number.isFinite(p[0]) && Math.abs(p[0]) <= 180
      && typeof p[1] === "number" && Number.isFinite(p[1]) && Math.abs(p[1]) <= 90)) {
    checked.errors.push("Geometry must be a 2D WGS84 LineString (or single Feature), with 2–20,000 finite lon/lat points.");
  } else if (new Set(geometry.coordinates.map((p: number[]) => p.join(","))).size < 2) {
    checked.errors.push("Geometry must contain at least two different coordinates.");
  } else {
    checked.geometry = { type: "LineString", coordinates: geometry.coordinates };
    checked.pointCount = geometry.coordinates.length;
    const points = checked.geometry.coordinates.map(([longitude, latitude]) => ({ longitude, latitude }));
    const length = points.slice(1).reduce((total, point, i) => total + distanceM(points[i]!, point), 0);
    if (length > 60_000) {
      checked.errors.push("Development review is limited to routes up to 60 km to keep profile sampling bounded.");
      checked.geometry = null;
    }
  }
  if (!!input.profileFile !== !!input.terrainManifestFile) checked.errors.push("Provide both profileFile and terrainManifestFile, or neither.");
  if (input.profileFile && input.terrainManifestFile) {
    checked.profileIncluded = true;
    addFile("profile", input.profileFile);
    addFile("terrain-manifest", input.terrainManifestFile);
    const profile = json(input.profileFile, "Profile file", checked.errors);
    const terrain = json(input.terrainManifestFile, "Terrain manifest", checked.errors);
    if (!object(profile) || profile.format !== "summitready-terrain-profile-review-v1"
      || profile.geometrySha256 !== sha256(input.geometryFile)) {
      checked.errors.push("Profile must use the supported review format and match the exact uploaded geometry file SHA-256.");
    } else {
      if (typeof profile.sourceSnapshotSha256 !== "string" || !digest.test(profile.sourceSnapshotSha256)
        || !input.sourceManifest.some(source => source.sha256 === profile.sourceSnapshotSha256)) {
        checked.errors.push("Profile sourceSnapshotSha256 must match an explicit sourceManifest entry SHA-256.");
      }
      const expected = checked.geometry
        ? resample(checked.geometry.coordinates.map(([longitude, latitude]) => ({ longitude, latitude })), SAMPLE_INTERVAL_M) : [];
      const positions = profile.sampledPositions;
      const points = profile.result?.points;
      if (profile.method?.sampleIntervalM !== SAMPLE_INTERVAL_M || !Array.isArray(positions)
        || !expected.length || positions.length !== expected.length
        || !positions.every((p: unknown, i: number) => object(p)
          && Number.isFinite(p.longitude) && Number.isFinite(p.latitude)
          && Math.abs(p.longitude - expected[i]!.longitude) < 1e-9
          && Math.abs(p.latitude - expected[i]!.latitude) < 1e-9)
        || !Array.isArray(points) || points.length !== expected.length) {
        checked.errors.push("Profile sample positions/count/interval do not match this geometry and the active 30 m sampling method.");
      } else {
        checked.elevationCoverageComplete = profile.result?.outcome === "profiled"
          && points.every((p: unknown) => object(p) && Number.isFinite(p.elevationM)
            && p.elevationM >= -500 && p.elevationM <= 9000 && Number.isFinite(p.distanceM)
            && Number.isFinite(p.cumulativeAscentM));
        if (!checked.elevationCoverageComplete) checked.warnings.push("Profile elevations are incomplete or unusable; acceptance is blocked.");
      }
    }
    if (!Array.isArray(terrain) || !terrain.length || terrain.length > 48
      || !terrain.every(t => object(t) && typeof t.sha256 === "string" && digest.test(t.sha256)
        && t.outcome === "retrieved" && Number.isInteger(t.bytes) && t.bytes > 0
        && typeof t.url === "string" && /^https:\/\//.test(t.url))) {
      checked.errors.push("Terrain manifest requires 1–48 retrieved tiles with exact SHA-256, byte sizes and HTTPS source URLs.");
    }
    checked.blockers.push("Terrain-source rights and actual profile evidence require explicit human review. Complete samples are not legal clearance.");
  }
  if (!input.canonicalGeometryId) checked.blockers.push("No canonical geometry is bound. This candidate may be saved/rejected, but cannot be accepted or approved.");
  checked.blockers.push("Source reuse rights and route/access review must be explicitly recorded. No public route activation is available.");
  checked.warnings.push("Geometry is a review snapshot, not navigation-ready. File SHA-256 differs from the database EWKB geometry digest.");
  checked.valid = checked.errors.length === 0;
  return checked;
}
export const validationInput = z.object({
  outcome: z.enum(["needs_review", "rejected", "accepted"]),
  sourceRightsReviewed: z.boolean(), routeAccessReviewed: z.boolean(),
  terrainRightsReviewed: z.boolean(), profileReviewed: z.boolean(),
  authority: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(1).max(2000),
  validUntil: z.string().datetime({ offset: true }).optional(),
}).strict();
export const decisionInput = z.object({
  decision: z.enum(["approved", "revoked"]), validationId: z.string().uuid(),
  expectedDecisionId: z.string().uuid().nullable(),
  authority: z.string().trim().min(1).max(160), reason: z.string().trim().min(1).max(2000),
}).strict();
