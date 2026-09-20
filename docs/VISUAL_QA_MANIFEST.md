# SummitReady Visual QA Manifest

**Scope:** VQ-C01–C09 final visual evidence plus VR-C04 populated-state evidence
**Date:** 2026-09-20 UTC
**Viewport:** 390 × 844 CSS pixels, phone portrait
**Status:** Final stable repository pack; VR-C04 is complete; native-device QA remains outstanding.

## Capture labels

- **Authentic local Expo runtime** — the real Expo Metro app with production
  providers/components, used for signed-out, onboarding, and error evidence.
- **Deterministic existing dev-profile runtime via `/demo`** — the existing
  development-only `utils/devProfiles.ts` loader writes deterministic local
  fixtures, reloads the real app, and redirects to the requested production
  screen. These are real production screens, not mock screens, but do not
  represent a real account. No new fixture route was added.
- **Protected production component demo** — the protected production Progress
  Mountain renderer. `mountain-demo` is now `__DEV__` guarded; it is not a
  production route or replacement renderer.
- **Public onboarding demo** — the existing public onboarding route, labelled
  demo content rather than authenticated product evidence.
- **Failure evidence** — the Replit `appPreview` attempt that resolved to the
  unrelated landing-page 404. It documents a routing limitation only.

Every indexed item is an actual PNG/JPG in this repository. No transient URL is
the sole evidence.

## VR-C04 deterministic demo-profile matrix

The following exactly five development-only personas use the fixed fixture
clock **2026-09-20 UTC**: Beginner, Active Hillwalker, Experienced Summiteer,
Expedition-focused, and Advanced all-round. Every item below is a synthetic
deterministic fixture rendered through the real production UI at 390 × 844;
none is a production account or production evidence.

| File | Persona | Production screen/state |
|---|---|---|
| `docs/visual-qa/demo-profiles/beginner-basecamp.png` | Beginner | Training Basecamp |
| `docs/visual-qa/demo-profiles/hillwalker-basecamp.png` | Active Hillwalker | Training Basecamp |
| `docs/visual-qa/demo-profiles/hillwalker-explore.png` | Active Hillwalker | Explore |
| `docs/visual-qa/demo-profiles/summiteer-profile.png` | Experienced Summiteer | You/Profile |
| `docs/visual-qa/demo-profiles/summiteer-rank.png` | Experienced Summiteer | Rank journey |
| `docs/visual-qa/demo-profiles/expedition-basecamp.png` | Expedition-focused | Expedition Basecamp |
| `docs/visual-qa/demo-profiles/expedition-progress.png` | Expedition-focused | Expedition Progress |
| `docs/visual-qa/demo-profiles/advanced-track.png` | Advanced all-round | Track |
| `docs/visual-qa/demo-profiles/advanced-challenges.png` | Advanced all-round | Challenges/Achievements |
| `docs/visual-qa/demo-profiles/advanced-profile.png` | Advanced all-round | You/Profile |

The demo loader and Rank fixtures are `__DEV__` guarded, with production
rejection tests; they cannot create or select production identities.

## Stable screenshot index

| File | Route/state | Method | Notes |
|---|---|---|---|
| `docs/visual-qa/final/signed-out-home.png` | `/`, signed-out landing | Authentic local Expo runtime | Auth gate and first CTA |
| `docs/visual-qa/final/onboarding-training.png` | `/onboarding-demo/training-pitch`, public onboarding | Public onboarding demo | Demo content, not authenticated evidence |
| `docs/visual-qa/final/not-found.png` | invalid route | Authentic local Expo runtime | Error/recovery state |
| `docs/visual-qa/final/basecamp-advanced.png` | `/demo?p=advanced_mont_blanc` → `/(tabs)/dashboard`, unobscured loaded Training Basecamp | Deterministic existing dev-profile runtime via `/demo` | Real production Basecamp, no baseline sheet obscuring the screen |
| `docs/visual-qa/final/explore-populated.png` | `/demo?p=advanced_mont_blanc` → `/(tabs)/explore`, populated Explore | Deterministic existing dev-profile runtime via `/demo` | Real production Explore |
| `docs/visual-qa/final/readiness-detail.png` | `/demo?p=advanced_mont_blanc` → `/readiness-detail`, populated readiness detail | Deterministic existing dev-profile runtime via `/demo` | Real production Readiness detail |
| `docs/visual-qa/final/session-detail.png` | `/demo?p=advanced_mont_blanc` → `/session-detail`, session detail | Deterministic existing dev-profile runtime via `/demo` | Real production session detail |
| `docs/visual-qa/final/elevation-history.png` | `/demo?p=advanced_mont_blanc` → `/elevation-history`, signed-out/authority-unavailable empty state | Deterministic existing dev-profile runtime via `/demo` | Honest empty history; no populated totals claimed |
| `docs/visual-qa/final/track-start.png` | `/demo?p=advanced_mont_blanc` → `/(tabs)/trails`, populated GPS-ready Training Track start | Deterministic existing dev-profile runtime via `/demo` | 374.4 km / 46 hikes, scheduled Hill Repeats CTA, recent activity, and central Track label |
| `docs/visual-qa/final/challenges.png` | `/demo?p=advanced_mont_blanc` → `/(tabs)/challenges`, one deterministic completed personal challenge | Deterministic existing dev-profile runtime via `/demo` | Honest completed personal state; Challenges remains contextual |
| `docs/visual-qa/final/you-training.png` | `/demo?p=advanced_mont_blanc` → `/(tabs)/account`, Training You/Profile | Deterministic existing dev-profile runtime via `/demo` | Account/profile context |
| `docs/visual-qa/final/you-expedition.png` | `/demo?p=advanced_mont_blanc` → `/(expedition)/profile`, unavailable Rank above Achievements | Deterministic existing dev-profile runtime via `/demo` | Real Expedition Profile |
| `docs/visual-qa/final/expedition-discovery.png` | `/demo?p=advanced_mont_blanc` → `/(expedition)/mountains`, catalogue discovery | Deterministic existing dev-profile runtime via `/demo` | First-class Expeditions destination |
| `docs/visual-qa/final/expedition-basecamp.png` | `/demo?p=advanced_mont_blanc` → `/(expedition)/base-camp`, compact protected Progress Mountain | Deterministic existing dev-profile runtime via `/demo` with Chromium forced reduced motion | Accessible fallback shows 27% progress, stage list, and next-stage CTA |
| `docs/visual-qa/final/progress-expanded.png` | `/demo?p=advanced_mont_blanc` → `/(expedition)/progress`, expanded Progress Mountain | Deterministic existing dev-profile runtime via `/demo` | Visual mountain renderer and real protected progression surface |
| `docs/visual-qa/final/route-mountain-dna.png` | `/demo?p=advanced_mont_blanc` → `/(expedition)/route`, Mountain DNA route detail | Deterministic existing dev-profile runtime via `/demo` | Real production route detail |
| `docs/visual-qa/final/progress-mountain.png` | `/mountain-demo`, protected Progress Mountain component demo | Protected production component demo | Visual mountain renderer captured before `__DEV__` guard; never a production route |
| `docs/visual-qa/final/rank-journey.png` | `/rank`, tappable Rank journey destination | Authentic local Expo runtime | Non-persistent, unavailable/degraded-safe Rank ladder |
| `docs/visual-qa/initial/basecamp-beginner.png` | `/demo?p=beginner_ben_nevis` → Basecamp, baseline sheet | Deterministic existing dev-profile runtime via `/demo` | Initial comparison |
| `docs/visual-qa/initial/explore.png` | `/demo?p=beginner_ben_nevis` → `/(tabs)/explore`, empty Explore history | Deterministic existing dev-profile runtime via `/demo` | Initial empty state |
| `docs/visual-qa/initial/profile-training.png` | `/demo?p=beginner_ben_nevis` → `/(tabs)/account`, initial Training Profile | Deterministic existing dev-profile runtime via `/demo` | Initial comparison |
| `docs/visual-qa/initial-runtime-dashboard.jpg` | `/(tabs)/dashboard`, public preview attempt | Failure evidence | Landing-page 404; excluded from visual conclusions |

## Coverage and known gaps

The pack covers real production Basecamp, Explore, Readiness, session detail,
Elevation History, Track, personal completed Challenge, Training and Expedition
profiles, Expedition discovery/Base Camp/route Mountain DNA/expanded
Progress, Rank, onboarding, navigation, signed-out, and invalid-route states.
It meets the principal visual judgement through production screens/components
and honest empty, degraded, unavailable, and completed states without claiming
every native state.

Native active GPS, permission denial, airplane/offline recovery, restored
checkpoint, process termination, reduced motion, dynamic type, screen-reader
focus, and device-specific safe-area behavior were not captured. Activity
completion, pending/revoked consequence states, Community Routes, and any other
native-only tracking/recovery states also remain explicit native/release QA
gaps, not fabricated evidence.

The existing `/demo` loader is the only development fixture loader used here.
No new visual fixture route remains in the production route tree.