# SummitReady AI Task — Stage 3 Master Runbook

## S3-MASTER — Navigation + UX Cohesion

Stage 2 is COMPLETE and accepted. Stage 3 is approved as a bounded development stage. Work sequentially through S3-C01 to S3-C08 in one active Agent session where possible. Do not wait for the owner between GREEN commands.

### Goal
Make SummitReady feel like one premium outdoor product while preserving its two distinct journeys:

- **Training:** “I have a mountain booked.” Target mountain + date → readiness → personalised preparation → arrive ready.
- **Expedition:** “I want an adventure.” Choose expedition → local stages → track hikes → expedition progress → complete the simulated adventure.
- **Explore/Free Hike:** a shared usage state, not a third mode.

The architecture should make it obvious where the user is, what their current objective is, and what the next useful action is.

### Operating protocol
- Execute commands strictly in order.
- Record S3-R01…S3-R08 in AI_CHANGELOG.md and keep AI_HANDOFF.md current.
- Commit at safe checkpoints.
- Use targeted inspection and normal/default Agent effort; do not repeatedly audit the whole repo.
- Preserve backwards compatibility and existing data.
- Prefer reuse/refactor of existing components over parallel replacement screens.
- Continue automatically through GREEN commands.
- Stop immediately for a RED gate, genuine blocker/failure, or after S3-R08.
- No production Publish is required for Stage 3. Keep any pending migrations recorded and unapplied.

### RED gates
Stop for explicit owner approval before:
- production DB migration/data mutation;
- destructive migration/backfill/deletion;
- App Store/Play Store/mobile production release;
- payments/subscriptions/pricing;
- authentication/security model changes;
- destructive/replacement changes to Summit Data Engine;
- removal/replacement/substantial redesign of Progress Mountain or cinematic/live-3D summit transition;
- public privacy/competitive leaderboard activation.

### Protected product rules
- Training and Expedition remain distinct journeys, not tabs that blur into one mode.
- Preserve the 21,576-mountain Summit Data Engine and its stable identities.
- Preserve Progress Mountain elevation-driven route fill and summit → cinematic/live-3D completion transition.
- Preserve offline-first Start → Track → Pause → Resume → Finish → Save.
- One physical activity remains one canonical activity with additive purposes.
- Real Summit, Expedition Completion and Mountain Simulation remain distinct.
- Do not apply Stage 2 migration 0002 to production during this stage.

---

## S3-C01 — Current navigation/UX map

Perform a targeted implementation audit of current navigation, mode state, home/dashboard entry points, Explore, Track, Community/Profile, Training, Expedition, back behavior, deep links and existing onboarding handoffs.

Deliver a concise internal map identifying:
- duplicated or conflicting navigation;
- screens with ambiguous Training/Expedition context;
- dead ends;
- inconsistent headers/back behavior;
- screens that should become shared surfaces;
- screens that must remain mode-specific;
- current component reuse opportunities.

Do not change runtime yet.

Result: S3-R01. Continue automatically if COMPLETE.

## S3-C02 — Shared app shell and mode context

Implement/refine the shared shell using the existing canonical shellMode/state architecture.

Target primary navigation:
- Basecamp
- Explore
- Track
- Community
- You

Requirements:
- mode context is visible where relevant but not intrusive;
- The primary/home destination remains named **Basecamp**. Do not rename it to Home. Basecamp is the product concept and shared primary navigation label; its content is mode-aware, showing the distinct Training Basecamp or Expedition Basecamp experience as appropriate.
- switching mode must not corrupt state or silently reset progress;
- Track is a shared entry point and retains Free Hike plus context-aware Training/Expedition paths;
- preserve deep links/back behavior;
- avoid duplicate navigation stacks;
- accessibility labels and safe-area behavior;
- no onboarding redesign yet.

If current navigation differs materially and changing all five tabs at once is high-risk, implement an additive shell/component boundary first and migrate incrementally in later commands.

Result: S3-R02.

## S3-C03 — Training Basecamp hierarchy

Refine Training Basecamp around one dominant goal and next action. Keep the user-facing Basecamp naming; do not rename it Home.

Priority hierarchy:
1. target mountain + target date/days remaining;
2. Readiness as primary Training metric;
3. Today’s Mission / next training action;
4. weekly progress;
5. readiness breakdown / training hills;
6. supporting community/challenge information.

Requirements:
- preserve current readiness calculations and training-plan logic;
- no Readiness 2.0 algorithm changes;
- reduce dashboard/card clutter where safely possible;
- reuse existing content/components;
- avoid tiny uppercase-label overload and excessive nested cards;
- premium outdoor visual hierarchy, not generic SaaS dashboard;
- no paywall/pricing changes.

Result: S3-R03.

## S3-C04 — Expedition Basecamp hierarchy

Refine Expedition Basecamp around adventure progress and the next stage. Keep the user-facing Basecamp naming; do not rename it Home.

Priority hierarchy:
1. current expedition hero/context;
2. expedition progress;
3. next stage and primary CTA;
4. protected Progress Mountain;
5. stage list / Mountain DNA where available;
6. supporting community/challenge information.

Requirements:
- Progress Mountain remains prominent and functionally unchanged;
- do not alter summit → cinematic/live-3D transition;
- preserve current Expedition calculations/state;
- clarify labels where simulated elevation could be confused with real mountain altitude/local route ascent;
- use labels such as Elevation target / Elevation climbed where appropriate;
- no Expedition rules changes.

Result: S3-R04.

## S3-C05 — Explore + mountain/route cohesion

Refine Explore as the shared discovery surface.

Requirements:
- Mountains, routes, local hills and Expeditions should be discoverable without duplicating canonical data;
- Training can launch target-relevant discovery;
- Expedition can launch stage/local-equivalent discovery;
- Free Hike can discover a route and Track it;
- SDE remains authoritative for canonical summit identity;
- do not copy SDE data into a replacement model;
- clearly distinguish real mountain altitude, route ascent/elevation gain and simulated expedition elevation;
- preserve existing route/mountain functionality and offline requirements.

No Route Engine rebuild in this command.

Result: S3-R05.

## S3-C06 — Shared Track entry and completion handoff

Unify the Track entry UX without changing the proven offline tracking engine.

Requirements:
- shared Track entry offers contextually appropriate actions: Free Hike, Training session where applicable, Expedition stage where applicable;
- starting a hike must never wait for network, route name, map tiles or reverse geocoding;
- preserve local UUID/checkpoint/outbox behavior;
- prevent duplicate Start actions;
- completion hands the single physical activity to relevant contexts without duplicating the activity;
- if Stage 2 canonical adapters are still default-off/unpublished, preserve legacy runtime and prepare the UI/service boundary without enabling unsafe writes;
- no Stage 2 production migration.

Result: S3-R06.

## S3-C07 — Community/You cohesion and visual consistency

Refine shared Community and You/Profile entry surfaces using existing features only.

Requirements:
- do not activate public competitive functionality not already released;
- Profile should communicate mountain identity: current goal/adventure, existing elevation/summits/achievements where already available;
- Community should expose only existing safe/released content;
- standardize page headers, spacing, card hierarchy, button hierarchy, empty/loading/error states and accessibility;
- centralize reusable design tokens/components where practical;
- preserve existing brand palette and avoid a wholesale visual rewrite.

Result: S3-R07.

## S3-C08 — Stage 3 regression/completion gate

Run a bounded integration/regression pass.

Verify:
- Training and Expedition state remain isolated;
- Basecamp resolves correctly for each mode and remains the primary/home navigation label;
- shared Explore/Track/Community/You navigation works;
- deep links/back behavior have no obvious regressions;
- offline tracking lifecycle is unchanged;
- canonical activity architecture remains compatible;
- no production schema dependency was accidentally introduced;
- Stage 2 migration remains unapplied;
- SDE untouched;
- Progress Mountain and cinematic/live-3D summit behavior untouched;
- no payments/auth/release/public-privacy changes.

Run relevant targeted tests/builds. Avoid unrelated expensive suites unless a failure requires them.

Create docs/STAGE_3_COMPLETION_REPORT.md with:
- delivered UX/navigation changes;
- screenshots/routes/components materially changed;
- tests/build results;
- known issues;
- pending production migrations/flags;
- Stage 4 prerequisites.

Update AI_HANDOFF.md and AI_CHANGELOG.md, commit/push, and STOP. Do not begin Stage 4.

Result: S3-R08 — COMPLETE / PARTIAL / BLOCKED / FAILED / APPROVAL REQUIRED.
