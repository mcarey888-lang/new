# Proposed route-geometry publication contract

Status: development-only storage implemented following owner approval. No
production migration, canonical reader activation or real route approval has
been performed or authorised.

## Development storage now available

The focused, additive SQL source is
`summit-data-engine/sql/route_review_validation_v1.sql`, tracked by the next
Alembic revision. It was applied directly as one development SQL transaction;
the historical relocation chain was not replayed or stamped over an existing
catalogue. These migration-owned SQL tables are excluded from ORM autogeneration
so their absence from declarative models does not propose their removal.

- `route_geometry_review_revisions`: immutable review snapshots, optionally
  bound to an existing canonical geometry/definition revision.
- `route_geometry_review_validations`: exact snapshot/profile/terrain hash
  bindings, evaluator version/hash, explicit review flags, authority and expiry.
- `route_geometry_review_decisions`: append-only development approval/revocation
  chain. A revocation requires a fresh validation before approval can resume.

All three remain empty after rollback-only integration tests. No Watkin candidate
or synthetic fixture has been committed. No catalogue data was modified: row
counts and content fingerprints match across thirteen protected engine tables.
The separate dedicated catalogue connection was checked read-only; none of the
new tables exists there, and its geometry count remains zero. Adding development
storage does not make it visible through that independent connection.

The database computes geometry digests from PostGIS XDR EWKB with SRID 4326/2D.
It computes source-manifest digests with PostgreSQL's immutable `jsonb_send`
representation. These are distinct, explicitly labelled algorithms; neither is
the SHA-256 of a pretty-printed GeoJSON/JSON file. `convert_to` is STABLE, not
IMMUTABLE, and cannot be used in a PostgreSQL stored generated expression.
Clients must use the generated digests, not guess an equivalent serialisation.

Binding checks capture definition/identity/mountain context and current member
provenance/rights. Ordinary update, delete and truncate operations on review
history are rejected. PUBLIC has no table/function access. The owner/superuser
can still alter database protections; these guards are not a sandbox against the
database administrator. No application writer grants or authentication changes
were made.

`sde_review_eligible(revision_id, active_evaluator_version, active_evaluator_sha256)`
checks exact policy identity, current binding, expiry and latest decision.
Future callers must supply their own pinned active policy, never user-selected
values. Its result is development-scoped eligibility, not permission to disclose
geometry in the current API.

An ingestion/review service is still required to verify actual profile files,
their geometry conversion and DEM lineage before asserting human review flags.
Hashes and explicit flags are storage/attestation boundaries, not an automatic
validator of unseen files or legal clearance for an uploaded rights assertion.

### Verification and future promotion

`summit-data-engine/sql/test_route_review_validation_v1.sql` runs 21 database
integration checks in one transaction and rolls back every fixture. It covers
exact binding, source/right changes, original engine immutability, history
protection, profile mixing, policy mismatch, revocation and fresh review.

No runtime startup/build/publish migration hook was added. No broad Drizzle sync
or old Alembic relocation chain was run. Before any future promotion, separately
authorise and confirm its target database, inspect the schema diff and confirm
functions, triggers and privileges as well as tables. Do not assume that
publishing the managed app database also migrates the independent catalogue.
Keep the existing canonical API geometry gate off until its separate acceptance
work, rights/access review and production verification are complete.

## Existing boundary

The current canonical reader can return eligible facts while withholding geometry
and profiles. Its geometry-validation flag intentionally remains false because
the current schema does not establish an exact geometry/version approval link.
The broader engine validation model identifies a route and validation-rule version;
that alone does not bind approval to particular geometry bytes.

The dedicated engine connection remains read-only. It must not be repurposed for
ingestion or fall back to the application database.

## Required binding before any release

The storage contract requires these immutable bindings; integration and
production promotion remain separate, unapproved work:

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
