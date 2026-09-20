# SummitReady Visual QA Screen Inventory

**Scope:** VQ-C01 through VQ-C03 foundation  
**Date:** 2026-09-20 UTC  
**Branch:** `virtual-expeditions-mode`  
**Status:** Inventory and capture plan only. No application code was changed.

## Capture boundary

The SummitReady artifact is an Expo mobile application. The unrelated
SummitReady landing-page artifact is served at the shared root and is not
evidence of the mobile application.

An authentic preview attempt was made for:

`/(tabs)/dashboard` at a 390 × 844 phone viewport

The Replit `appPreview` resolved that request to the Expo artifact URL but
returned the Summit landing 404 screen ("Page not found"), not the Expo route.
The resulting file is retained as failure evidence at
`docs/visual-qa/initial-runtime-dashboard.jpg`. It must not be used as a
visual review of Basecamp or Training Home.

Because authenticated Expo/native screens cannot currently be seeded and
captured deterministically through this preview, this inventory distinguishes
three methods:

1. **Authentic runtime** — the actual Expo route rendered with its real
   providers, API, authentication, and persisted user state.
2. **Development harness** — a development-only route that renders the actual
   production screen/components with deterministic fixture providers. It must
   not fork or reimplement screen designs and must never ship in production.
3. **Not captured** — no trustworthy image exists yet; this is the current
   status where neither of the first two methods is available.

The initial C01-C03 pass did not create a development harness. C02 therefore
remains an explicit follow-up before a complete screenshot pack can be
claimed.

## Principal screen inventory

| Screen / route | Journey | Purpose | Primary CTA | Key states worth capturing | Authentic preview currently possible? | Capture method |
|---|---|---|---|---|---|---|
| `/` and `/mode-select` | Shared | Resolve auth, onboarding, and Training/Expedition context | Sign in / choose mode | Signed out, loading, signed in redirect, onboarding required, Training selected, Expedition selected | Partial: signed-out shell only; authenticated state is not deterministic | Authentic runtime when Clerk/session is seeded; otherwise development harness |
| `/(tabs)/dashboard` (Basecamp / Training Home) | Training | Training home with mountain goal, readiness, plan, and next action | Start next session / open plan | No goal, loading, loaded goal, readiness pending/error, completed week, image fallback, subscription lock | No | Development harness using actual screen and fixture context; later authentic runtime |
| `/(tabs)/explore` (Explore overview) | Explore | Discover local-hike information, suggested challenge, and achievements | Browse trails / set summit goal | Empty hike history, active history, completed achievement, locked achievement, loading/error | No | Development harness with seeded `exploreHikes`; later authentic runtime |
| `/(tabs)/hills` (Explore hills) | Explore | Discover nearby training hills | Select a hill | Loading, API success, API error, empty results, saved/completed hill, location unavailable | No | Authentic runtime with API/location fixtures or development harness |
| `/hill-detail` | Explore | Inspect a hill, route facts, and training value | Save / start tracking | Loading, loaded detail, missing hill, API error, saved, completed | No | Authentic runtime with deterministic API fixture or development harness |
| `/hills-finder` | Explore | Find a nearby hill by location/search | Search / choose hill | Permission prompt/denied, no location, loading, empty, results, error | No | Authentic runtime with location fixture or development harness |
| `/(expedition)/mountains` | Expeditions | Discover and select a virtual expedition target | Choose expedition | Empty catalogue, loading, loaded catalogue, unavailable target, selected target | No | Development harness with deterministic expedition catalogue; later authentic runtime |
| `/(expedition)/route` | Expeditions | Review the selected route and Mountain DNA | Start route / inspect route | Loading, route loaded, no route, route mismatch/error, Mountain DNA populated, degraded data | No | Development harness using actual route and Mountain DNA components |
| `/(expedition)/base-camp` (Expedition Basecamp) | Expeditions | Resume the active expedition and see current stage | Continue expedition / track stage | No active expedition, active expedition, stage complete, pending contribution, completed expedition | No | Development harness with deterministic active-expedition fixture; later authentic runtime |
| `/(expedition)/track` (Track start) | Expeditions | Launch tracking for an expedition stage | Start tracking | Ready, location permission required/denied, offline, restored checkpoint, unavailable route | No | Authentic device/runtime required for location behavior; harness may cover visual ready/error states |
| `/(tabs)/trails` (Track start) | Training | Launch a training activity | Start hike / log activity | Empty, selected route, GPS unavailable, offline, permission denied, ready | No | Authentic device/runtime for GPS; development harness for deterministic visual states |
| `/hike-tracking` (active tracking) | Shared | Show a live tracked activity and controls | Pause / finish tracking | Active GPS, paused, offline, recovering, permission loss, restored checkpoint, finish confirmation | No | Authentic native device capture required; harness cannot claim live GPS |
| `/(tabs)/progress` or `/(expedition)/progress` (compact Progress Mountain) | Training / Expedition | Show protected progress visualization in compact shell | Open progress / continue | Zero progress, partial progress, current stage, completed stages, degraded/missing evidence | No | Authentic runtime or development harness rendering the protected production component |
| `/progress` expanded Progress Mountain state | Shared | Inspect the expanded progression journey | Continue / close | Expanded mountain, stage marker focus, completion, reduced-motion behavior | No | Authentic runtime or development harness; do not replace renderer |
| `/readiness-detail` | Training | Explain readiness score and contributing factors | Review plan / return to session | Loading, score available, score stagnation, degraded/missing inputs, no goal | No | Development harness with actual Readiness screen and deterministic provider data |
| `/session-detail` | Training | Review and complete a planned activity | Mark session complete | Planned, substituted, completed, manual widget, offline save, failure/retry | No | Authentic runtime for completion interaction; harness for stable visual states |
| `/activity-completion` / completion presentation | Shared | Confirm a completed activity and consequences | Continue / view progress | Confirmed, pending evidence, rejected/unavailable, correction/revocation message | No | Development harness with actual completion presentation; authentic runtime later |
| `/challenge-detail` | Shared | Review one personal Challenge and its progress | Start / continue challenge | Active, completed, pending qualification, unavailable evidence, correction/revocation | No | Development harness with Stage 8 projection fixture; later authentic runtime |
| `/(tabs)/challenges` (Challenges) | Shared | Show personal challenge progress and completion | Open challenge / view completed | No challenges, active, completed, pending/unavailable qualification, loading | No | Development harness with actual Challenges screen and owner-scoped fixture |
| `/completed-challenges` | Shared | Review completed personal Challenges | Reopen challenge / return | Empty, one completed, multiple completed, correction/revocation | No | Development harness with actual completed-list screen |
| `/challenge-complete` | Shared | Present personal Challenge completion | Continue / view achievement | Confirmed completion, pending, unavailable, correction/revocation | No | Development harness with actual completion screen |
| `/(tabs)/account` (You / Training Profile) | Training | Show personal account, rank/achievement area, goals, and settings | Review profile / open Challenges | New user, active goal, completed goal, Stage 8 pending/confirmed, subscription states, settings | No | Development harness with actual Account screen; later authentic runtime |
| `/(expedition)/profile` (You / Expedition Profile) | Expedition | Show expedition identity, personal stats, achievements, and routes | Open rank journey / account settings | No activity, active sessions, completed achievements, pending Stage 8 evidence, active routes | No | Development harness with actual Profile screen; later authentic runtime |
| `/rank` or rank journey (planned additive route) | Shared | Explain long-term SummitReady Rank progression | View next requirement | New user, current rank, next rank, missing evidence, degraded/pending evidence, revocation | Not implemented in C01-C03 | Capture only after VQ-C05/C06 additive UI exists; development harness first |
| Rank/Achievements section in You/Profile | Shared | Distinguish Rank identity from Achievements and Challenges | Open rank journey / view achievements | Rank forthcoming, eligible progress, confirmed achievements, empty achievements, pending/unavailable | No | Development harness using actual Profile/Account components after C06 |
| `/elevation-history` | Training / Expedition | Review Elevation Bank history | Inspect event / return | Empty, confirmed credit, pending, correction/revocation, retry/error | No | Development harness with actual screen and deterministic evidence fixture |
| `/sessions` and `/past-activity` | Training | Review activity history | Open activity | Empty, active history, completed history, loading, unavailable/deleted activity | No | Authentic runtime with seeded history or development harness |
| `/community-routes` | Explore | Discover shared tracked routes without treating them as competition | Open route / launch tracking | Empty, latest routes, nearby results, loading/error, route detail privacy boundary | No | Authentic API fixture or development harness; do not expose raw/private evidence |
| `/setup` and `/questionnaire` | Training | Establish a summit goal and training setup | Save goal / continue | First run, partial form, validation, loading, saved, error | No | Authentic runtime with deterministic storage or development harness |
| `/onboarding-demo/*` and `/mobile/onboarding-demo/*` | Shared | Demonstration/onboarding journeys | Continue onboarding | Training and Expedition branches, paywall, plan ready, completed | Yes for public demo routes only | Authentic runtime capture is possible if route is reachable; label as demo, not authenticated product evidence |
| `/paywall` | Shared | Present subscription boundary | Subscribe / restore | Loading, available, restored, unavailable/error | No | Authentic runtime with subscription fixture or development harness |
| Auth routes `/(auth)/sign-in`, `sign-up`, `forgot-password` | Shared | Authenticate the user | Sign in / create account / reset password | Empty, validation error, loading, success/error | Partial: public route may render; provider-backed result is not deterministic | Authentic runtime for static states; never use fake auth success in a harness |
| `+not-found` | Shared | Handle invalid route | Return home | Invalid deep link, offline/error context | Yes as authentic error state | Authentic runtime |

## Cross-cutting states

Every principal screen should be reviewed in the following states where the
screen supports them:

- first-run/empty state with one clear next action;
- loading/skeleton or blocking initialization;
- successful populated state;
- partial/degraded data and unavailable authoritative evidence;
- API or persistence error with an explicit recovery action;
- offline state and restored checkpoint where tracking applies;
- completed state;
- correction/revocation/pending state for Stage 8 consequences;
- Training versus Expedition shell context;
- web versus native safe-area/layout behavior;
- reduced-motion/accessibility behavior.

The screenshot pack must not manufacture confirmed achievements, Rank progress,
competitive evidence, or location data. Stage 8 personal projections may be
shown only from deterministic owner-scoped fixtures or authentic user data.

## C01-C03 completion note

The inventory and initial capture matrix are complete. The initial preview
attempt is documented in `docs/VISUAL_QA_MANIFEST.md`. A complete principal
screenshot pack is not yet claimed because the preview route did not render the
Expo screen and no development-only harness was created during this
documentation-only foundation pass.