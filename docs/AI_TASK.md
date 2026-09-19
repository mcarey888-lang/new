# SummitReady AI Task — Stage 6: Expedition Experience

## Objective
Turn Expedition mode into a distinctive adventure journey: choose an expedition, complete matched local stages, see meaningful progress, and experience a memorable summit completion.

Stage 6 builds around the existing Expedition architecture and the protected Progress Mountain/cinematic work. It MUST preserve Training/Expedition separation, canonical activity identity, offline-first tracking, Summit Data Engine identities, and all completed Stage 1–5 boundaries.

PA-A2 remains parked. Production remains unchanged/default-safe.

## Product outcome
Expedition answers: **How far through my adventure am I, what should I climb next, and what happens when I reach the summit?**

Basecamp should feel like a premium outdoor expedition dashboard, not a SaaS dashboard:
- one dominant current expedition;
- compact live Progress Mountain as the visual centrepiece;
- simulated elevation/progress clearly distinguished from real climbed elevation;
- obvious next local stage + primary CTA;
- concise stage journey/history;
- rewarding stage completion;
- tap compact mountain to open the existing full Progress Mountain;
- summit completion flows into the protected cinematic/live-3D summit experience.

## Protected Progress Mountain decision
This is now a core Stage 6 requirement.

**Basecamp → compact Progress Mountain → tap → existing full Progress Mountain → summit → cinematic/live-3D completion.**

The compact and expanded views MUST consume the same underlying expedition progress/state. Do not create an independent competing progress calculation.

Compact Basecamp version should target roughly 30–35% of the useful screen height and show, where supported:
- mountain silhouette/artwork;
- existing elevation-driven route/progress fill;
- current position;
- current / total simulated expedition elevation and percentage;
- current or next stage marker;
- restrained “View progress” affordance.

The full-screen Progress Mountain remains the richer detailed experience and preserves the existing progressive elevation-driven fill/stage behavior.

At 100%, preserve the intended summit sequence: progress reaches summit → camera/visual transition into cinematic/live-3D mountain → climber reaches summit → expedition completion.

Existing implementation may be refactored only to share state/rendering safely. It must not be removed, replaced, substantially redesigned, or regressed without explicit owner approval.

Protected files include:
- artifacts/summit-ready/components/MountainProgress.tsx
- artifacts/summit-ready/components/ExpeditionMountainProgress.tsx
- artifacts/summit-ready/app/(expedition)/base-camp.tsx
- artifacts/summit-ready/components/CinematicPrototype.tsx

## Architecture rules
One physical activity exists once. Expedition contribution is a consequence/link, not a duplicate activity.

Keep distinct:
- real GPS ascent / personal Elevation Bank;
- simulated Expedition progress/elevation;
- Training Readiness evidence;
- real summit evidence.

A real Expedition GPS activity may qualify for other systems once under their rules. Simulated Expedition elevation must never masquerade as real ascent, Elevation Bank credit, Readiness evidence, or a real summit.

Offline selected-stage tracking remains Start → Track → Pause → Resume → Finish → Save without network gating. Route/stage context is cached before tracking. Sync may enrich later but cannot gate recording/completion.

Use stable SDE/canonical identities where available. No fuzzy-name identity, duplicate summit store, AI-invented coordinates/route facts, or destructive SDE changes.

## S6-C01 — Expedition + Progress Mountain audit
Audit only. Map:
- Expedition entry/discovery/current expedition flow;
- Basecamp hierarchy/state;
- expedition/stage/run/contribution models and APIs;
- current simulated-progress calculation;
- stage completion/consequence path;
- offline selected-stage cache/tracking;
- MountainProgress and ExpeditionMountainProgress rendering/data contracts;
- summit/cinematic/live-3D trigger path;
- duplicate/dead/legacy Expedition surfaces;
- tests and production gates.

Identify exactly what can be reused for compact/expanded Progress Mountain and where state should be centralized without changing behavior.

Create docs/STAGE_6_EXPEDITION_AUDIT.md.
End S6-R01 with one status.

## S6-C02 — Expedition UX/state specification
Define one canonical Expedition presentation state and screen hierarchy:
**Expedition selection → Basecamp → next stage → Track → completion → progress → summit.**

Specify:
- current expedition/run identity;
- overall progress and stage progress;
- real vs simulated labels;
- next-stage selection;
- completed/current/locked/upcoming stage states;
- offline/degraded/unavailable behavior;
- compact vs expanded Progress Mountain contract;
- summit transition trigger/idempotency;
- recovery after restart;
- no-progress/no-expedition/completed states.

Create docs/STAGE_6_EXPEDITION_MODEL.md.
If destructive migration or replacement of protected Progress Mountain/cinematic behavior is required: APPROVAL REQUIRED.

## S6-C03 — Shared Progress Mountain state
Implement/refactor the minimum shared typed state/selectors required so compact and expanded Progress Mountain consume the same deterministic expedition progress.

No second progress formula. Preserve existing full-screen behavior. Add tests for bounds, stage markers, restart/reload, missing data and 100% completion.

## S6-C04 — Compact Progress Mountain
Implement the compact Basecamp mountain presentation using the shared state.

Requirements:
- visual centrepiece, approximately 30–35% useful screen height;
- preserve recognizable mountain silhouette and route-fill language;
- current position/progress;
- simulated elevation + percentage with honest labeling;
- next/current stage cue;
- whole component tappable;
- restrained “View progress” cue;
- accessible fallback and reduced-motion behavior;
- no nested-dashboard clutter.

Tap opens the existing expanded Progress Mountain experience.

## S6-C05 — Expanded Progress Mountain integration
Integrate/refine the existing full Progress Mountain as the expanded destination.

Preserve its detailed progress/stage behavior. Ensure compact → expanded continuity, same values/state, correct back navigation, offline rendering, and no reset/recalculation drift.

Do not replace protected artwork/animation/cinematic implementation.

## S6-C06 — Basecamp hierarchy + next stage
Refine Expedition Basecamp around:
1. Expedition identity/status;
2. compact Progress Mountain;
3. **NEXT LOCAL STAGE**;
4. primary **Start Next Stage** CTA;
5. concise stage journey/recent progress.

Use premium dark-navy outdoor visual language, stronger imagery, fewer nested cards/tiny uppercase labels, and one dominant action. Preserve shared shell: Basecamp | Explore | Track | Community | You.

## S6-C07 — Stage completion consequence
After offline-safe Finish/Save, show clear physical activity facts separately from Expedition simulation:
- real distance/ascent/duration where recorded;
- simulated Expedition contribution;
- updated expedition progress;
- next-stage state;
- Elevation Bank consequence only when independently eligible.

No double counting. Completion presentation must work locally while sync/consequences may be pending.

## S6-C08 — Summit + cinematic completion
Wire/prove the idempotent 100% transition using existing protected functionality:
**route reaches summit → summit transition → cinematic/live-3D mountain → climber reaches summit → expedition complete.**

Handle replay/reopen/restart safely. Do not repeatedly award completion. Provide reduced-motion/non-3D fallback without deleting the hero experience.

Any substantial redesign/replacement of the existing cinematic/live-3D implementation requires APPROVAL REQUIRED.

## S6-C09 — Regression/protected-boundary review
Run bounded relevant suites + build/type checks. Verify no regression to:
- offline Start→Track→Pause→Resume→Finish→Save;
- canonical identity/dedupe;
- Training Readiness 2.0;
- Elevation Bank;
- real vs simulated semantics;
- shared shell/mode isolation;
- SDE identities/provenance;
- full Progress Mountain;
- summit cinematic/live-3D;
- auth/payment/privacy;
- production default-safe state.

Native-device QA remains required before release.

## S6-C10 — Completion gate
Create docs/STAGE_6_COMPLETION_REPORT.md and update docs/AI_HANDOFF.md + docs/AI_CHANGELOG.md.

Report commands/responses, changed architecture, compact/expanded state contract, Basecamp UX, stage completion behavior, summit trigger, tests/build/typecheck, offline compatibility, production capability state, PA-A2 isolation, protected-boundary verification, limitations and native QA status.

Stage 6 COMPLETE only when compact Progress Mountain is integrated on Basecamp; tapping opens the preserved expanded experience; both use one progress state; next-stage journey is clear; completion keeps real and simulated consequences distinct; summit transition remains protected and functional; production remains unchanged/default-safe.

Then STOP. Do not begin Stage 7.

## Response protocol
Use S6-R01 through S6-R10. Each response states prior result reviewed, concise implementation/files/tests/risks/commit, and ends with exactly one status: COMPLETE, PARTIAL, BLOCKED, FAILED, or APPROVAL REQUIRED.

## Authorization
GREEN Stage 6 audit, additive/default-off/refactoring work that preserves protected behavior, UI refinement, tests and documentation above is authorized.

NOT authorized: production DB/schema changes, production activation, destructive migration/backfill/reconciliation, production/mobile release, payments/pricing, auth/privacy changes, destructive SDE changes, replacement/substantial redesign of Progress Mountain or cinematic/live-3D functionality, or Stage 7. Any such need must stop for explicit owner approval.
