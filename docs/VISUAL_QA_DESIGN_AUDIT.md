# SummitReady Visual QA Design Audit

**Scope:** VQ-C07 lead-design self-audit  
**Date:** 2026-09-20 UTC  
**Viewport:** 390 × 844 CSS pixels, phone portrait  
**Status:** Audit only; this document records findings and does not authorize a
wholesale redesign.

## Evidence and confidence

This audit uses the stable files in `docs/visual-qa/initial/` and
`docs/visual-qa/final/`, together with the capture method and route index in
`docs/VISUAL_QA_MANIFEST.md`.

Capture labels are important:

- **Authentic runtime:** an actual Expo route with production providers.
- **Development-profile runtime:** an actual Expo route after loading the
  repository's deterministic development profile. It uses production screens,
  not mock screens, but it is not representative of a real account's data.
- **Protected production component demo:** `mountain-demo` renders the protected
  production Progress Mountain component with demo controls. It is not a
  replacement renderer.
- **Failure evidence:** `initial-runtime-dashboard.jpg` is the Replit
  `appPreview` attempt that returned the landing-page 404. It is not evidence
  about the mobile UI and is excluded from visual quality conclusions.

The screenshots provide good evidence for static mobile hierarchy, navigation,
Rank states, Training/Expedition context, and Progress Mountain. They do not
prove native GPS, offline recovery, permission prompts, live tracking,
accessibility services, or device-specific safe-area behavior. Those remain
native-device QA items.

## Finding summary

| ID | Severity | Finding | Status |
|---|---|---|---|
| VQ-P1-01 | P1 | Internal “Stage 8” wording was exposed in user-facing Profile, Challenges, and You surfaces. | Fixed before final recapture: replaced with “Verified progress”. |
| VQ-P1-02 | P1 | Challenges retained a “Community” eyebrow after Community left the permanent tab bar, creating an incorrect social/navigation implication. | Fixed before final recapture: changed to “Your progress”. |
| VQ-P1-03 | P1 | The visually strongest central Track action had no visible text label. | Fixed before final recapture: added a compact “Track” label while retaining the central action treatment. |
| VQ-P1-04 | P1 | Rank could appear to accept generic or wrong-purpose evidence, weakening authority semantics. | Fixed before final recapture: exact signal-purpose contracts and a complete explicit availability map now gate promotion. |
| VQ-P1-05 | P1 | Deep links could leave the shell context or active destination visually out of sync. | Fixed before final recapture: route resolution synchronizes mode and shell state before rendering. |
| VQ-P1-06 | P1 | Active-tab styling could describe the previous route instead of the current destination. | Fixed before final recapture: active-tab semantics derive from the resolved route, including Rank and Expedition destinations. |
| VQ-P1-07 | P1 | Development-only visual harness boundaries were easy to mistake for product capture sources. | Fixed before final recapture: final evidence uses authentic routes, the existing `/demo` loader, or the protected component demo, all explicitly labelled. |
| VQ-P0-01 | P0 | No P0 broken or unsafe visual issue was observed in the available evidence. | No fix required. Native-only states remain unverified, not declared safe. |
| VQ-P2-01 | P2 | Several screens use many nested rounded cards and small uppercase labels, especially Profile, Challenges, and Track. | Remaining polish. |
| VQ-P2-02 | P2 | Training and Expedition use different green/blue accents effectively, but some shared controls and headings still vary in spacing and density. | Remaining polish. |
| VQ-P2-03 | P2 | Some development/profile captures expose sparse or signed-out data states that make the screen feel less finished than a populated account. | Data-state polish; not a production-data defect. |
| VQ-P2-04 | P2 | Expedition discovery imagery is strong, but some cards crop or defer imagery differently from Training hero surfaces. | Remaining imagery consistency work. |
| VQ-P3-01 | P3 | Add reduced-motion screenshots and a deliberate accessibility pass for dynamic entrance transitions, contrast, and dynamic type. | Future native QA. |
| VQ-P3-02 | P3 | A future Rank journey could use a more explicit vertical ascent visualization once authoritative rank evidence is available. | Optional enhancement; do not fabricate evidence. |

## Screen-by-screen audit

### Signed-out home — `final/signed-out-home.png`

**Capture:** authentic local Expo runtime, signed-out state.

- **3-second comprehension:** Strong. The mountain mark, “Train for any
  mountain using hills near you,” and green start CTA explain the product
  quickly.
- **CTA:** “Get started — it’s free” is dominant and “Sign in” is a clear
  secondary action.
- **Hierarchy and typography:** The logo and headline lead well; supporting
  benefits are legible but slightly card-heavy below the fold.
- **Spacing and density:** Generous enough for a first-run screen. The three
  benefit cards could eventually be condensed, but this is P2.
- **Identity:** Clearly mountain preparation rather than generic SaaS.
- **Finding:** P2 only; no comprehension blocker.

### Basecamp / Training Home — `initial/basecamp-beginner.png`,
`final/basecamp-advanced.png`

**Capture:** development-profile runtime after deterministic profile loading.
The beginner image includes the baseline sheet; the advanced image is an
unobscured loaded-goal state.

- **3-second comprehension:** The mountain goal and next action are apparent
  behind the baseline sheet. The sheet itself has a clear explanation and
  single acknowledgement CTA.
- **CTA:** The baseline “Got it, let’s go” is appropriately dominant. In the
  unobscured loaded state, the hero and next training action establish purpose.
- **Hierarchy:** Goal imagery and elevation context create a credible outdoor
  identity. Elevation Bank is visually prominent and should remain clearly
  personal, not competitive.
- **Spacing/card density:** The loaded Basecamp has several stacked surfaces;
  the elevation card, hero metrics, and plan content compete somewhat.
- **Finding:** P2-01 nested-card density. No P0/P1 fix is justified from these
  captures.

### Explore — `initial/explore.png`, `final/explore-populated.png`

**Capture:** development-profile runtime using production Explore screen.

- **3-second comprehension:** “Start local. Build your mountain fitness.” is
  direct and memorable.
- **CTA:** “Log a hike” is the correct primary action; “Browse hikes” is a
  useful secondary path.
- **Hierarchy:** Metrics, suggested challenge, and achievements form a useful
  progression from current state to next action.
- **Typography/spacing:** Strong heading scale and readable metric values.
  Achievement tiles become dense below the first viewport.
- **Identity:** Local hills and elevation make this distinct from a generic
  fitness dashboard.
- **Finding:** P2-01 badge/card density below the fold; no P1 issue.

### Readiness detail — `final/readiness-detail.png`

**Capture:** deterministic existing `/demo` development-profile runtime using
the real production Readiness detail screen.

- **3-second comprehension:** The readiness title, dimensions, and next action
  explain how local training relates to the selected mountain goal.
- **Hierarchy:** Evidence, interpretation, and action are separated clearly
  enough to support scanning without presenting readiness as a safety
  certification.
- **Authority:** The populated deterministic profile is clearly development
  evidence; unsupported or unavailable inputs remain labelled rather than
  silently converted into certainty.
- **Finding:** P2-02 shared spacing/density only.

### Session detail — `final/session-detail.png`

**Capture:** deterministic existing `/demo` development-profile runtime using
the real production session detail screen.

- **3-second comprehension:** Session title, planned work, and completion
  context establish the purpose before secondary metadata.
- **Hierarchy:** The primary session action is distinct from supporting plan
  information and does not imply that viewing a session records GPS evidence.
- **Finding:** No P0/P1 visual issue; native tracking and save semantics remain
  outside this static capture.

### Elevation History — `final/elevation-history.png`

**Capture:** deterministic existing `/demo` development-profile runtime using
the real production personal Elevation History screen, captured in a
signed-out/authority-unavailable state.

- **3-second comprehension:** The empty state clearly communicates that
  personal elevation history is unavailable rather than implying populated
  history.
- **Authority:** The screen does not fabricate totals when the authoritative
  producer is unavailable. This is honest empty-state evidence, not populated
  history evidence.
- **Finding:** Empty-state polish remains P2; no P1 issue.

### Track start — `final/track-start.png`

**Capture:** deterministic existing `/demo` development-profile runtime,
populated authentic Track production screen.

- **3-second comprehension:** “GPS ready” and “Track Activity” immediately
  communicate the screen's purpose.
- **CTA:** The next training session and “Start Free Hike” are clear, with the
  scheduled session correctly taking visual precedence.
- **Hierarchy:** The metrics strip supports context without overwhelming the
  start action.
- **Populated state:** 374.4 km and 46 hikes establish credible recent history;
  the scheduled Hill Repeats CTA and recent activity provide a clear next
  action and continuity.
- **Accessibility/safety:** GPS-ready is visually explicit, but permission
  denial, offline, checkpoint restoration, and live native behavior were not
  captured and cannot be inferred from this screenshot.
- **Navigation:** The central Track tab is now labelled after the P1 fix.
- **Finding:** P2-03 long recent-activity list can feel data-heavy; no P0/P1
  visual defect.

### Challenges — `final/challenges.png`

**Capture:** development-profile runtime, personal Challenges production screen.

- **3-second comprehension:** The title, counters, featured challenge, and
  “Start Challenge” explain the screen quickly.
- **CTA:** “Start Challenge” is dominant and appropriate.
- **Hierarchy/card density:** The completed personal challenge is clearly
  distinguishable from the catalogue, although the list below is dense and
  badge-heavy.
- **Navigation:** The stale “Community” eyebrow was a P1 because it implied a
  social surface inconsistent with the approved navigation and Stage 9
  boundary. It was changed to “Your progress” before the final implementation
  checkpoint.
- **Identity:** Challenge copy is mountain-specific and motivational.
- **Finding:** Remaining P2-01 density only; the deterministic completed state
  is honest personal progress, and Challenges remain contextual rather than a
  permanent tab.

### You / Training Profile — `initial/profile-training.png`,
`final/you-training.png`

**Capture:** development-profile runtime, production Account screen. The
  screenshot is near the top of a scroll surface; Rank may require scrolling
  below account and subscription context.

- **3-second comprehension:** “Profile”, the active Training Goal, and account
  state are clear.
- **CTA:** “Log a Session” and subscription action are visible, but the
  profile surface has several competing destinations.
- **Hierarchy/card density:** The account and Elevation Bank cards are useful,
  but the screen is more settings-heavy than the intended prestigious Rank
  surface.
- **Finding:** P2-01 density and P2-03 sparse/signed-out state. Rank is additive
  and must remain below the current personal context without fabricating rank
  evidence.

### You / Expedition Profile — `final/you-expedition.png`

**Capture:** development-profile runtime, production Expedition Profile.

- **3-second comprehension:** Profile and Expedition shell are clear from the
  blue mode control and the compact stats row.
- **CTA:** Settings is clear; the Rank journey is visible as a progression
  surface rather than an action competing with tracking.
- **Hierarchy:** Rank correctly precedes Achievements. The “Evidence building”
  state is honest when authoritative producers are unavailable.
- **Typography/spacing:** The Rank card is legible, but the requirement rows
  are information-dense at 390px.
- **Finding:** P2-02 shared spacing and P2-03 sparse fixture data. No P1 issue.

### Rank journey — `final/rank-journey.png`

**Capture:** authentic local Expo runtime at the `/rank` destination using the
production Rank journey.

- **3-second comprehension:** The Rank destination communicates a long-term
  mountain progression journey without presenting it as a qualification or
  competition.
- **Authority:** “Evidence building” communicates that Rank is not asserted
  without authoritative producers. Unavailable values remain unavailable rather
  than being rendered as zero, and no eligible fixture or fabricated completion
  is shown.
- **Hierarchy:** Current Rank, next-rank progress, requirement rows, and the
  authority notice are ordered correctly. The journey is additive and distinct
  from Achievements and Challenges.
- **Navigation:** The deep link resolves into the correct shell context and
  active destination semantics; returning to the originating mode preserves
  the expected tab state.
- **Finding:** P2-02 shared spacing and P2-03 sparse evidence remain. A future
  richer ascent visualization is P3 and must wait for authoritative evidence.

### Expedition discovery — `final/expedition-discovery.png`

**Capture:** development-profile runtime, production Expedition discovery
screen.

- **3-second comprehension:** The blue Expedition mode and “Explore” heading
  identify the shell, while regional imagery explains the browsing purpose.
- **CTA:** “Create Custom Route” and expedition cards are clear.
- **Imagery:** This is the strongest imagery-led screen in the pack and gives
  SummitReady a credible outdoor identity.
- **Spacing/density:** Horizontal region chips and cards are dense but
  discoverable; this is an acceptable P2 polish area.
- **Navigation:** Expeditions is now a first-class permanent destination.

### Expedition Base Camp — `final/expedition-basecamp.png`

**Capture:** deterministic existing `/demo` development-profile runtime using
the real production Expedition Base Camp with compact protected Progress
Mountain, with Chromium forced reduced motion.

- **3-second comprehension:** Expedition identity, current stage, and next
  local action are immediately legible.
- **Hierarchy:** The accessible reduced-motion fallback shows clear 27%
  progress, the stage list, and a next-stage CTA without replacing the
  protected expanded progression renderer.
- **Identity:** Simulated Expedition progress is visually distinct from Real
  Summit evidence.
- **Finding:** P2 shared spacing only; no P0/P1 issue.

### Expanded Progress Mountain — `final/progress-expanded.png`

**Capture:** deterministic existing `/demo` development-profile runtime using
the real production expanded Progress Mountain surface.

- **3-second comprehension:** Stage sequence and progression read as a
  mountain journey rather than a generic progress bar.
- **Protected boundary:** The production renderer and completion semantics are
  preserved; the deterministic profile only supplies review state.
- **Motion distinction:** This capture shows the visual mountain renderer; the
  compact Base Camp capture separately covers its reduced-motion accessible
  fallback.
- **Finding:** P2 density around stage metadata; no P0/P1 issue.

### Route / Mountain DNA — `final/route-mountain-dna.png`

**Capture:** deterministic existing `/demo` development-profile runtime using
the real production Expedition route/Mountain DNA detail screen.

- **3-second comprehension:** Route identity, terrain/mountain context, and
  the next decision are apparent from the hero and supporting facts.
- **Imagery:** This adds route-level identity beyond catalogue discovery while
  retaining the Expedition blue context.
- **Finding:** P2 image crop and information density remain polish areas.

### Progress Mountain — `final/progress-mountain.png`

**Capture:** protected production component demo captured before the
`mountain-demo` route became `__DEV__` guarded. It is retained as historical
component evidence, not a production route.

- **3-second comprehension:** The mountain progression and stage sequence read
  immediately.
- **CTA/interaction:** Scrubbing is a demo control, not a production CTA.
  Production completion semantics were not changed.
- **Identity:** This is strongly SummitReady-specific and avoids generic bars.
- **Finding:** No visual P0/P1. Do not replace the protected renderer merely
  for polish; current production-screen evidence is provided by the compact
  Expedition Base Camp and expanded Progress captures.

### Onboarding, invalid route, and other states

`final/onboarding-training.png` is an authentic public demo route and should be
read as demo evidence, not authenticated product evidence. `final/not-found.png`
is a valid error-state capture with a clear return path. The final pack includes
Readiness, session, Elevation History, route/Mountain DNA, compact Base Camp,
expanded Progress, and one completed personal Challenge state.

Native-only live tracking, permission denial, offline recovery, restored
checkpoint, active GPS, activity completion, pending/revoked consequence
states, reduced-motion, dynamic type, screen-reader focus, and device-specific
safe-area states remain uncaptured. They are explicit native/release QA
requirements, not reasons to invent screenshots or downgrade the static audit.

## Cross-screen criteria

### Typography

Large confident headings and high-contrast metric values establish a clear
outdoor-product voice. Small uppercase eyebrows are useful for context but are
overused across some Profile, Track, and Challenge surfaces. This is P2, not a
reason for a broad typography rewrite.

### Spacing and card density

The app consistently uses breathing room around primary surfaces, but many
screens place multiple nested rounded cards in one viewport. Basecamp, Profile,
Challenges, and Track are the main candidates for future consolidation. Avoid
removing meaningful state boundaries merely to reduce card count.

### Imagery

Expedition discovery and mountain hero imagery provide strong identity. Screens
without reliable image data use a dark gradient fallback rather than broken
media. More consistent crop and loading-state review is P2.

### Navigation clarity

The final shell visibly communicates **Basecamp | Explore | Track | Expeditions
| You**. Track is central and visually strongest, with a visible label.
Challenges is no longer a permanent tab and remains reachable contextually from
Basecamp/You. The stale Community eyebrow was replaced with “Your progress”.
Deep links synchronize shell mode before rendering, and active-tab styling is
derived from the resolved destination rather than stale navigation history.
The removed `visual-review` harness is not an active capture source; the
existing `/demo` loader is the only development fixture loader.

### Training versus Expedition distinction

Green Training and blue Expedition controls make shell context legible without
changing the underlying data model. Expedition discovery has a distinct
imagery-led browsing purpose; Training Explore and Track emphasize local
practice and readiness. Continue testing shell switching and deep links on
native devices.

### Accessibility and reduced motion

Labels, color contrast, and touch targets are generally readable at the review
viewport. Dynamic entrance animations are used throughout the app, but this
pack does not establish a reduced-motion mode, screen-reader traversal, dynamic
type behavior, or native focus order. These are P3 follow-ups and a native
release gate, not a licence to remove meaningful motion globally.

### SummitReady identity

The strongest screens combine mountain imagery, elevation, route progression,
and preparation language. The product does not read as a generic SaaS
dashboard. The main risk is density and repeated card treatment, not lack of
identity.

## Final disposition

- **P0:** None observed in the available static evidence.
- **P1:** Seven findings were identified and fixed: internal terminology,
  stale Community eyebrow, unlabeled central Track action, Rank authority
  contracts, deep-link shell synchronization, active-tab semantics, and the
  development-harness boundary.
- **P2:** Card density, repeated uppercase labels, sparse development-profile
  states, cross-screen spacing, and image-crop consistency remain.
- **P3:** Native accessibility/reduced-motion evidence and a richer future Rank
  journey remain.

This audit is evidence for VQ-C08 and VQ-C09. It does not authorize Stage 9
Community implementation, public identity, leaderboard work, production
schema, or a wholesale redesign.