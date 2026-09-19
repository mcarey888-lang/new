# Stage 7 Mountain and Route Intelligence Completion Report

**Checkpoint:** S7-C10 / S7-R10
**Reviewed commit:** `60a2ea1`
**Base:** `308cf56`
**Branch:** `virtual-expeditions-mode`

## Completion decision

**Stage 7 is COMPLETE under the authorized runbook.** The implementation
provides one typed, versioned, provenance-aware route intelligence model across
Training, Explore, and Expedition; a deterministic Mountain DNA evaluator and
bounded matcher; a shared detail experience; and a server-only SDE read
boundary. Production remains unchanged and default-safe.

This is a development/read-model completion, not production activation,
schema approval, native-device release approval, or permission to begin Stage
8. No Stage 8 work was started.

## Requirement-by-requirement gate

| S7-C10 requirement | Result | Implementation/evidence |
| --- | --- | --- |
| One stable canonical mountain/route model | PASS | `routeIntelligence.ts` defines stable SDE mountain/route IDs, versions, facts, geometry/profile, provenance, trust, and explicit read results. |
| SDE integrated, not duplicated/replaced | PASS | `canonicalRouteRecord.ts` and `canonicalMountainLookup.ts` read SDE-owned records through a server-only `ENGINE_DATABASE_URL` read-only pool. No SDE identity migration or competing catalogue was added. |
| Provenance/trust explicit | PASS | DTOs retain evidence, provider, source URL, attribution, rights classification, hashes/version metadata where available, verification status, and degradation reasons. |
| Deterministic/explainable Mountain DNA | PASS | `mountain-dna-v1` uses fixed audited dimensions and weights, bounded normalization, evidence/confidence state, missing dimensions, and deterministic explanations. |
| Honest missing data | PASS | Missing, ambiguous, unverified, rejected, rights-unclear, unavailable, and version-mismatch states are explicit. No AI or activity-derived geography is promoted. |
| Training/Explore/Expedition shared consumption | PASS | Consumer adapters preserve mode-specific journey state while carrying stable route references, trust, route facts, matching explanations, and compatibility degradation. |
| Activities do not overwrite route geometry | PASS | Activity links/reference fields remain separate from canonical route definitions, geometry, facts, and provenance. |
| GPS/offline tracker protected | PASS | Existing tracker lifecycle, checkpoints, outbox, retry, physical activity identity, and offline semantics remain unchanged. |
| Stage 6 Progress Mountain/cinematic protected | PASS | Protected progress, contribution, summit authority, and cinematic files are unchanged in the reviewed range. |
| Production unchanged | PASS | Endpoint activation is production-off unless explicitly enabled; no production SQL, migration, backfill, reconciliation, deployment, or release occurred. |
| Tests/regressions | PASS | Bounded/full evidence and limitations are recorded in `STAGE_7_REGRESSION_REVIEW.md`. |

## Implementation inventory

### Contracts and read boundary

- `artifacts/summit-ready/utils/routeIntelligence.ts`
  - stable ID parsing and exact version selection;
  - canonical route facts/definition/geometry/profile contracts;
  - provenance, rights, trust, and unavailable/degraded states;
  - Training, Explore, and Expedition compatibility adapters.
- `artifacts/api-server/src/services/mountain/canonicalRouteRecord.ts`
  - exact SDE route identity/version read;
  - version-consistent definitions/facts;
  - fail-closed provenance and geometry handling.
- `lib/db/src/index.ts`
  - bounded read-only PostgreSQL pool helper for the explicitly configured
    engine database.
- `artifacts/api-server/src/routes/canonical-route-records.ts`
  - additive, exact-ID route-record endpoint; production-default-off.

### Deterministic matching

- `artifacts/summit-ready/utils/mountainDna.ts`
  - versioned `mountain-dna-v1` evaluator.
- `artifacts/summit-ready/utils/routeMatching.ts`
  - bounded candidate filtering, deterministic ordering/ties, independent
    future geographic predicate, and `whyMatched` explanations.
- `docs/STAGE_7_MOUNTAIN_DNA_MODEL.md`
  - fixed dimensions, weights, formulas, evidence rules, and rationale.

### Consumer UX and integration

- `components/RouteIntelligencePresentation.tsx` and `app/hill-detail.tsx`
  - shared identity/trust/facts/source/DNA-unavailable or match explanation
    presentation and existing tracker actions.
- `components/VirtualExpeditionView.tsx`
  - target/candidate canonical record hydration and route-match explanations.
- `components/VerifiedRouteChooser.tsx`,
  `context/AppContext.tsx`, and the server target-profile adapter
  - exact versioned route selection and persistence.
- `app/trail-detail.tsx`
  - existing Explore launch context preserved through the current tracker
    builder.

## Non-production environment and activation runbook

### Development/read-only verification

1. Provide `ENGINE_DATABASE_URL` through the development secret/environment
   manager. Do not commit it, print it, or place a connection string in this
   report.
2. Ensure the URL points to the isolated Summit Data Engine database or its
   explicitly published read surface, never to SummitReady production.
3. Run the API in development (`NODE_ENV=development`). The canonical route
   endpoint uses a bounded pool with PostgreSQL
   `default_transaction_read_only=on`; it never falls back to `DATABASE_URL`.
4. Query only exact `sde:mountain:<id>` and
   `sde:route:<identity>@<version>` references. Missing engine data returns
   unavailable/degraded results.
5. Run the focused API/mobile route suites and typechecks recorded in the
   regression review.

### Production default

`CANONICAL_ROUTE_RECORDS_ENABLED` must remain unset or false in production.
There is no production activation in Stage 7. Setting it true would be a RED
decision requiring product-owner approval, a reviewed deployment, and
operational evidence; it was not done here.

### Monitoring and failure handling

Monitor, in a non-production environment first:

- unavailable/503 responses caused by absent or unreachable
  `ENGINE_DATABASE_URL`;
- `invalid_identity`, `version_not_found`, `ambiguous_lookup`,
  `needs_review`, `rights_unclear`, `missing_geometry`, and
  `missing_elevation_profile` reason counts;
- degraded Mountain DNA confidence and missing-dimension counts;
- candidate filtering counts and deterministic tie outcomes;
- any attempt to use a legacy/name-only identity as canonical.

A route-record read failure must remain visible as unavailable/degraded. It
must not fall back to application-cache coordinates, AI output, or a GPS trace
and call the result verified.

### Rollback

For non-production, unset `CANONICAL_ROUTE_RECORDS_ENABLED`, stop supplying
`ENGINE_DATABASE_URL`, or revert the additive Stage 7 commits. Existing
compatibility/legacy route surfaces remain available with explicit degraded
labels. Do not delete SDE records, mutate route versions, alter tracker data,
or run a compensating migration.

## Explicit SDE limitation and approval boundary

The current SDE validation schema cannot prove that a persisted
`route_validation.validation_version` applies to an exact
`route_geometries.version`. It also cannot provide a sufficiently explicit
member-to-rights relationship for every geometry member in the current
published read contract. The adapter therefore withholds geometry/topology and
derived profile data when those proofs are absent. Mountain DNA and route
matching degrade or remain unavailable rather than scoring unsupported
dimensions.

Adding an exact geometry-validation/publication linkage, backfill, or
production read publication is outside this checkpoint and would require
separate schema/product-owner approval. No production migration, activation,
backfill, reconciliation, or release was performed.

## Native-device QA

Native-device QA was **NOT RUN**. It remains a release gate for real-device
offline tracking, delayed sync, and native Expedition completion/cinematic
flows. Stage 7 completion does not claim mobile release readiness.

**S7-R10 status: COMPLETE**