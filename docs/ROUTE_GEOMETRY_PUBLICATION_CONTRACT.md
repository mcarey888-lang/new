# Proposed route-geometry publication contract

Status: design only. No migration, database writes, reader activation or route
approval is authorised or implemented by this document.

## Existing boundary

The current canonical reader can return eligible facts while withholding geometry
and profiles. Its geometry-validation flag intentionally remains false because
the current schema does not establish an exact geometry/version approval link.
The broader engine validation model identifies a route and validation-rule version;
that alone does not bind approval to particular geometry bytes.

The dedicated engine connection remains read-only. It must not be repurposed for
ingestion or fall back to the application database.

## Required binding before any release

A future, separately approved schema change should establish immutable records:

1. **Geometry revision:** exact route-definition identity/version, geometry
   identity/version, SRID, coordinate order and canonical byte/hash specification.
   Define a single cross-language canonicalisation before comparing independently
   serialised JSON or PostGIS geometry. A SHA-256 of this pilot's GeoJSON file is
   a file-integrity binding, not automatically the future database geometry hash.
2. **Source membership revision:** an exhaustive ordered manifest of source
   members, immutable source-object versions/hashes, provenance, licence terms,
   reuse evidence and attribution requirements. Its digest is part of approval.
3. **Elevation revision:** exact geometry revision, sample-chainage rule, all DEM
   tile hashes and contributing datasets/licences, missing-data count, calculation
   code/rules version, spacing, filtering parameters and output hash. Profile
   completeness is coverage, not accuracy or navigation certification.
4. **Validation decision:** foreign key to that exact geometry revision and source
   manifest; optional exact profile revision; evaluator/rules version, diagnostics,
   outcome, time and review authority. Use explicit needs-review, rejected and
   accepted states. Automatic structural checks must not impersonate human review.
5. **Publication decision:** references the exact accepted validation and reviewed
   definition revision; includes access/hazard review and required attribution.
   Changed geometry, members, profile inputs or material rights/access evidence
   must not inherit an old decision.

Do not use a mutable route ID, latest validation timestamp, unrelated verified
mountain, reusable fact source or same-number version string as equivalence proof.
Model tables absent from an existing catalogue are not themselves evidence of
reader failure; inspect the actual dependencies before proposing DDL.

## Future reader acceptance checks

- Exact geometry revision and definition revision match the requested identity.
- Every geometry member has applicable reusable rights and source-version proof.
- An accepted decision references precisely those geometry/source digests.
- If an elevation profile is disclosed, it references precisely that geometry and
  its independently eligible terrain-source revision.
- Access restrictions and temporal evidence are explicitly reviewed; rights to
  database content do not establish permission to walk the land.
- Required publication/attribution evidence is present. Missing, stale, ambiguous,
  rejected or incomplete evidence degrades closed; it never enables a fallback.

## Pilot now

The Watkin files are quarantined review outputs, not canonical approvals.
`validation.json` binds the exact source snapshot, proposed GeoJSON file, terrain
manifest, profile output and evaluator code hashes, and explicitly records
`databaseValidationPersisted: false` and publication ineligibility.

The existing expedition's distance/ascent, approved artwork, saved user snapshots
and activity evidence remain unchanged. DEM planning estimates must not replace
GPS-recorded distance/ascent. A manual-stage fact correction requires its own
review and explicit publication.

## Verification required with a future implementation

Reject reuse of approval after any coordinate, source-member, node/way version,
licence, profile/tile or evaluator revision change. Test missing and ambiguous
decisions, incomplete DEM coverage, source rights conflicts and superseded access
evidence. Verify the actual restricted reader login still cannot write. Keep the
feature off until development and separately authorised production migrations,
reader checks and reviewed pilot publication have all succeeded.
