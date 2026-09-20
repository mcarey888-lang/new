# SummitReady Premium Basecamp Visual Refinement + Ben Nevis Hero

**Command:** VR2-C01
**Authority:** ChatGPT lead product/design/architecture
**Baseline:** `1ae8df602654147bd45e2896b5f2aa0070699e54`
**Stage 9:** PAUSED / NOT AUTHORIZED.
**Scope:** Training Basecamp only.

## Why this pass exists

The approved-artwork integration pilot is technically successful, but direct human visual review of the real 390×844 screenshots did **not** accept the screen as the master visual pattern for SummitReady.

Keep what works: cinematic image-led direction, clear Training/Expeditions mode distinction, Ben Nevis goal context, existing Training functionality, Mission Control semantics, Readiness 2.0, Elevation Bank, navigation and safe approved-artwork boundary.

The visual problem is below the hero: the screen falls back into a generic stack of rounded SaaS/fitness-dashboard cards. The Ben Nevis hero itself is also not good enough: it is mostly anonymous grey mist/rock and does not make Ben Nevis recognisable or aspirational.

Target: make the functioning Training Basecamp feel materially closer to the approved premium outdoor/editorial mock-up — cinematic, authentic, spacious, strong typography, fewer containers, restrained accent colour, continuous landscape/page composition.

Do not copy a screenshot mechanically. Preserve real data and behavior.

## VR2-C01 — Baseline and protected boundaries

Read:
- `docs/PREMIUM_BASECAMP_PILOT_REPORT.md`
- `docs/SUMMITREADY_PREMIUM_UI_SYSTEM.md`
- `docs/SUMMITREADY_ART_DIRECTION.md`
- current Basecamp implementation and current premium-basecamp screenshots.

Preserve:
- Training/Expedition shell semantics;
- Readiness 2.0 calculations/evidence;
- Training plan/session actions;
- Elevation Bank semantics;
- offline/canonical activity tracking;
- Basecamp | Explore | Track | Expeditions | You;
- DEV/demo isolation and production fail-closed media behavior;
- protected Expedition Progress Mountain/cinematic files and behavior.

No production migration, publication, deploy, release, payment/auth change, Stage 9, or broad reskin.

## VR2-C02 — Change the visual-QA goal to an approved flagship summit

The current Ben Nevis visual is rejected as the long-term goal-mountain hero.

For this V2 pilot, **do not generate new Ben Nevis artwork**. Change the deterministic Training Basecamp visual-QA/demo goal from Ben Nevis to **Mont Blanc**, using the already manually approved flagship asset:

`SR-MTN-MONTBLANC-001 — Mont Blanc — Alpine Dawn`

Requirements:
- use the approved exact current version through the existing safe approved-artwork resolver;
- use Mont Blanc only where the deterministic DEV/demo profile needs a goal for this visual pilot;
- do not alter a real user's selected goal;
- do not change Training logic or Readiness calculations;
- goal title, route/elevation/distance/date context must come from existing Mont Blanc fixture/catalogue data where available — never retain Ben Nevis metrics under a Mont Blanc label and never invent values;
- if a field is unavailable, omit it gracefully;
- preserve production fail-closed behavior because the artwork is approved but not published;
- no new generation, no Batch 02, no auto-approval, no publication.

This pass should prove how a named approved summit hero works in the premium Basecamp composition.

## VR2-C03 — Recompose Basecamp as an editorial continuous page

The current structure has too many independent rounded cards. Reduce container count aggressively while preserving functionality.

Desired hierarchy:

**Goal mountain / cinematic hero**
→ **This week's mission**
→ **Readiness**
→ **Your progress**
→ quieter **Achievements / Coaching / commercial prompts**

### Hero
- reduce visually dead/anonymous space;
- make the mountain the visual subject;
- integrate goal title/date/essential metrics with stronger editorial hierarchy;
- keep readability gradients subtle;
- logo must not float as a competing splash-screen element;
- Training/Expeditions switch remains clear but should feel integrated rather than pasted over the photograph;
- edit/lock controls should be quieter;
- avoid decorative badges unless useful.

### This week's mission
- treat Week/phase/progress + next session as one editorial section;
- one dominant action;
- avoid making the whole thing another large rounded card;
- use typography, spacing, line/divider treatment and selective surface elevation instead;
- preserve session description and navigation.

### Readiness
Readiness is a signature SummitReady capability. It must feel important even when entitlement-locked.
- preserve exact Readiness 2.0 semantics;
- do not make the locked state look dead/disabled;
- communicate capability/value without inventing a score;
- avoid a generic grey dashboard widget;
- commercial lock/upgrade cue should be subordinate to the feature identity.

### Your progress
Bring Elevation Bank and essential supporting stats into a coherent progress composition rather than separate stacked cards.
- Elevation Bank remains accessible;
- combine/reduce containers where semantically sensible;
- use larger useful numbers, editorial labels, whitespace and separators;
- do not invent or merge unrelated data semantics.

### Secondary content
Achievements, warnings, upgrade prompt and AI Coach should not all compete as equal cards.
- preserve access/function;
- warnings remain appropriately prominent when actionable;
- commercial upsell should be quieter and not interrupt the main training narrative;
- achievements/coaching can use flatter rows/sections or restrained surfaces;
- reduce repeated green decoration.

## VR2-C04 — Colour, type, spacing and navigation balance

- Green = deliberate progress/action signal, not default decoration for every module.
- Keep blue/neutral support colours restrained.
- Increase typographic hierarchy; avoid tiny dashboard copy where larger editorial text works.
- Reduce tiny uppercase labels and excessive pills.
- Use fewer radii/surface boxes; whitespace and thin separators should do more work.
- Maintain accessible contrast.
- Review the central Track tab: preserve its central importance and behavior, but if it visually overwhelms the Training primary action, reduce only its decorative dominance without changing tab architecture.
- Keep small-phone/safe-area behavior sound.

## VR2-C05 — Motion

Keep motion restrained. Reuse the established system.
- hero may have subtle entrance/parallax/scale;
- mission/readiness may settle smoothly;
- no loops/confetti/heavy video;
- respect reduced motion;
- no interaction delay;
- low-end Android safe.

## VR2-C06 — Direct visual self-review and correction loop

Use real 390×844 app screenshots, populated deterministic profiles.

Capture:
- first viewport;
- mid-scroll / Readiness + progress;
- lower supporting content;
- locked/non-Pro state;
- fallback hero state;
- Ben Nevis candidate review sheet if generation was required.

Store under:
`docs/visual-qa/premium-basecamp-v2/`

Before stopping, compare the actual screenshots against these acceptance questions and self-correct obvious failures:
1. Does the top immediately feel like a premium outdoor/mountain product?
2. Is Ben Nevis recognisable/aspirational rather than generic fog/rock?
3. Does the screen continue to feel editorial after the hero?
4. Are there materially fewer independent rounded cards?
5. Is there one obvious Training action?
6. Does Readiness feel like a signature capability?
7. Is progress understandable without a dashboard grid feeling?
8. Is green restrained?
9. Does the Track tab avoid overpowering the current screen action?
10. Does any section still look like generic SaaS/fitness UI?

Do not declare visual success merely because tests pass.

## VR2-C07 — Verification

Run targeted tests and bounded regression for changed production code. Verify:
- Training semantics/navigation unchanged;
- Readiness unchanged;
- Elevation Bank unchanged;
- artwork fail-closed behavior unchanged;
- DEV/demo isolation;
- reduced-motion behavior;
- bottom-tab routes unchanged;
- protected Expedition files untouched.

Run TypeScript and production iOS/Android Expo exports if shared production mobile code changed.

No production deploy/release.

## VR2-C08 — Report and STOP

Create:
`docs/PREMIUM_BASECAMP_V2_REPORT.md`

Update:
- `docs/AI_HANDOFF.md`
- `docs/AI_CHANGELOG.md`
- visual QA manifest as appropriate.

Report:
- exact visual changes;
- container/card reduction;
- exact Mont Blanc approved asset/version consumed and deterministic demo goal mapping;
- screenshots;
- tests/builds;
- remaining shortcomings;
- protected-boundary confirmation.

Commit/push and STOP after the GREEN refinement and visual QA are complete.

Do NOT:
- reskin Explore/Track/Expeditions/You;
- generate Ben Nevis artwork or Batch 02;
- generate a mountain catalogue;
- auto-approve or publish new artwork;
- alter Readiness logic;
- alter protected Progress Mountain/cinematic;
- start Stage 9;
- deploy/release.

End response with exactly one status:
COMPLETE
PARTIAL
BLOCKED
FAILED
APPROVAL REQUIRED
