---
name: SDE route read boundary
description: Durable trust and activation rules for canonical route intelligence reads and geometry disclosure.
---

## Production connectivity is a separate check

Do not use the development-only `helium` host as a published engine endpoint.
Obtain the production hostname from Database → Production Database → Settings →
Connection details, retaining the reader's own credentials and verified TLS.

**Why:** Both environments can contain the curated catalogue, while the workspace
Helium address still fails DNS from the published server. Matching row counts
does not make the two connection addresses interchangeable.

**How to apply:** Inspect both catalogues read-only; do not copy an owner URL,
infer a public hostname from a database server/proxy IP, or claim published
reachability from a successful production-tool query.

Require a dedicated, database-enforced catalogue reader: explicit SELECT access
to the engine catalogue only, no application-table reads and no write privileges.
Retain the existing bounded pool and read-only session setting as additional
protection, not as a substitute for database permissions.

**Why:** The user treats the summit catalogue as irreplaceable and explicitly
requires protection that survives an application mistake resetting a session
setting.

**How to apply:** Audit inherited and PUBLIC privileges as well as direct grants
before asserting isolation. Verify reads and rejected writes using the actual
restricted login, not just an administrator's permission inspection. Do not
bypass production tool restrictions or add a provisioning/startup workaround;
stop if supported administration or user-approved publishing is required.

The dedicated engine variable and read-only pool are an ownership/code boundary,
not proof of separate physical infrastructure. The documented shared-database
import explicitly binds `ENGINE_DATABASE_URL` to `DATABASE_URL`; production also
contains engine-owned catalogue tables in `public`.

**Why:** The user explicitly protects this boundary and rejected moving only the
map to another source as a workaround. Map pins and canonical mountain lookups
must resolve against a consistent catalogue.

**How to apply:** Repair the explicit engine connection rather than introducing
a fallback or a map-only source switch. A colocated deployment can explicitly
configure the engine connection for that same database, while retaining its
bounded read-only pool. Never assume the current secret values match, and do
not change production settings or publish without authorization.

Successful queries through Replit's production database tooling do not prove that
the dedicated engine connection is reachable by the deployed API.

**Why:** The managed production queries succeeded while the deployed summit
reader reported `database_dns_unavailable`. The two access paths have different
connection configuration and DNS reachability.

**How to apply:** Investigate the engine connection's production reachability
when this diagnostic appears. Do not bypass its trust boundary by silently
switching to the main application database.

Canonical mountain and route intelligence must be read server-side from the independently managed Summit Data Engine through `ENGINE_DATABASE_URL` only. The connection is bounded and read-only, and it must never fall back to the application `DATABASE_URL`.

**Why:** Treating the application database as an undocumented SDE replica creates an unsupported publication boundary. Falling back to another database can also promote stale or unrelated rows to canonical trust.

**How to apply:** Keep canonical route endpoints production-off by default. Missing or unreachable engine configuration returns explicit unavailable/degraded results. Do not connect mobile clients directly to the engine.

Audit schema compatibility against the current reader's actual SQL dependencies,
not the complete engine ORM table list. An absent broader-model table does not
establish that current route-fact reads are broken.

**Why:** An acquisition audit incorrectly classified absent broader-model tables
as blockers. A real read of an existing verified route successfully returned
facts, with geometry correctly degraded. Speculative DDL would not have fixed
the genuine missing geometry/version-validation evidence.

**How to apply:** Trace the current reader and probe a known eligible record
through the dedicated connection before proposing migrations. Report fact-read
compatibility separately from ingestion/full-engine completeness and from exact
geometry publication readiness.

Canonical geometry must remain unavailable unless every geometry member has exact reusable-rights evidence and a persisted validation is explicitly tied to that exact geometry/version. The current SDE validation model does not provide that exact version link, so identity, facts, trust, and provenance may be read while geometry/profile-dependent matching degrades.

**Why:** A reusable fact source or a historical route validation cannot safely authorize geometry assembled from separate source bundles.

**How to apply:** Never infer topology completion, member rights, or validation-version equivalence. Adding the missing publication/validation relationship is separate schema and production work requiring explicit approval.

The proposed acceptance contract is documented in
`docs/ROUTE_GEOMETRY_PUBLICATION_CONTRACT.md`. Review-file checksums are integrity
evidence, not canonical database approval or an agreed cross-language database
geometry hash.

**Why:** A complete, reproducible offline profile can appear release-ready while
human/access review, contributing terrain rights and database-bound approval are
still absent.

**How to apply:** Preserve the distinction when reporting progress or implementing
future validation storage; do not turn successful pilot-file checks into geometry
disclosure permission.

Route-review storage work is authorised in development only. Production promotion,
catalogue-reader activation and real route approval require separate permission.

**Why:** The owner approved adding development validation tables, while protecting
existing catalogue records, expedition snapshots and production behaviour.

**How to apply:** Confirm the actual target independently of matching catalogue
row counts; a managed development copy and the dedicated reader can be different
databases. Do not redirect or grant write access to the reader to install schema.
The acceptance-contract document records this boundary and the migration-owned
SQL approach. Native generated manifest digests intentionally use immutable
`jsonb_send`; PostgreSQL's STABLE `convert_to` cannot back a generated column.

Routine development candidate uploads do not authorise canonical catalogue
imports or production activation. Reviewer labels use the existing shared admin
protection, not new Clerk identities.

**Why:** The owner approved the review interface and terrain-rights investigation
while protecting expeditions, saved progress, artwork and authentication. Review
file ingestion must not quietly become permission to rewrite canonical data.

**How to apply:** Unbound candidates may be quarantined/rejected, never accepted.
Keep original evidence immutable and add companion rights findings rather than
rewriting an already-hashed profile. Watkin's exact tile bytes identify EU-DEM;
see `docs/WATKIN_TERRAIN_RIGHTS.md` for conditions and remaining edition/review
limits. Do not generalise that finding to other routes or newer Copernicus DEM.

The owner separately authorised preparing Watkin's development draft link and a
readable review. This permits new needs-review route/geometry/source records,
not changing an existing peak's imported status, certifying rights, granting
human attestations, approving navigation or promoting to production.

**Why:** A usable draft link and a cleared binding are different. Do not mark
catalogue records verified merely to make the review buttons work.

**How to apply:** Preserve previous review revisions and original evidence.
Leave catalogue verification, source rights and explicit human approval gates
closed until independently supported and authorised.

Source-hashed evaluator policies must work in the bundled API, not just under
tsx. The managed development command builds and runs dist from the package root.

**Why:** Resolving evaluator `.ts` sources relative to `import.meta.url` passed
service tests but failed in the actual bundled server because that URL was dist.

**How to apply:** Resolve development policy inputs from the package source root
and smoke-test the served API after building; keep missing policy evidence closed.

Verify review uploads with real pilot-sized files through the complete HTTP
middleware stack, not only small examples or service calls.

**Why:** The global 100 KB JSON parser rejected the real Watkin geometry/profile
before the protected router's 6 MB parser could run; small previews passed.

**How to apply:** Defer the exact review namespace to its guarded parser. Keep
other endpoint limits unchanged, and preserve development/auth checks before
reading the larger body. Test a real preview plus rejection limits over HTTP.

Pilot evidence may wrap a single route Feature in a FeatureCollection. Accept
that single-feature envelope without changing its bytes or profile hash binding;
do not concatenate multiple features or rewrite the signed-off source artifact.

**Why:** The real Watkin pilot used this standard envelope while synthetic tests
used bare LineStrings, leaving the real artifact incompatible with its reviewer.

**How to apply:** Include a preserved single-feature collection in compatibility
checks and keep multi-feature/disconnected inputs explicitly unsupported.

A failed canonical read is not evidence that a mountain is absent from the verified catalogue. Browsing cached suggestions may remain available, but the UI must distinguish catalogue downtime from a genuine no-match and keep identity-dependent actions closed.

**Why:** An absent engine connection was silently converted to an empty lookup, making familiar curated mountains appear “not in the verified catalogue.”

**How to apply:** On identity lookups, propagate read failures as an unavailable state; reserve no-match for completed reads with zero verified candidates. Never manufacture verified IDs from names or cached route facts.

The absence of `ENGINE_DATABASE_URL` does not prove that engine data is absent. The managed development and production databases may already contain engine-owned tables, even though the API's dedicated read connection is unconfigured. Imported records and trusted source evidence are not the same as a verified mountain lifecycle state.

**Why:** A missing read-connection secret initially looked like a missing catalogue, but read-only inspection found the independently owned catalogue tables in both managed environments; most imported hills had not been verified for app display.

**How to apply:** Inspect both environments' table presence and verification-status distribution read-only before proposing new databases, migration, or blanket promotion. Maintain a dedicated read-only connection and the existing verified-only lookup rule; never silently fall back to the app's general `DATABASE_URL`.

A successful managed production-database query does not establish that the published server can use its dedicated engine connection. Check the live summit endpoint separately. A secret present in current workspace settings also does not establish that it was included in the last published environment snapshot.

**Why:** The live summit API returned 503 while the development API returned real markers and a read-only production query successfully retrieved the same catalogue schema and spatial records. The published API's old logs deliberately hid connection details, so they did not establish the precise failure.

**How to apply:** Keep missing-configuration, permissions, schema and connection failures distinguishable through fixed safe diagnostic categories, never raw database errors. Secret changes require republishing to enter the live environment snapshot; do not promise that republishing alone will fix an unclassified failure.