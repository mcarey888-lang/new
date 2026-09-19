# Stage 4 Preflight — Foundation Activation

**Result:** S4-R01 COMPLETE  
**Date:** 2026-09-19 UTC  
**Branch:** `virtual-expeditions-mode`

## Dependency map

1. **Physical activity identity**
   - GPS tracked hills use the authenticated tracked-hill route and a stable client activity ID.
   - Manual Training and ExploreHike canonical adapters exist but are default-off.
   - The tracked-hill canonical bridge is transactional, but currently defaults on unless explicitly disabled.
2. **Canonical consequences**
   - Canonical links and the qualification evaluator are pure, owner-scoped foundations.
   - The evaluator has output-only purposes that must not be written into the narrower persisted qualification vocabulary.
3. **Stage 2 ledgers**
   - `0002_stage2_activity_ledgers.sql` and the Drizzle schema prepare personal elevation and simulated Expedition ledgers.
   - Current code only plans ledger events; there is no transactional persistence/read service.
4. **Mobile completion**
   - Shared Track preserves local UUID, checkpoint, pending selection, outbox, and offline save behavior.
   - Training and Expedition completion remain separate legacy consequences after the physical hike is saved.
5. **Visible totals and history**
   - Profile, history, Training, Expedition, challenge, and achievement surfaces still read legacy local stores.
   - Canonical history projection exists server-side but is not a released mobile consumer.

## Findings that must be closed before activation

| Boundary | Finding | Safe Stage 4 action |
|---|---|---|
| Canonical bridge | Tracked-hill bridge defaults on while Manual Training and ExploreHike adapters default off. | Make every new canonical dependency explicit opt-in; preserve legacy writes when unavailable. |
| Elevation evidence | Planner accepts a broad evidence vocabulary but persists only recorded/quality/verified classes. | Separate input classification from persisted eligible classes and reject untrusted/manual/indoor credit conservatively. |
| Credit concurrency | Revision uniqueness prevents duplicate revisions but does not itself serialize two first-credit attempts. | Add transactional identity locking/advisory locking plus unique retry handling. |
| Effective credit | Status rows are append-only, but “latest effective revision” is not implemented as a service contract. | Add deterministic latest-revision selection and totals that count only the current effective credited row. |
| Corrections | Lineage tables protect event-to-event relationships but runtime writers/readers are absent. | Insert event and lineage atomically; never update/delete evidence history. |
| Expedition runs | Runs and contributions are owner-scoped by composite relationships; run creation has no runtime service. | Add owner-scoped run lookup/create and contribution writer; keep `simulated_completion = true`. |
| Qualifications | Evaluator emits output-only purposes not accepted by the persisted qualification check. | Explicitly map only persisted purposes; keep consequence-only purposes out of qualification inserts. |
| Explore reuse | Explicit owned canonical reuse is safe, but does not prove source/context equivalence. | Require an explicit owned activity and validate compatible source/context before adding links. |
| Challenge totals | One challenge activity can also be written to sessions and Explore hikes, creating a legacy double-count path. | Treat challenges as consequences of one canonical activity; never as a separate elevation-credit source. |
| History | Canonical projection is shadow-only and legacy records may not have canonical IDs. | Compare canonical/legacy counts and totals before any consumer switch; retain legacy-only rows. |

## Migration review

`0002_stage2_activity_ledgers.sql` is additive and remains unapplied. SQL and Drizzle definitions are materially aligned:

- owner/activity composite foreign keys prevent cross-owner credit and contribution rows;
- append-only revision and correction-lineage constraints are present;
- Expedition contributions are constrained to simulated completion;
- no backfill, deletion, or destructive alteration is included.

Required additive hardening before development activation:

- add service-level transactional serialization and unique-conflict retry;
- add deterministic current-effective indexes/read contracts where useful;
- add owner-safe run creation and lookup contracts;
- make eligible persisted evidence classes explicit and exhaustive in tests;
- add migration/schema contract tests for indexes, checks, and foreign keys.

No destructive migration correction is required, so C02 may proceed without crossing a RED gate. Production application remains prohibited.

## Existing completion and consequence handoffs

- GPS save writes legacy hike history first and may then complete a Training session.
- Expedition stage completion/progress is handled separately from Training and personal totals.
- Manual Training completion updates plan/readiness state without canonical ingestion.
- Challenges and achievements use legacy session/Explore data and have no canonical credit hook.
- Existing completion screens do not yet receive a structured canonical consequence summary.

## Safe implementation sequence

1. Harden migration/schema contracts and add transactional ledger services.
2. Prove all new ingestion adapters under explicit test/development activation only.
3. Implement personal Elevation Bank crediting and deterministic totals.
4. Add an idempotent activity consequence resolver.
5. Expose safe unavailable/pending API boundaries before any production dependency exists.
6. Add Profile/completion UI that renders only verified service data.
7. Shadow canonical history against legacy history; switch only if equivalence is demonstrated.
8. Produce production-readiness documentation without applying migration or flags.

## Protected-boundary result

- No production schema, data, flag, release, payment, authentication, public-privacy, SDE, Progress Mountain, or cinematic/live-3D change occurred.
- Offline Start → Track → Pause → Resume → Finish → Save remains unchanged.
- Real Summit, Expedition Completion, and Mountain Simulation remain distinct.
