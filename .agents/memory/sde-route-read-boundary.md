---
name: SDE route read boundary
description: Durable trust and activation rules for canonical route intelligence reads and geometry disclosure.
---

## Production connectivity is a separate check

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

Canonical geometry must remain unavailable unless every geometry member has exact reusable-rights evidence and a persisted validation is explicitly tied to that exact geometry/version. The current SDE validation model does not provide that exact version link, so identity, facts, trust, and provenance may be read while geometry/profile-dependent matching degrades.

**Why:** A reusable fact source or a historical route validation cannot safely authorize geometry assembled from separate source bundles.

**How to apply:** Never infer topology completion, member rights, or validation-version equivalence. Adding the missing publication/validation relationship is separate schema and production work requiring explicit approval.

A failed canonical read is not evidence that a mountain is absent from the verified catalogue. Browsing cached suggestions may remain available, but the UI must distinguish catalogue downtime from a genuine no-match and keep identity-dependent actions closed.

**Why:** An absent engine connection was silently converted to an empty lookup, making familiar curated mountains appear “not in the verified catalogue.”

**How to apply:** On identity lookups, propagate read failures as an unavailable state; reserve no-match for completed reads with zero verified candidates. Never manufacture verified IDs from names or cached route facts.

The absence of `ENGINE_DATABASE_URL` does not prove that engine data is absent. The managed development and production databases may already contain engine-owned tables, even though the API's dedicated read connection is unconfigured. Imported records and trusted source evidence are not the same as a verified mountain lifecycle state.

**Why:** A missing read-connection secret initially looked like a missing catalogue, but read-only inspection found the independently owned catalogue tables in both managed environments; most imported hills had not been verified for app display.

**How to apply:** Inspect both environments' table presence and verification-status distribution read-only before proposing new databases, migration, or blanket promotion. Maintain a dedicated read-only connection and the existing verified-only lookup rule; never silently fall back to the app's general `DATABASE_URL`.

A successful managed production-database query does not establish that the published server can use its dedicated engine connection. Check the live summit endpoint separately. A secret present in current workspace settings also does not establish that it was included in the last published environment snapshot.

**Why:** The live summit API returned 503 while the development API returned real markers and a read-only production query successfully retrieved the same catalogue schema and spatial records. The published API's old logs deliberately hid connection details, so they did not establish the precise failure.

**How to apply:** Keep missing-configuration, permissions, schema and connection failures distinguishable through fixed safe diagnostic categories, never raw database errors. Secret changes require republishing to enter the live environment snapshot; do not promise that republishing alone will fix an unclassified failure.