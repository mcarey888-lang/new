import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEvidence, sha256 } from "./routeReviewEvidence.js";
import { resample } from "./routing/profile.js";

const geometryFile = JSON.stringify({ type: "LineString", coordinates: [[-4, 53], [-4.001, 53.001]] });
const candidate = { candidateKey: "TEST ONLY", revisionVersion: "v1", geometryFile, sourceManifest: [{ sha256: "a".repeat(64) }] };
test("valid unbound geometry stays quarantined and exposes original file checksum", () => {
  const result = checkEvidence(candidate);
  assert.equal(result.valid, true); assert.equal(result.bindingCurrent, false);
  assert.match(result.blockers.join(" "), /cannot be accepted/);
  assert.equal(result.files[0]?.sha256, sha256(geometryFile));
});
test("rejects malformed, out-of-range, 3D, identical and oversized-route geometry", () => {
  for (const geometry of [null, { type: "LineString", coordinates: [[181, 53], [-4, 53]] },
    { type: "LineString", coordinates: [[-4, 53, 10], [-4, 54, 20]] },
    { type: "LineString", coordinates: [[-4, 53], [-4, 53]] },
    { type: "LineString", coordinates: [[-4, 53], [100, -50]] }]) {
    assert.equal(checkEvidence({ ...candidate, geometryFile: JSON.stringify(geometry) }).valid, false);
  }
  assert.equal(checkEvidence({ ...candidate, geometryFile: "{" }).valid, false);
});
test("does not ignore unrecognised inputs or incomplete profile pairs", () => {
  assert.equal(checkEvidence({ ...candidate, approved: true }).valid, false);
  assert.equal(checkEvidence({ ...candidate, profileFile: "{}" }).valid, false);
});
test("binds complete profile to exact file bytes, source hash and resampled positions", () => {
  const sampledPositions = resample([{ longitude: -4, latitude: 53 }, { longitude: -4.001, latitude: 53.001 }], 30);
  const profile = {
    format: "summitready-terrain-profile-review-v1", geometrySha256: sha256(geometryFile),
    sourceSnapshotSha256: "a".repeat(64), method: { sampleIntervalM: 30 },
    sampledPositions, result: { outcome: "profiled", points: sampledPositions.map((_, i) =>
      ({ distanceM: i * 30, elevationM: 100 + i, cumulativeAscentM: i })) },
  };
  const input = { ...candidate, profileFile: JSON.stringify(profile),
    terrainManifestFile: JSON.stringify([{ sha256: "b".repeat(64), bytes: 123, url: "https://example.invalid/test-only.png", outcome: "retrieved" }]) };
  const valid = checkEvidence(input);
  assert.equal(valid.valid, true); assert.equal(valid.elevationCoverageComplete, true);
  assert.match(valid.blockers.join(" "), /human review/);
  assert.equal(checkEvidence({ ...input, geometryFile: `${geometryFile}\n` }).valid, false);
  assert.equal(checkEvidence({ ...input, sourceManifest: [{ sha256: "c".repeat(64) }] }).valid, false);
  assert.equal(checkEvidence({ ...input, profileFile: JSON.stringify({ ...profile, sourceSnapshotSha256: undefined }),
    sourceManifest: [{}] }).valid, false);
  profile.sampledPositions[1]!.latitude += .01;
  assert.equal(checkEvidence({ ...input, profileFile: JSON.stringify(profile) }).valid, false);
});
