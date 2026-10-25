import { test } from "node:test";
import assert from "node:assert/strict";
import { sha256, validatePilotEvidence, type PilotCandidate } from "./routePilotEvidence";

function fixture() {
  const geometry = { type: "FeatureCollection", features: [{
    geometry: { type: "LineString", coordinates: [[-4,53],[-4.001,53.001],[-4,53]] },
  }] };
  const snapshot = { licence: "ODbL-1.0", attribution: "© OpenStreetMap contributors",
    relation: { id: "r", version: "1" },
    nodes: [{ id:"a",version:"1",lat:53,lon:-4 }, { id:"b",version:"1",lat:53.001,lon:-4.001 }],
    ways: [{ id:"w",version:"1",nodes:["a","b"],tags: {} as Record<string,string> }] };
  const geometryBytes = Buffer.from(JSON.stringify(geometry)), snapshotBytes = Buffer.from(JSON.stringify(snapshot));
  const candidate: PilotCandidate = { format:"summitready-route-review-candidate-v1",candidateId:"review",
    navigationReady:false,imported:false,geometrySha256:sha256(geometryBytes),sourceSnapshotSha256:sha256(snapshotBytes),
    source:{relationId:"r",relationVersion:"1"},catalogueMountain:{name:"Example",elevationM:1000},
    distance:{existingExpeditionDistanceKm:1,existingExpeditionAscentM:100},
    orderedSourceEdges:[{fromNode:"a",toNode:"b",wayId:"w",wayVersion:"1"},
      {fromNode:"b",toNode:"a",wayId:"w",wayVersion:"1"}] };
  return { geometry,snapshot,candidate,geometryBytes,snapshotBytes };
}
test("source consistency never confers publication approval", () => {
  const f=fixture(),result=validatePilotEvidence(f.candidate,f.geometryBytes,f.snapshotBytes);
  assert.equal(result.sourceEdgesChecked,2);
  assert.equal(result.structuralSourceConsistencyPassed,true);
  assert.equal(result.publicationEligible,false);
  assert.equal(result.humanReviewed,false);
});
test("changed geometry bytes fail the exact checksum binding", () => {
  const f=fixture();
  assert.throws(()=>validatePilotEvidence(f.candidate,Buffer.concat([f.geometryBytes,Buffer.from(" ")]),f.snapshotBytes),/checksum mismatch/);
});
test("rehashed invented coordinates still fail source evidence", () => {
  const f=fixture(); f.geometry.features[0]!.geometry.coordinates[1]![0]=-4.002;
  const bytes=Buffer.from(JSON.stringify(f.geometry)); f.candidate.geometrySha256=sha256(bytes);
  assert.throws(()=>validatePilotEvidence(f.candidate,bytes,f.snapshotBytes),/coordinates differ from source/);
});
test("changed source versions cannot reuse the old edge evidence", () => {
  const f=fixture();f.snapshot.ways[0]!.version="2";
  const bytes=Buffer.from(JSON.stringify(f.snapshot));f.candidate.sourceSnapshotSha256=sha256(bytes);
  assert.throws(()=>validatePilotEvidence(f.candidate,f.geometryBytes,bytes),/way version mismatch/);
});
test("access restrictions remain explicit review flags", () => {
  const f=fixture();f.snapshot.ways[0]!.tags["foot:conditional"]="no @ (winter)";
  const bytes=Buffer.from(JSON.stringify(f.snapshot));f.candidate.sourceSnapshotSha256=sha256(bytes);
  const result=validatePilotEvidence(f.candidate,f.geometryBytes,bytes);
  assert.equal(result.accessReviewFlags.length,1);assert.equal(result.publicationEligible,false);
});
test("duplicate node identities are not silently overwritten", () => {
  const f=fixture();f.snapshot.nodes.push({...f.snapshot.nodes[0]!});
  const bytes=Buffer.from(JSON.stringify(f.snapshot));f.candidate.sourceSnapshotSha256=sha256(bytes);
  assert.throws(()=>validatePilotEvidence(f.candidate,f.geometryBytes,bytes),/Duplicate source identities/);
});
