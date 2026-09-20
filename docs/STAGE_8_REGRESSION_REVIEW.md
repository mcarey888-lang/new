# Stage 8 Challenges & Achievements — C09 Regression Review

Date: 2026-09-20 UTC
Branch: `virtual-expeditions-mode`
Authorization baseline: `81711de`
Reviewed implementation checkpoints: `f813597` through current C09 working tree

## Result

**PASS.** The independent adversarial review and GREEN self-fix loop found and
resolved the Stage 8 completion blockers within the authorized boundary.

The closing architecture review confirmed:

- deterministic, owner-scoped evidence and projection identities;
- input-order-independent correction and revocation authority;
- no duplicate aggregate progress or non-repeatable awards on retry/restart;
- exact purpose, producer-rule, evidence-class, SDE identity, and provenance
  qualification;
- explicit separation of real, manual, indoor, simulated, personal, and
  future-competitive evidence;
- explicit calendar/rolling windows and transition-safe IANA month boundaries;
- additive, backwards-compatible Elevation Bank events without changing the
  legacy `recentCredits` contract;
- honest unavailable states for challenge and achievement families that do not
  yet expose an accepted authoritative producer;
- exact current-evidence attribution for completion consequences;
- preservation of protected Stage 5–7 systems and production-default-safe
  behavior.

Stage 8 can proceed to O8-C10. This is not mobile release approval.

## Review and self-fix summary

The initial C09 review failed because the typed Stage 8 model was not yet the
authoritative additive projection, aggregate identities depended on growing
evidence sets, windows were under-specified, and owner/qualification checks
were incomplete.

The self-fix loop added or corrected:

1. A Clerk-owner-scoped, persisted Stage 8 projection that coexists with the
   legacy challenge catalogue and stored IDs.
2. Stable aggregate progress identities, stable per-evidence contribution
   identities, and stable non-repeatable award identities.
3. A single canonical evidence-authority comparator used by both pure
   evaluation and persisted ingestion:
   - higher global correction authority;
   - higher authoritative source cursor;
   - revoked over non-revoked at otherwise equal authority;
   - locale-independent UTF-16 code-unit comparison of canonical serialized
     evidence as the final total-order tie-break.
4. Rule-reset-safe Elevation Bank authority: the globally ordered event time is
   used for mobile correction authority, while rule-scoped ledger revision is
   retained in the source cursor.
5. Correction, revocation, rebucketing, stale retry, restart, and owner-change
   handling that recomputes affected projections without destroying unrelated
   monthly windows.
6. Owner-generation-scoped hydration, serialized ingestion, and bounded
   self-healing AsyncStorage persistence retry.
7. Explicit resolved windows, exact 28-day rolling bounds, trusted local
   day/week buckets, and transition-safe IANA calendar-month resolution.
8. Exact qualification-purpose and pinned producer-rule checks for every
   challenge and achievement, plus unconditional canonical SDE/provenance
   checks.
9. An additive `recentEvents` Elevation Bank response containing the complete
   latest-per-activity owner-scoped state, including revocations. The original
   `recentCredits` path remains independently selected, effective-time ordered,
   and limited for backwards compatibility.
10. Explicit evidence mapping from Elevation Bank events. No unsafe type cast
    promotes manual, unverified, indoor, or unknown evidence.
11. Completion consequence presentation that requires the current canonical
    activity lineage to appear in the newly completed progress/award evidence.
12. Explicit unavailable projection/catalogue states for unsupported
    authoritative producers rather than fabricated progress or awards.

## Adversarial checks

### Duplicate and retry safety

**PASS.**

- Aggregate progress is keyed by owner, definition/version, rule version, and
  window rather than by the growing evidence set.
- Contribution identities remain evidence-specific.
- Non-repeatable award identity does not change as qualifying evidence grows.
- Identical retries do not emit titles again.
- Reversed-order, persisted-restart, Unicode, same-version, stale-cursor,
  correction, and revocation cases are deterministic.

### Owner isolation

**PASS.**

- Ingestion rejects evidence for another Clerk owner.
- Projection reducers validate both action owner and nested record owner.
- Achievement correction metadata is derived only from owner-scoped evidence.
- Elevation Bank API reads derive the owner from Clerk authentication and do
  not accept a caller-supplied owner.

### Evidence and competition boundaries

**PASS.**

- Manual, indoor, unverified, simulated Expedition, and trusted outdoor
  evidence remain distinct.
- Every definition requires its exact qualification purpose and pinned producer
  rule.
- Competitive qualification requires explicit competitive purpose/status and
  is not activated by personal recognition.
- No public leaderboard or production competition eligibility was enabled.

### Windows and timezones

**PASS.**

- Evaluators require resolved start-inclusive/end-exclusive windows.
- Month resolution is IANA-timezone aware, including London DST, skipped
  midnights, exact month ends, and December-to-January transitions.
- Rolling windows cover exactly the configured duration.
- Multiple monthly windows persist independently.
- Corrections moving an activity between months recompute both windows.

### Corrections and revocations

**PASS.**

- Elevation Bank exposes a complete latest-per-activity event snapshot,
  including revocations and rule changes.
- Global event authority supersedes rule-scoped revision.
- A revoked or corrected activity replaces its lineage rather than
  double-counting.
- Dependent progress/awards are recomputed and revoked when no longer earned.
- Existing confirmed award `earnedAt` is retained while it remains valid.

### UX and offline behavior

**PASS with documented limits.**

- Challenges, Profile, Account, and completion presentation consume the
  owner-scoped Stage 8 projection additively.
- Revoked records are not counted as confirmed/tracked.
- Offline or unqualified consequences remain pending/unavailable and no title
  is fabricated.
- Only a newly confirmed consequence linked to the current canonical activity
  is shown on completion.
- Challenge/achievement families without an accepted authoritative producer
  are explicitly unavailable. Distance, consistency, Training, Readiness,
  Expedition, and canonical-mountain consequences must remain unavailable until
  their existing systems expose exact accepted consequence identities and
  provenance.

### Protected and production boundaries

**PASS.**

- Progress Mountain and cinematic implementations were not changed.
- Offline tracker lifecycle and checkpoint engine were not redesigned.
- Readiness, Expedition, SDE, and Elevation Bank semantics were not weakened.
- No auth, privacy, payment, pricing, RevenueCat, or Stripe change occurred.
- No production SQL/schema/migration, backfill, reconciliation, deployment,
  release, or flag activation occurred.
- PA-A2 and PA-A3 remain isolated and unchanged.

The unrelated workflow-generated file
`artifacts/mockup-sandbox/src/.generated/mockup-components.ts` remains outside
the Stage 8 checkpoint.

## Verification evidence

Final direct verification:

- SummitReady configured suite: **22 files / 141 tests passed**.
- SummitReady broader utility regression: **23 files / 160 tests passed**
  earlier in C09 before the final focused additions.
- SummitReady TypeScript: **passed**.
- API suite: **29 files passed, 1 skipped / 356 tests passed, 4 optional DB
  tests skipped**.
- API production bundle build: **passed**.
- Generated OpenAPI React/Zod clients: **regenerated successfully** after the
  additive contract change.
- `git diff --check`: **passed**.
- Independent closing architecture review: **PASS**.

The OpenAPI code-generation command's chained workspace-wide library typecheck
still exits on unrelated pre-existing `integrations-openai-ai-server`
diagnostics. Full API workspace typecheck also retains unrelated baseline
diagnostics outside the Stage 8 Elevation Bank files. The API production build,
API tests, generated outputs, mobile typecheck, and Stage 8 suites pass.

## Native-device QA

**NOT RUN.**

Native-device QA remains a release gate. Required later checks include:

- finish/save a qualifying tracked hike and observe one new consequence;
- retry/reopen without replaying the consequence;
- correct and revoke a credited activity and verify projection changes;
- complete a hike offline and verify honest pending/unavailable presentation;
- switch accounts and confirm owner-isolated projection hydration;
- inspect Challenges, Account, Profile, and completion presentation on iOS and
  Android for accessibility, reduced motion, and layout.

No mobile/store release readiness is claimed.

## C09 conclusion

O8-C09 is **COMPLETE**. The verified implementation may proceed to the O8-C10
documentation completion gate. Stage 9 implementation remains prohibited.