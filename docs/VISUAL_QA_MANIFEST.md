# SummitReady Visual QA Manifest

**Scope:** Initial VQ-C01 through VQ-C03 capture matrix  
**Date:** 2026-09-20 UTC  
**Viewport target:** 390 × 844 CSS pixels (modern phone portrait)  
**Status:** Initial matrix only; principal screenshot pack is pending a reliable
authenticated Expo capture path or a development-only harness.

## Capture method labels

- **Failure evidence** — a capture proving that a requested preview did not
  render the intended app; never suitable as product visual evidence.
- **Authentic runtime** — the actual Expo/React Native route with real
  production components and runtime providers.
- **Development harness** — a development-only route rendering the actual
  production components with deterministic fixture providers. It must be
  explicitly labelled and must not ship in production.
- **Pending** — no trustworthy capture exists yet.

## Initial capture evidence

| File | Requested route/state | Viewport | Method | Evidence status | Notes |
|---|---|---:|---|---|---|
| `docs/visual-qa/initial-runtime-dashboard.jpg` | `/(tabs)/dashboard`, Basecamp/Training Home | 390 × 844 | Replit `appPreview` | **Failure evidence only** | The preview resolved to the Summit landing 404 ("Page not found"), not the Expo screen. Do not use this image to assess Basecamp, navigation, typography, or Training UI. |

The direct preview attempt establishes that a shared Replit preview URL is not
currently a reliable authenticated Expo capture mechanism. No claim is made
that the mobile app itself is broken by this artifact mismatch.

## Principal capture matrix

The following matrix is the required initial pack. Rows marked **Pending** must
be captured after C02 establishes either authenticated Expo routing or a
development-only harness that renders actual production components.

| ID | Route/screen | State | Required visual evidence | Current file | Method/status |
|---|---|---|---|---|---|
| VQ-01 | `/(tabs)/dashboard` Basecamp / Training Home | Loaded goal | Hero, readiness, plan, dominant next action | — | Pending; harness or authentic runtime |
| VQ-02 | `/(tabs)/dashboard` Basecamp / Training Home | No goal/first run | Empty state and goal CTA | — | Pending; harness |
| VQ-03 | `/(tabs)/dashboard` Basecamp / Training Home | Loading/degraded | Initialization, readiness/API fallback | — | Pending; harness |
| VQ-04 | `/(tabs)/explore` Explore | Populated | Discovery hierarchy, trails/challenges/achievements | — | Pending; harness |
| VQ-05 | `/(tabs)/explore` Explore | Empty history | Empty state and first CTA | — | Pending; harness |
| VQ-06 | `/(tabs)/hills` / `/hills-finder` | Results | Nearby hill discovery and selection | — | Pending; authentic fixture or harness |
| VQ-07 | `/hill-detail` | Loaded | Mountain/hill detail and start CTA | — | Pending; authentic fixture or harness |
| VQ-08 | `/hill-detail` | Error/not found | Recovery and unavailable state | — | Pending; harness |
| VQ-09 | `/(expedition)/mountains` | Catalogue loaded | Expeditions discovery and selection | — | Pending; harness |
| VQ-10 | `/(expedition)/mountains` | Empty/loading | Discovery fallback states | — | Pending; harness |
| VQ-11 | `/(expedition)/route` | Route + Mountain DNA loaded | Route detail, provenance, Mountain DNA hierarchy | — | Pending; harness |
| VQ-12 | `/(expedition)/route` | Degraded/mismatch | Explicit unavailable/degraded route state | — | Pending; harness |
| VQ-13 | `/(expedition)/base-camp` | Active expedition | Expedition Basecamp and continue CTA | — | Pending; harness |
| VQ-14 | `/(expedition)/base-camp` | No active expedition | Selection CTA and empty state | — | Pending; harness |
| VQ-15 | `/(tabs)/trails` | Ready | Training Track start state | — | Pending; harness |
| VQ-16 | `/(expedition)/track` | Ready | Expedition Track start state | — | Pending; harness |
| VQ-17 | `/hike-tracking` | Active | Live tracking controls and metrics | — | Pending; authentic native runtime |
| VQ-18 | `/hike-tracking` | Offline/paused/recovery | Safety-critical recovery states | — | Pending; authentic native runtime plus harness for static states |
| VQ-19 | Progress route/component | Compact | Compact protected Progress Mountain | — | Pending; actual renderer via harness/runtime |
| VQ-20 | `/progress` or expanded progress route | Expanded | Expanded protected Progress Mountain | — | Pending; actual renderer via harness/runtime |
| VQ-21 | `/readiness-detail` | Score available | Readiness explanation and CTA | — | Pending; harness |
| VQ-22 | `/readiness-detail` | Missing/degraded | Explicit degraded evidence state | — | Pending; harness |
| VQ-23 | `/session-detail` | Planned | Activity detail and completion CTA | — | Pending; harness |
| VQ-24 | `/session-detail` | Completed | Completion state and consequence messaging | — | Pending; harness |
| VQ-25 | Activity completion presentation | Confirmed | Completed activity presentation | — | Pending; harness |
| VQ-26 | Activity completion presentation | Pending/unavailable/revoked | Stage 8 correction boundary | — | Pending; harness |
| VQ-27 | `/(tabs)/challenges` | Active challenges | Personal challenge hierarchy | — | Pending; harness |
| VQ-28 | `/(tabs)/challenges` | Empty | Empty personal challenge state | — | Pending; harness |
| VQ-29 | `/challenge-detail` | Completed/pending | Challenge detail consequence states | — | Pending; harness |
| VQ-30 | `/completed-challenges` / `/challenge-complete` | Completed | Personal completion presentation | — | Pending; harness |
| VQ-31 | `/(tabs)/account` | New user | You/Profile empty and settings entry | — | Pending; harness |
| VQ-32 | `/(tabs)/account` | Active goal + Stage 8 data | You/Profile, personal projection, achievements | — | Pending; harness |
| VQ-33 | `/(expedition)/profile` | Active expedition | Expedition You/Profile hierarchy | — | Pending; harness |
| VQ-34 | Rank/Achievements section | Rank forthcoming | Distinct Rank placeholder/spec state, no fabricated evidence | — | Pending; after VQ-C05/C06 harness |
| VQ-35 | Rank/Achievements section | Eligible/pending/revoked | Evidence explanation and requirements remaining | — | Pending; after VQ-C05/C06 harness |
| VQ-36 | `/elevation-history` | Confirmed/pending/revoked | Elevation Bank history and correction state | — | Pending; harness |
| VQ-37 | `/sessions` / `/past-activity` | Empty/populated | Activity history density and empty state | — | Pending; harness |
| VQ-38 | `/community-routes` | Route discovery | Community-adjacent discovery only; no ranking claim | — | Pending; fixture or harness |
| VQ-39 | `/setup` / `/questionnaire` | First run | Goal setup flow | — | Pending; harness |
| VQ-40 | Onboarding demo routes | Training/Expedition branches | Clearly labelled demo onboarding states | — | Pending; authentic public demo route |
| VQ-41 | Auth routes | Signed out/validation | Static auth states only | — | Pending; authentic runtime where reachable |
| VQ-42 | `+not-found` | Invalid deep link | Error recovery | — | Authentic runtime possible |

## Review coverage requirements

The completed pack must make it possible to compare:

- one consistent phone viewport and stable filenames;
- one populated and one empty/loading/degraded state for every principal
  journey;
- Training and Expedition context without mixing their persisted state;
- compact and expanded Progress Mountain using the protected production
  renderer;
- personal Stage 8 Challenge/Achievement pending, confirmed, and correction
  states without fabricating evidence;
- typography, spacing, imagery, CTA priority, navigation, and data density;
- native-only tracking behavior separately from static visual harness evidence.

Until those files exist, this manifest is an index and capture contract, not a
claim that the screenshot pack is complete.