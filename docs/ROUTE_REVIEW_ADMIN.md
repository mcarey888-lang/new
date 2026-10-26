# Development route review admin

The detail review includes a private geographic map of the exact saved
coordinates, backed by OpenStreetMap tiles. It has pan/zoom, reset-to-route,
a marker key and a separately identified catalogue summit reference. The
out-and-back turnaround uses matching reversed geometry and its middle vertex,
not the farthest point from the start. Nearby alternative return paths and
generic loops are not labelled as proven out-and-back walks.

The map keeps its view through unchanged detail polling. Failed library/tile
loads show the existing explicitly labelled schematic and a retry action.
Map display never accepts a validation, attests to rights/access, changes
coordinates or activates navigation/publication. The elevation profile,
protected downloads and existing approval gates remain separate and intact.

Open **Artwork Admin → Route Reviews (DEV)** (`/artwork-admin/route-reviews`).
Use the existing admin key; no Clerk/Users & Auth changes are involved. The page
and its API are development-only. The server also confirms the development
database and installed review schema before every request. Production receives
404, not an alternative write connection.

## Import, without altering expeditions

Paste the fields or load one JSON input file, preview, then explicitly save.
Editing any input invalidates its preview. Duplicate candidate key/revision
pairs are rejected rather than overwritten. A new revision is a separate record.
No current expedition, mountain, geometry or user-progress record is changed.

### Watkin draft preparation

The separately authorised development tool
`artifacts/api-server/scripts/prepare-watkin-binding.ts` creates **new** route
identity/definition records in `needs_review`, a draft geometry and ordered OSM
source-segment membership, then a new immutable review revision. It does not
update existing mountain records, facts, reviews, expeditions or activities.
It asserts the exact pilot mountain coordinates/elevation and original file
hashes, verifies every source edge, and keeps reuse evidence unapproved.

Run from the API package with `NODE_ENV=development`. Without `--commit`, the
whole database rehearsal rolls back and no storage objects are uploaded.
`--commit` retains only development draft records and private evidence. Both
paths explicitly prove that acceptance fails; neither verifies a peak/route,
creates a reusable-rights approval, approves a route or touches production.
An advisory lock and existing-revision check make repeat preparation nonduplicating.

The original source snapshot and terrain-rights investigation are retained as
protected companion downloads. They complement, never rewrite, the original
geometry/profile/terrain-manifest files. Companion bytes and their bindings are
checked at import and all retained files are integrity-read for validation.

The review page presents planning figures and a DEM profile before technical
JSON. Snapshot figures are labelled as such, and live eligibility remains the
server's decision. A linked draft is not labelled "unbound" or "verified".
Technical metadata is rendered only when expanded.

Example **illustrative data, not a hiking route**:

```json
{
  "candidateKey": "example-illustrative-not-a-hiking-route",
  "revisionVersion": "v1",
  "geometryFile": "{\"type\":\"LineString\",\"coordinates\":[[-4,53],[-4.001,53.001]]}",
  "sourceManifest": [
    {
      "provider": "Illustrative example only",
      "url": "https://example.invalid/not-a-route",
      "licence": "Unreviewed — no reuse permission asserted"
    }
  ]
}
```

Required: candidateKey, revisionVersion, geometryFile, sourceManifest.
Optional: canonicalGeometryId; profileFile and terrainManifestFile **together**.
Unknown top-level fields are rejected. File values are original UTF-8 JSON text,
not URLs, paths or base64. The overall request limit is 6 MB; geometry/profile
files are each at most 2 MB, terrain manifest 500 KB, and geometry at most 20,000
2D finite WGS84 points / 60 km. One LineString, a single LineString Feature, or
a FeatureCollection containing exactly that one Feature is supported, preserving
the original file bytes. Multi-feature collections, GPX and disconnected
multi-line geometry are rejected.

The global default JSON parser defers this exact route namespace to its own
6 MB parser. Development and admin-key guards run before that parser; unrelated
endpoints retain their existing limits. Oversized review requests return a
route-specific error, rather than the recording-upload message.

Source metadata remains metadata, never implicit verification. An optional
canonicalGeometryId must already exist **in development**; bytes/order and full
source manifest must exactly match it. Import does not create that canonical
record or write to the independently managed catalogue.

Profiles use `summitready-terrain-profile-review-v1`, matching the existing pilot
output. They must reference the SHA-256 of the exact geometry file and an
explicit source snapshot digest in sourceManifest. Sample coordinates/count and
30 m interval are checked against the active resampler. Complete finite sample
coverage is computed server-side, never trusted from a request checkbox.
Terrain manifests require retrieved tile byte sizes and hashes. Actual terrain
tile contents/rights must still be reviewed: uploading a manifest alone is not
replay proof. Existing route facts and GPS activity remain untouched.

## Files, history and review

Original files are stored under a dedicated private development App Storage
namespace with immutable generation preconditions. PostgreSQL holds the spatial
snapshot, provenance metadata and file hashes/references, not file bytes.
Downloads require the admin key and verify stored size/hash. No public object
URLs or bucket paths are exposed in the browser.

The API rechecks immutable files before recording a validation. Reviewer
authority and reason are explicit human-entered audit labels under the shared
admin credential, not a new independently verified user identity. `needs_review`
and `rejected` work for unbound candidates. `accepted` requires:

- A current canonical binding with exact reusable-rights evidence.
- Explicit source-rights and route/access attestations.
- A future expiry within one year.
- If a profile exists, complete matching samples, terrain-rights and profile
  attestations as well.

Development approval selects an accepted validation and confirms the current
decision head. Stale decisions fail with 409. Revocation remains available even
after an approval expires; it uses that approval's validation. Restoring an
approval after revocation requires a fresh validation. No existing review history
can be updated/deleted/truncated, and there is no public activation action.

Lists/details refresh on mount, window focus, mutation and at 30-second intervals.
Changing the admin key resets review queries; forms reset when selecting another
revision. Mutations show errors and retain the append-only history.

Private objects uploaded before a failed database commit can remain orphaned;
this deliberately prefers missing no evidence over deleting any retained review
file. A future retention job must reconcile references before deleting objects.

## Verification

- OpenAPI regenerated successfully; admin and API typechecks pass.
- Pure evidence tests cover geometry, malformed inputs and exact profile binding.
- Real PostgreSQL service tests cover import/download/detail, duplicates,
  development approval, revocation, stale decisions, fresh re-review and tampering.
  Every database fixture rolls back; test source evidence is explicitly fictional.
- The private App Storage write/read check passed with a separate tiny,
  development-only test object (not a catalogue record).
- Prior database-trigger tests remain in
  `summit-data-engine/sql/test_route_review_validation_v1.sql`.

No production migrations, new writer roles, auth changes, canonical imports,
route activation or publication are part of this work.
