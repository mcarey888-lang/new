# SummitReady Training Basecamp V3 — Locked Reference-Match Implementation

**Command:** V3-C01
**Authority:** ChatGPT lead product/design/architecture
**Implementation baseline:** `a51b4ed3d23c2c2d12f4ac18632c6f64f626a3be`
**Scope:** Training Basecamp only.
**Stage 9:** PAUSED / NOT AUTHORIZED.

## Locked visual target

The newly approved Training Basecamp mock-up supplied by the product owner is the visual specification for this pass.

This is no longer exploratory design. Refine the **real functioning Training Basecamp** so it matches the supplied reference as closely as practical at 390×844 while preserving real SummitReady data, interactions, navigation, accessibility and business logic.

Do not build a static screenshot clone. Match the design, not fabricated mock-up data.

The approved artwork resolver/CORS fix at the baseline commit is correct and must be preserved.

## V3-C01 — Hero

Use the proven approved asset:

`SR-MTN-MONTBLANC-001 — Mont Blanc — Alpine Dawn`, v1, hero derivative.

Preserve the approved-artwork resolver, DEV diagnostics and genuine fallback chain.

Match the reference:
- large immersive mountain photography with the summit clearly visible;
- subtle dark transition into lower content;
- deliberate SummitReady wordmark/header treatment;
- Training / Expeditions switch prominent over the hero;
- quiet lock/edit controls;
- small spaced `TRAINING OBJECTIVE`;
- large editorial Mont Blanc title;
- restrained metadata;
- no unnecessary outer card.

Use real goal data only. Never alter a real user's selected goal or invent missing metrics.

## V3-C02 — This week's mission

Match the reference composition:
- strong heading;
- existing View Plan action where valid;
- clean long progress indicator;
- percentage;
- week/phase status;
- strong spacing and hierarchy.

Preserve Training plan/session semantics.

## V3-C03 — Up Next / Easy Run

Make the next session feel like a premium training prescription rather than a settings row.

Follow the reference:
- richer visual treatment;
- `UP NEXT`;
- large session name;
- description;
- existing duration/intensity information where available;
- obvious action affordance.

Use an appropriate existing approved/local training image only if already available. Do not generate artwork. Do not fabricate duration, Zone or other session properties; omit unavailable fields gracefully.

## V3-C04 — Readiness signature treatment

Readiness is a primary SummitReady differentiator.

Replace the generic grey question-mark ring with a four-segment readiness visual representing the existing Readiness 2.0 dimensions:
- Endurance
- Elevation
- Consistency
- Mountain Experience

Locked/non-Pro:
- do not reveal calculated scores not entitled to the user;
- show the structure/dimensions;
- conceal/lock actual values;
- make the capability desirable rather than dead/disabled;
- retain existing entitlement/navigation.

Entitled users continue to use actual Readiness 2.0 values.

**Do not change any Readiness calculation or evidence semantics.**

## V3-C05 — Elevation Bank

Match the reference:
- prominent identity;
- existing explanatory copy;
- large meaningful numbers;
- clear metric labels;
- valid View Details action;
- premium restrained surface.

Only display real available data. Preserve ledger-backed Elevation Bank semantics exactly.

## V3-C06 — Training Insight

Remove the user-facing heading `Supporting`.

Restyle the existing schedule warning as **TRAINING INSIGHT** using a restrained premium amber/earth treatment. It should communicate intelligent coaching guidance rather than a system failure.

Preserve underlying warning logic and meaning.

## V3-C07 — Achievements + AI Coach

Follow the reference:
- quieter paired secondary modules where layout permits;
- distinct iconography;
- clear navigation;
- Pro status where applicable;
- lower priority than Mission, Readiness and Elevation Bank.

Preserve all existing behavior and responsive small-phone handling.

## V3-C08 — Bottom navigation

Preserve exactly:

**Basecamp | Explore | Track | Expeditions | You**

Match the reference proportions/restraint. Track remains central and distinctive but must not overpower current Training content. Do not change navigation architecture.

## V3-C09 — Overall visual language

The supplied reference is authoritative for:
- hierarchy;
- density;
- spacing;
- typography scale;
- image dominance;
- surface treatment;
- subtle borders;
- restrained translucency;
- dark cinematic palette;
- selective green;
- secondary accents;
- icon scale;
- information grouping.

Cards/surfaces are allowed where purposeful. Avoid repetitive generic dashboard-card rhythm.

The finished screen should feel like a premium outdoor/mountaineering product.

Respect reduced motion, contrast, safe areas, dynamic/small-phone constraints and low-end Android performance.

## V3-C10 — Functional and protected boundaries

Preserve:
- Training logic;
- Readiness 2.0 calculations;
- Elevation Bank;
- canonical activity architecture;
- offline tracking;
- session navigation;
- DEV/demo isolation;
- approved-artwork resolver and production fail-closed behavior;
- accessibility/reduced motion.

Do not touch protected Progress Mountain, ExpeditionMountainProgress, summit cinematic or live-3D behavior.

No schema migration.
No artwork generation.
No artwork publication.
No production deploy/release.
No Stage 9.
No redesign of other screens.

## V3-C11 — Mandatory visual QA

Capture real populated 390×844 screenshots from the functioning app:
1. hero + mission;
2. mission + Readiness;
3. Readiness + Elevation Bank;
4. Training Insight + Achievements/AI Coach;
5. full scroll if tooling permits;
6. approved-artwork fallback state.

Store under:
`docs/visual-qa/premium-basecamp-v3/`

Compare the actual result directly against the supplied reference and perform at least one self-correction pass after seeing real screenshots.

Do not declare visual success merely because tests pass.

Explicitly inspect:
- hero scale/crop;
- typography hierarchy;
- vertical rhythm;
- Readiness visual quality;
- surface proportions;
- excessive green;
- tiny text;
- generic dashboard appearance;
- bottom-nav dominance.

## V3-C12 — Verification and STOP

Run targeted tests, bounded regression, TypeScript and production Expo exports as appropriate.

Create:
`docs/PREMIUM_BASECAMP_V3_REPORT.md`

Update:
- `docs/AI_HANDOFF.md`
- `docs/AI_CHANGELOG.md`
- visual QA manifest as appropriate.

Report:
- exact implementation changes;
- exact approved asset/version consumed;
- screenshots;
- tests/builds;
- remaining differences from the locked reference;
- protected-boundary confirmation.

Commit/push and STOP.

Do not propagate this design to Explore, Track, Expeditions, You or any other screen until product-owner + lead-designer visual acceptance.

End response with exactly one status:
COMPLETE
PARTIAL
BLOCKED
FAILED
APPROVAL REQUIRED
