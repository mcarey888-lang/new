# SummitReady Master UI Asset Inventory

**Gate:** S2-C01  
**Audit date:** 2026-09-23 UTC  
**Machine-readable catalogue:** [`docs/summitready-master-asset-inventory.json`](summitready-master-asset-inventory.json)  
**Policy:** additive catalogue preparation only; no artwork generation, publication, production UI/data mutation, database change, or prototype-branch merge

## Audit scope and method

The approved prototype HTML was inspected read-only from
`origin/claude/fervent-mccarthy-7lnv35` with `git show`. The branch was not
checked out or merged. The audit covers:

- `summitready-explore-mockup.html`
- `summitready-training-basecamp-mockup.html`
- `summitready-training-plan-mockup.html`
- `summitready-readiness-mockup.html`
- `summitready-expedition-basecamp-mockup.html`
- `summitready-expeditions-library-mockup.html`
- `summitready-track-journey-mockup.html`
- `summitready-mountain-detail-mockup.html`
- `summitready-profile-mockup.html`
- `summitready-mockup-kit.html`

`summitready-onboarding-pro-mockup.html` was named in the brief but was not
present on the audited ref. Its nine required image families are still included
from the approved brief and are explicitly marked as brief-only.

The JSON catalogue is the normative record set. Every record includes the
requested `asset_key`, `display_name`, `category`, exact `screens_used_on`,
`usage_context`, `required_variants`, `recommended_format`, `source`, `status`,
`generation_required`, `generation_prompt`, and `notes`, plus generation
policy/provenance fields where relevant.

## Validated totals

| Category | Canonical records |
|---|---:|
| Standard UI icons | 86 |
| SummitReady signature symbols | 10 |
| Rank assets | 7 |
| Achievement families | 6 |
| Editorial image requirements | 21 |
| Mountain image references | 19 |
| Expedition image references | 17 |
| Profile image references | 14 |
| Map or route visuals | 4 |
| Existing/protected assets and systems | 11 |
| **Total** | **195** |

- **38** manual-only prompt records are prepared: 8 signature symbols, 7 ranks,
  6 achievement families, and 17 editorial image families.
- **157** records have an existing source, audited geometry, runtime resolver,
  prototype reference, or protected implementation.
- **38** canonical artwork records remain DRAFT/missing.
- **10** duplicate or inconsistency groups were documented.
- Database/schema changes: **none**.
- Migration required: **no**.
- Production data changed: **no**.

## Catalogue policy

### Generation policy

- `not-generatable`: standard UI vectors and existing source assets. They never
  enter an AI image-generation queue.
- `manual-only`: a curator must explicitly select and trigger one prompt record.
- `runtime`: resolved from verified data, user media, map/route rendering, or the
  existing mountain-image resolver.
- `protected`: existing approved media, components, records, or resolver
  behaviour that must not be regenerated or overwritten.

No “Generate All” operation is authorised. Any future generated result starts
as **DRAFT**, never APPROVED or PUBLISHED. Existing batch limits and approval
history remain authoritative.

### Mountain-image truth

The protected resolver hierarchy remains:

1. Photo of the Month
2. approved community photo
3. approved curated SummitReady/AI editorial hero
4. fallback terrain/map

AI-generated mountain imagery must be internally identifiable as AI editorial
imagery and must never be presented as documentary evidence of route geometry,
geography, current conditions, or safety.

## Standard UI icon registry — 86 concepts

All standard icons are `VECTOR`, `generation_required: false`, and
`generation_policy: not-generatable`. Prototype SVG geometry should be extracted
and normalised into one canonical React Native registry; no PNGs should be
created. “All” means all ten audited HTML prototypes above.

| Canonical key | Concept | Exact prototype screens | Geometry / canonicalisation note |
|---|---|---|---|
| `SR-ICON-MARK` | SummitReady Mark Icon | `summitready-explore-mockup.html`; `summitready-training-basecamp-mockup.html`; `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html`; `summitready-mockup-kit.html` | Raw `mark`; Compact SummitReady navigation mark; canonical vector extraction must defer to protected brand geometry. |
| `SR-ICON-PEAK` | Mountain / Expeditions | `summitready-explore-mockup.html`; `summitready-training-basecamp-mockup.html`; `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html`; `summitready-mockup-kit.html` | Raw `peak`; Expeditions navigation and mountain concept. |
| `SR-ICON-MAP` | Map | `summitready-explore-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-mockup-kit.html` | Raw `map`; Open map or map-based discovery. |
| `SR-ICON-SLIDERS` | Filters / Sliders | `summitready-explore-mockup.html`; `summitready-training-plan-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-mockup-kit.html` | Raw `sliders`; Open filter controls. |
| `SR-ICON-SEARCH` | Search | `summitready-explore-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-mockup-kit.html` | Raw `search`; Search discovery content. |
| `SR-ICON-X` | Dismiss / X | `summitready-explore-mockup.html`; `summitready-readiness-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-mockup-kit.html` | Raw `x`; Dismiss transient search/filter state. |
| `SR-ICON-CHEVRON-RIGHT` | Chevron Right | `summitready-explore-mockup.html`; `summitready-training-basecamp-mockup.html`; `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html`; `summitready-mockup-kit.html` | Raw `chev`; Drill-in navigation and list disclosure. |
| `SR-ICON-CHEVRON-LEFT` | Chevron Left | `summitready-training-plan-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-mockup-kit.html` | Raw `chevL`; Back navigation. |
| `SR-ICON-HEART` | Save / Heart | `summitready-explore-mockup.html`; `summitready-training-basecamp-mockup.html`; `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-mockup-kit.html` | Raw `heart`; Save or favourite content. |
| `SR-ICON-STAR` | Star | `summitready-explore-mockup.html`; `summitready-mockup-kit.html` | Raw `star`; Rating, featured or premium status. |
| `SR-ICON-ROUTE` | Route | `summitready-explore-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html`; `summitready-mockup-kit.html` | Raw `route`; Route, distance or path context. |
| `SR-ICON-AXES` | Crossed Mountain Axes | `summitready-explore-mockup.html`; `summitready-mockup-kit.html` | Raw `axes`; Technical mountain difficulty. |
| `SR-ICON-UK` | UK / Region | `summitready-explore-mockup.html`; `summitready-mockup-kit.html` | Raw `uk`; UK region filter or origin. |
| `SR-ICON-HOME` | Basecamp / Home | `summitready-explore-mockup.html`; `summitready-training-basecamp-mockup.html`; `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html`; `summitready-mockup-kit.html` | Raw `home`; Basecamp tab. |
| `SR-ICON-COMPASS` | Explore / Compass | `summitready-explore-mockup.html`; `summitready-training-basecamp-mockup.html`; `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html`; `summitready-mockup-kit.html` | Raw `compass`; Explore tab. |
| `SR-ICON-USER` | You / User | `summitready-explore-mockup.html`; `summitready-training-basecamp-mockup.html`; `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html`; `summitready-mockup-kit.html` | Raw `user`; You/Profile tab. |
| `SR-ICON-BOOTS` | Track / Footprints | `summitready-explore-mockup.html`; `summitready-training-basecamp-mockup.html`; `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html`; `summitready-mockup-kit.html` | Raw `boots`; Track tab. |
| `SR-ICON-BELL` | Notifications | `summitready-training-basecamp-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mockup-kit.html` | Raw `bell`; Notifications and reminders. |
| `SR-ICON-INFO` | Information | `summitready-training-basecamp-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-profile-mockup.html` | Raw `info`; Contextual information. |
| `SR-ICON-CLOCK` | Clock / Duration | `summitready-training-basecamp-mockup.html`; `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html`; `summitready-mockup-kit.html` | Raw `clock`; Duration and time. |
| `SR-ICON-CALENDAR` | Calendar | `summitready-training-basecamp-mockup.html`; `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html`; `summitready-mockup-kit.html` | Raw `calendar`; Dates and plans. |
| `SR-ICON-PLUS-CIRCLE` | Add / Plus Circle | `summitready-training-basecamp-mockup.html`; `summitready-training-plan-mockup.html` | Raw `plusC`; Add a session, route or item. |
| `SR-ICON-BOOK` | Guide / Book | `summitready-training-basecamp-mockup.html` | Raw `book`; Guide, training or expedition information. |
| `SR-ICON-MAP-FOLD` | Folded Map | `summitready-training-basecamp-mockup.html` | Raw `mapFold`; Route plan or navigation tools. |
| `SR-ICON-ARROW-RIGHT` | Arrow Right | `summitready-training-basecamp-mockup.html`; `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html` | Raw `arrowR`; Forward CTA. |
| `SR-ICON-PLAY` | Play | `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html` | Raw `play`; Start or resume activity/media; resume is a usage state of this evidenced play geometry. |
| `SR-ICON-GEAR` | Settings | `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-profile-mockup.html` | Raw `gear`; Settings. |
| `SR-ICON-CHECK` | Check | `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html` | Raw `check`; Completion and selection. |
| `SR-ICON-ALERT` | Warning / Alert | `summitready-training-plan-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-expeditions-library-mockup.html` | Raw `alert` + `warn`; Warning or alert status, including the Expeditions Library `warn` source-key alias. |
| `SR-ICON-TREND` | Chart / Trend | `summitready-readiness-mockup.html`; `summitready-profile-mockup.html` | Raw `trend`; Chart, progress and performance-trend context. |
| `SR-ICON-BOLT` | Energy / Bolt | `summitready-readiness-mockup.html` | Raw `bolt`; Energy, intensity or readiness signal. |
| `SR-ICON-WALK` | Walking Activity | `summitready-training-plan-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-profile-mockup.html` | Raw `walk`; Walking or hiking activity. |
| `SR-ICON-STAIRS` | Stairs Activity | `summitready-training-plan-mockup.html` | Raw `stairs`; Stair or step training. |
| `SR-ICON-DUMBBELL` | Strength Activity | `summitready-training-plan-mockup.html` | Raw `dumbbell`; Strength training. |
| `SR-ICON-BED` | Rest / Recovery | `summitready-training-plan-mockup.html` | Raw `bed`; Rest or recovery day. |
| `SR-ICON-FLAG` | Flag / Finish | `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-profile-mockup.html` | Raw `flag`; Expedition stage, finish or milestone. |
| `SR-ICON-GLOBE` | Public Visibility / Globe | `summitready-expeditions-library-mockup.html`; `summitready-profile-mockup.html` | Raw `globe`; Public visibility and public audience state. |
| `SR-ICON-USERS` | Followers / Users | `summitready-profile-mockup.html` | Raw `users`; Followers, community audience or group visibility. |
| `SR-ICON-LOCK` | Lock / Private | `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-profile-mockup.html` | Raw `lock`; Locked or private state. |
| `SR-ICON-DNA` | Mountain DNA | `summitready-expedition-basecamp-mockup.html`; `summitready-expeditions-library-mockup.html`; `summitready-profile-mockup.html` | Raw `dna`; Compact functional entry point to Mountain DNA. |
| `SR-ICON-MEDAL` | Medal | `summitready-profile-mockup.html` | Raw `medal`; Rank or achievement fallback. |
| `SR-ICON-TROPHY` | Trophy | `summitready-expeditions-library-mockup.html`; `summitready-mockup-kit.html` | Raw `trophy`; Generic achievement fallback. |
| `SR-ICON-FLAME` | Flame | `summitready-mockup-kit.html` | Raw `flame`; Streak or effort condition. |
| `SR-ICON-SNOW` | Snow | `summitready-profile-mockup.html` | Raw `snow`; Snow condition or special achievement fallback. |
| `SR-ICON-MOON` | Night / Moon | `summitready-profile-mockup.html` | Raw `moon`; Night activity or challenge fallback. |
| `SR-ICON-TENT` | Tent | `summitready-profile-mockup.html` | Raw `tent`; Camp or expedition context. |
| `SR-ICON-AXE` | Ice Axe | `summitready-profile-mockup.html` | Raw `axe`; Technical mountaineering context. |
| `SR-ICON-SHARE` | Share | `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html` | Raw `share`; Share mountain, route or profile. |
| `SR-ICON-CAMERA` | Camera | `summitready-track-journey-mockup.html`; `summitready-profile-mockup.html` | Raw `camera`; Capture or change profile media. |
| `SR-ICON-IMAGE` | Photo / Image | `summitready-profile-mockup.html` | Raw `image`; Image gallery or photo attachment. |
| `SR-ICON-FACEBOOK` | Facebook | `summitready-profile-mockup.html` | Raw `facebook`; External sharing target. |
| `SR-ICON-REDDIT` | Reddit | `summitready-profile-mockup.html` | Raw `reddit`; External sharing target. |
| `SR-ICON-DOWNLOAD` | Download / Offline | `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html` | Raw `download`; Download or offline availability. |
| `SR-ICON-LINK` | Link | `summitready-profile-mockup.html` | Raw `link`; Copy or open link. |
| `SR-ICON-CLOSE` | Close | `summitready-expeditions-library-mockup.html`; `summitready-profile-mockup.html` | Raw `close`; Close modal or sheet. |
| `SR-ICON-PIN` | Location / Pin | `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html` | Raw `pin`; Location, start point and GPS tracking context. |
| `SR-ICON-ROCK` | Rock / Terrain | `summitready-mountain-detail-mockup.html` | Raw `rock`; Rock and terrain fact. |
| `SR-ICON-DISTANCE` | Distance | `summitready-mountain-detail-mockup.html` | Raw `dist`; Route distance metric. |
| `SR-ICON-ASCENT` | Ascent | `summitready-mountain-detail-mockup.html` | Raw `asc`; Route ascent metric. |
| `SR-ICON-CUBE` | 3D / Cube | `summitready-mountain-detail-mockup.html` | Raw `cube`; Three-dimensional terrain tilt/view. |
| `SR-ICON-LAYERS` | Layers | `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html` | Raw `layers`; Map layer selection. |
| `SR-ICON-NAVIGATION` | Navigation / Recenter | `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html` | Raw `nav`; Map recenter and current-speed/navigation context. |
| `SR-ICON-PARKING` | Parking | `summitready-mountain-detail-mockup.html` | Raw `parking`; Parking availability fact. |
| `SR-ICON-GRID` | Grid Reference | `summitready-mountain-detail-mockup.html` | Raw `grid`; Ordnance Survey grid-reference fact. |
| `SR-ICON-COFFEE` | Facilities / Coffee | `summitready-mountain-detail-mockup.html` | Raw `coffee`; Nearby facilities fact. |
| `SR-ICON-SHIELD` | Verified / Shield | `summitready-mountain-detail-mockup.html` | Raw `shield`; Verified or unverified route status. |
| `SR-ICON-DOTS` | More / Overflow | `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html` | Raw `dots`; Overflow and more-actions menu. |
| `SR-ICON-BACK` | Back Arrow | `summitready-expeditions-library-mockup.html`; `summitready-profile-mockup.html` | Raw `back`; Back navigation with arrow geometry distinct from chevron-only disclosure. |
| `SR-ICON-TARGET` | Target | `summitready-profile-mockup.html` | Raw `target`; Goal or target metric. |
| `SR-ICON-PLUS` | Plus | `summitready-expeditions-library-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html`; `summitready-mockup-kit.html` | Raw `plus`; Add or choose an item without a circle container. |
| `SR-ICON-BARS` | Bars / Difficulty Chart | `summitready-explore-mockup.html`; `summitready-training-basecamp-mockup.html`; `summitready-training-plan-mockup.html`; `summitready-readiness-mockup.html`; `summitready-expedition-basecamp-mockup.html`; `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html`; `summitready-profile-mockup.html`; `summitready-mockup-kit.html` | Raw `bars`; Chart/training metric and route-difficulty indicator using the evidenced shared three-bar geometry. |
| `SR-ICON-BOOKMARK` | Bookmark | `summitready-track-journey-mockup.html` | Raw `bookmark`; Save or bookmark a selected route. |
| `SR-ICON-CHEVRON-DOWN` | Chevron Down | `summitready-track-journey-mockup.html`; `summitready-mountain-detail-mockup.html` | Raw `chevD`; Expand or collapse downward disclosure. |
| `SR-ICON-CROSSHAIR` | GPS / Follow Crosshair | `summitready-track-journey-mockup.html` | Raw `crosshair`; Follow or recenter on the current GPS position. |
| `SR-ICON-ARROW-DOWN` | Arrow Down | `summitready-expeditions-library-mockup.html` | Raw `down`; Move an item down in expedition ordering. |
| `SR-ICON-GAUGE` | Gauge | `summitready-track-journey-mockup.html` | Raw `gauge`; Live tracking gauge or performance indicator. |
| `SR-ICON-GRIP` | Reorder Grip | `summitready-expeditions-library-mockup.html` | Raw `grip`; Drag handle for expedition ordering. |
| `SR-ICON-INSTAGRAM` | Instagram | `summitready-profile-mockup.html` | Raw `instagram`; Instagram share destination. |
| `SR-ICON-PAUSE` | Pause Recording | `summitready-track-journey-mockup.html` | Raw `pause`; Pause an active tracked recording. |
| `SR-ICON-PENCIL` | Edit / Pencil | `summitready-track-journey-mockup.html` | Raw `pencil`; Edit tracked activity details. |
| `SR-ICON-SATELLITE` | Satellite | `summitready-track-journey-mockup.html` | Raw `sat`; Satellite/GPS status. |
| `SR-ICON-STOP` | Stop / Finish Recording | `summitready-track-journey-mockup.html` | Raw `stop`; Stop and finish an active tracked recording. |
| `SR-ICON-TRASH` | Trash / Delete | `summitready-expeditions-library-mockup.html` | Raw `trash`; Delete an expedition or ordered item. |
| `SR-ICON-ARROW-UP` | Arrow Up | `summitready-expeditions-library-mockup.html` | Raw `up`; Move an item up in expedition ordering. |
| `SR-ICON-WIFI` | Wi-Fi / Connectivity | `summitready-track-journey-mockup.html` | Raw `wifi`; Connectivity or offline-route status. |
| `SR-ICON-CHEVRON-UP` | Chevron Up | `summitready-mountain-detail-mockup.html` | Raw `chevU`; Upward disclosure for expanded filters, Show less, and expanded profile controls. |

The ten audited prototype registries declare 87 raw source keys and map them exhaustively to 86 canonical vector definitions. The sole intentional semantic alias is `warn`, which resolves to `SR-ICON-ALERT` alongside `alert`. Every other raw key remains distinct, including Mountain Detail `chevU` as `SR-ICON-CHEVRON-UP` and Expeditions Library reorder `up` as `SR-ICON-ARROW-UP`. The machine-readable `icon_source_key_map` records every declaration-file association.

## SummitReady signature symbols — 10

All eight new branded symbols are manual-only DRAFT vector masters with
transparent backgrounds, 1:1 composition, 20–32 px recognition, and a 96 px
presentation form. Each record in the JSON contains the supplied family prompt
plus its exact concept direction and negative prompt.

| Asset key | Display name | Exact screens | State |
|---|---|---|---|
| `SR-SYM-ELEVATION-BANK-001` | Elevation Bank | Profile | DRAFT; do not use coin/bank imagery |
| `SR-SYM-READINESS-001` | Readiness | Readiness; Expedition Basecamp | DRAFT |
| `SR-SYM-MOUNTAIN-DNA-001` | Mountain DNA | Profile; Mountain Detail | DRAFT |
| `SR-SYM-EXPEDITION-001` | Expedition | Expedition Basecamp; Expeditions Library; Profile | DRAFT |
| `SR-SYM-SUMMIT-001` | Summit | Expedition Basecamp; Track Journey; Profile | DRAFT |
| `SR-SYM-ROUTE-001` | Route | Explore; Track Journey; Mountain Detail | DRAFT |
| `SR-SYM-VERIFIED-ROUTE-001` | Verified Route | Explore; Mountain Detail | DRAFT |
| `SR-SYM-OFFLINE-ROUTE-001` | Offline Route | Track Journey; Mountain Detail | DRAFT |
| `SR-SYM-MARK-PROTECTED-001` | SummitReady Mark | All | PROTECTED; existing geometry only |
| `SR-SYM-WORDMARK-PROTECTED-001` | SummitReady Wordmark | All | PROTECTED; existing geometry only |

The protected mark and wordmark are separate canonical assets. A logo lockup is
a layout composition, not a third generated binary.

## Rank system — 7

All ranks are manual-only DRAFT `VECTOR_MASTER` records. Exact names must not be
changed. The locked, earned, and featured states should be derived
programmatically from one approved master wherever possible.

| Asset key | Exact name | Concept | Screens |
|---|---|---|---|
| `SR-RANK-TRAILHEAD-001` | TRAILHEAD | First rising terrain / trail marker | Profile |
| `SR-RANK-HILLWALKER-001` | HILLWALKER | Established hill experience | Profile |
| `SR-RANK-SUMMITEER-001` | SUMMITEER | Recognisable summit achievement | Profile |
| `SR-RANK-MOUNTAINEER-001` | MOUNTAINEER | Steeper alpine capability | Profile |
| `SR-RANK-ALPINIST-001` | ALPINIST | Technical alpine sophistication | Profile |
| `SR-RANK-EXPEDITIONER-001` | EXPEDITIONER | Major multi-stage mountain journey | Profile |
| `SR-RANK-SUMMIT-ELITE-001` | SUMMIT ELITE | Restrained pinnacle prestige | Profile |

## Achievement family templates — 6

These records deliberately define families and milestone slots, not hundreds of
arbitrary badges. All are manual-only DRAFT vector masters with transparent
backgrounds. Challenge artwork must remain visually distinct from permanent
Rank.

| Asset key | Family | Initial variants / slots | Screens |
|---|---|---|---|
| `SR-ACH-ELEVATION` | Elevation | 1k, 5k, 10k, 25k, 50k, 100k metres | Profile |
| `SR-ACH-MOUNTAINS` | Mountains | 1, 5, 10, 25, 50, 100 completed | Profile |
| `SR-ACH-ACTIVITIES` | Activities | 1, 10, 25, 50, 100, 250 activities | Profile |
| `SR-ACH-EXPEDITIONS` | Expeditions | first, 3, 5, 10 | Profile; Expedition Basecamp |
| `SR-ACH-CHALLENGES` | Challenges | night, solo, winter, streak | Profile; Mockup Kit |
| `SR-ACH-SPECIAL` | Special | explicitly approved slots only | Profile |

## Editorial image requirements — 21

Every record is manual-only DRAFT and contains the supplied base photography
prompt plus family-specific direction. Generated imagery starts as DRAFT, must
be reviewed for provenance/geographic credibility, and cannot be documentary
evidence.

| Asset key | Requirement | Exact screens | Audited source/status |
|---|---|---|---|
| `SR-IMG-ONBOARDING-HERO` | Onboarding hero | Onboarding Pro (brief-only) | Missing; DRAFT |
| `SR-IMG-TRAINING-HERO` | Training hero | Training Basecamp; Training Plan | `mockup-assets/tb-hero.jpg`; reference only |
| `SR-IMG-EXPEDITION-HERO` | Expedition hero | Expedition Basecamp; Expeditions Library | `ex-intro`, `ex-mountain`, `el-hero` references |
| `SR-IMG-TRACK-HERO` | Track hero | Track Journey | Batch 01 direction; no approved local derivative |
| `SR-IMG-EXPLORE-HERO` | Explore hero | Explore; approved Canvas reconstruction | Remote Unsplash/local `hero.jpg`; provenance unresolved |
| `SR-IMG-PROFILE-COVER` | Profile cover | Profile | `mockup-assets/pf-cover.jpg`; reference only |
| `SR-IMG-PRO-TRAINING` | Pro training | Onboarding Pro (brief-only) | Missing; DRAFT |
| `SR-IMG-PRO-EXPEDITION` | Pro expedition | Onboarding Pro (brief-only) | Missing; DRAFT |
| `SR-IMG-PRO-ROUTE-TOOLS` | Pro route tools | Onboarding Pro (brief-only); Mountain Detail | `md-3d.jpg` reference; not route evidence |
| `SR-IMG-TRAINING-MISSION` | Training mission | Training Basecamp; Training Plan | `tb-mission.jpg`; provenance unresolved |
| `SR-IMG-TRAINING-BANNER` | Training/readiness banner | Training Basecamp; Readiness | `tb-banner.jpg`; provenance unresolved |
| `SR-IMG-TRAINING-SESSION-HIKE` | Long hike session | Training Basecamp; Training Plan | `tb-session-hike.jpg`; provenance unresolved |
| `SR-IMG-TRAINING-SESSION-STAIRS` | Stairs session | Training Basecamp; Training Plan | `tb-session-stairs.jpg`; provenance unresolved |
| `SR-IMG-TRAINING-SESSION-STRENGTH` | Strength session | Training Basecamp; Training Plan | Deduplicates `tb-session-strength`/`tp-strength` |
| `SR-IMG-READINESS-HERO` | Readiness hero | Readiness | `rd-hero.jpg`; provenance unresolved |
| `SR-IMG-READINESS-GOAL` | Readiness goal | Readiness | `rd-goal.jpg`; provenance unresolved |
| `SR-IMG-READINESS-ACTION` | Readiness action | Readiness | `rd-action.jpg`; provenance unresolved |
| `SR-READINESS-ACTIVITY-01` | Readiness activity 01 | Readiness | `mockup-assets/rd-act1.jpg`; REFERENCE_ONLY pending rights/provenance |
| `SR-READINESS-ACTIVITY-02` | Readiness activity 02 | Readiness | `mockup-assets/rd-act2.jpg`; REFERENCE_ONLY pending rights/provenance |
| `SR-READINESS-ACTIVITY-03` | Readiness activity 03 | Readiness | `mockup-assets/rd-act3.jpg`; REFERENCE_ONLY pending rights/provenance |
| `SR-IMG-TRAINING-HILLS` | Training hills reference | Training Plan | `mockup-assets/tp-hills.jpg`; REFERENCE_ONLY pending rights/provenance |

## Mountain image references — 19

These records are reference identities, not fixed generation orders. The
mountain-image resolver remains authoritative.

| Asset key | Exact screens | Prototype/current source note |
|---|---|---|
| `SR-MTN-MONT-BLANC-EXPLORE` | Explore; Canvas reconstruction | Remote Unsplash + local `mont-blanc.jpg` |
| `SR-MTN-KILIMANJARO-EXPLORE` | Explore; Canvas reconstruction | Remote Unsplash + local `kilimanjaro.jpg` |
| `SR-MTN-ANNAPURNA-EXPLORE` | Explore | Remote Unsplash reference |
| `SR-MTN-BEN-NEVIS-EXPLORE` | Explore; Canvas reconstruction | Remote reference + local `ben-nevis.jpg` |
| `SR-MTN-TRYFAN-EXPLORE` | Explore; Canvas reconstruction | Remote reference + local `tryfan.jpg` |
| `SR-MTN-SNOWDON-EXPLORE` | Explore; Canvas reconstruction | Remote reference + local `snowdon.jpg`; naming review required |
| `SR-MTN-MATTERHORN-EXPLORE` | Explore; Canvas reconstruction | Remote reference + reused local `matterhorn.jpg` |
| `SR-MTN-MONT-BLANC-LIBRARY` | Expeditions Library | `mockup-assets/el-montblanc.jpg` |
| `SR-MTN-EVEREST-LIBRARY` | Expeditions Library | `mockup-assets/el-everest.jpg` |
| `SR-MTN-KILIMANJARO-LIBRARY` | Expeditions Library | `mockup-assets/el-kilimanjaro.jpg` |
| `SR-MTN-ANNAPURNA-LIBRARY` | Expeditions Library | `mockup-assets/el-annapurna.jpg` |
| `SR-MTN-MATTERHORN-LIBRARY` | Expeditions Library | `mockup-assets/el-matterhorn.jpg` |
| `SR-MTN-DETAIL-HERO` | Mountain Detail | `mockup-assets/md-hero.jpg` |
| `SR-MTN-DETAIL-PREVIEW` | Mountain Detail | `mockup-assets/md-preview.jpg` |
| `SR-MTN-DETAIL-TERRAIN-PHOTO` | Mountain Detail | `mockup-assets/md-3d.jpg`; terrain role only |
| `SR-MTN-ROUTE-01` | Mountain Detail | `mockup-assets/md-r1.jpg`; distinct route reference |
| `SR-MTN-ROUTE-02` | Mountain Detail | `mockup-assets/md-r2.jpg`; distinct route reference |
| `SR-MTN-ROUTE-03` | Mountain Detail | `mockup-assets/md-r3.jpg`; distinct route reference |
| `SR-MTN-ROUTE-04` | Mountain Detail | `mockup-assets/md-r4.jpg`; distinct route reference |

## Expedition image references — 17

| Asset key | Exact screens | Source/status |
|---|---|---|
| `SR-EXP-INTRO-REFERENCE` | Expedition Basecamp | `ex-intro.jpg`; reference only |
| `SR-EXP-MOUNTAIN-REFERENCE` | Expedition Basecamp | `ex-mountain.jpg`; identity/provenance unresolved |
| `SR-EXP-STAGE-01` | Expedition Basecamp; Expeditions Library; Profile | `ex-s1.jpg`; store once |
| `SR-EXP-STAGE-02` | Expedition Basecamp; Expeditions Library; Profile | `ex-s2.jpg`; store once |
| `SR-EXP-STAGE-03` | Expedition Basecamp; Expeditions Library; Profile | `ex-s3.jpg`; store once |
| `SR-EXP-STAGE-04` | Expedition Basecamp; Expeditions Library; Profile | `ex-s4.jpg`; store once |
| `SR-EXP-STAGE-05` | Expedition Basecamp; Expeditions Library; Profile | `ex-s5.jpg`; store once |
| `SR-EXP-STAGE-06` | Expedition Basecamp; Expeditions Library; Profile | `ex-s6.jpg`; store once |
| `SR-EXP-STAGE-07` | Expedition Basecamp; Expeditions Library; Profile | `ex-s7.jpg`; store once |
| `SR-EXP-LIBRARY-HERO` | Expeditions Library | `el-hero.jpg`; reference only |
| `SR-EXP-CUSTOM-PLACEHOLDER` | Expeditions Library | `el-custom.jpg`; reference only |
| `SR-EXP-TRACK-READY` | Track Journey | `tr-ready.jpg`; below protected progress/cinematic |
| `SR-EXP-TRACK-COMPLETE` | Track Journey | `tr-complete.jpg`; below protected completion cinematic |
| `SR-TRACK-PHOTO-01` | Track Journey; Mountain Detail | `mockup-assets/tr-p1.jpg`; distinct journey reference |
| `SR-TRACK-PHOTO-02` | Track Journey; Mountain Detail | `mockup-assets/tr-p2.jpg`; distinct journey reference |
| `SR-TRACK-PHOTO-03` | Track Journey; Mountain Detail | `mockup-assets/tr-p3.jpg`; distinct journey reference |
| `SR-TRACK-PHOTO-04` | Track Journey; Mountain Detail | `mockup-assets/tr-p4.jpg`; distinct journey reference |

## Profile image references — 14

These are user-photo or prototype-fixture paths, not automatic generation
targets. Real user media requires consent and provenance.

| Asset key | Exact screens | Source/status |
|---|---|---|
| `SR-PROFILE-AVATAR-ACTIVITY` | Training Basecamp | `tb-avatar.jpg`; profile classification |
| `SR-PROFILE-AVATAR-DEFAULT` | Profile | `pf-avatar.jpg`; prototype fixture |
| `SR-PROFILE-COVER-REFERENCE` | Profile | `pf-cover.jpg`; prototype fixture |
| `SR-PROFILE-GALLERY-01` | Profile | `pf-p1.jpg`; user-media fixture |
| `SR-PROFILE-GALLERY-02` | Profile | `pf-p2.jpg`; user-media fixture |
| `SR-PROFILE-GALLERY-03` | Profile | `pf-p3.jpg`; user-media fixture |
| `SR-PROFILE-GALLERY-04` | Profile | `pf-p4.jpg`; user-media fixture |
| `SR-PROFILE-GALLERY-05` | Profile | `pf-p5.jpg`; user-media fixture |
| `SR-PROFILE-GALLERY-06` | Profile | `pf-p6.jpg`; user-media fixture |
| `SR-PROFILE-GALLERY-07` | Profile | `pf-p7.jpg`; user-media fixture |
| `SR-PROFILE-SHARE-BACKGROUND` | Profile | `pf-share.jpg`; text remains runtime overlay |
| `SR-PROFILE-MOUNTAIN-01` | Profile | `mockup-assets/pf-m1.jpg`; distinct mountain reference |
| `SR-PROFILE-MOUNTAIN-02` | Profile | `mockup-assets/pf-m2.jpg`; distinct mountain reference |
| `SR-PROFILE-MOUNTAIN-03` | Profile | `mockup-assets/pf-m3.jpg`; distinct mountain reference |

## Map and route visuals — 4

| Asset key | Exact screens | Source/status |
|---|---|---|
| `SR-MAP-TRACK-MAP-REFERENCE` | Track Journey | `tr-map.jpg`; illustrative raster, not map data |
| `SR-MAP-TRACK-ROUTE-REFERENCE` | Track Journey | `tr-route.jpg`; illustrative raster, not GPX/GeoJSON |
| `SR-MAP-MOUNTAIN-TERRAIN-REFERENCE` | Mountain Detail | `md-3d.jpg`; terrain reference, not navigation evidence |
| `SR-MAP-ROUTE-SVG-ENGINE` | Track Journey; Mountain Detail; Profile; Mockup Kit | Runtime vector concept requiring verified route/elevation data |

## Existing reusable and protected assets — 11

| Asset key | Protected/reusable item | Exact production location or usage | Policy |
|---|---|---|---|
| `SR-PROT-MOUNTAIN-PROGRESS` | Progress Mountain | `components/MountainProgress.tsx`; `assets/images/mountain-bg.png` | PROTECTED |
| `SR-PROT-EXPEDITION-MOUNTAIN-PROGRESS` | ExpeditionMountainProgress | `components/ExpeditionMountainProgress.tsx` | PROTECTED |
| `SR-PROT-COMPLETION-CINEMATIC` | Summit cinematic/transition | `CompletionCinematic.tsx`; `completion.mp4`; `expeditionSummitTransition.ts` | PROTECTED |
| `SR-PROT-FLAGSHIP-BATCH-01` | Flagship Batch 01 | `api-server/src/services/artwork/batch01.ts`; approved resolver/manifests | PROTECTED |
| `SR-PROT-ARTWORK-ADMIN-RECORDS` | Existing Artwork Admin records | `artifacts/artwork-admin`; artwork API/service/manifests | PROTECTED |
| `SR-PROT-MOUNTAIN-IMAGE-RESOLVER` | Mountain-image resolver | `api-server/src/routes/mountain-image.ts`; production mountain surfaces | PROTECTED |
| `SR-EXIST-TRAINING-BASECAMP-HERO` | Bundled Basecamp hero | `assets/images/hero-base-camp.png` | AUDITED; approved resolver wins |
| `SR-EXIST-EXERCISE-ILLUSTRATION-FAMILY` | Six exercise illustrations | `assets/images/exercise-*.png`; session/exercise UI | AUDITED |
| `SR-EXIST-SUMMIT-GUIDE-VIDEO` | Summit Guide video | `assets/summit-guide/guide.mp4` | AUDITED |
| `SR-EXIST-BRANDING-STORE-FAMILY` | Logo/icon/mascot/store family | `artifacts/summit-ready/assets` | AUDITED; derivatives are not masters |
| `SR-EXIST-STORE-SCREENSHOTS` | Store screenshots | `assets/screenshots/*.png` | PROTECTED release evidence |

## Missing assets and provenance gaps

The **38** missing/DRAFT records are the eight new signature symbols, seven
ranks, six achievement families, and seventeen editorial image families. No
generation has been run.

Existing references also need non-destructive metadata completion:

- rights, source and approval evidence for prototype photographs;
- canonical mountain/media IDs and crop/focal-point metadata;
- approved versions/checksums for Object Storage derivatives;
- profile-photo consent and fallback policy;
- verified GPX/GeoJSON, map provider licence, terrain source and offline-tile
  policy for route visuals;
- vector source masters for the protected mark/wordmark;
- normalised SVG viewBox, stroke and naming rules for the icon registry.

The only genuinely unresolved, evidence-free icon expectations are a dedicated elevation/descent concept and unlock. They remain machine-readable `audit_gaps` and must not be invented from unrelated geometry. GPS/crosshair, edit/pencil, pause, finish/stop, and difficulty bars are now resolved by evidenced canonical records. Resume is explicitly a usage state of `SR-ICON-PLAY`, not separate geometry; this decision is recorded in `expected_icon_resolutions`.

The 15 newly enumerated raster paths (`md-r1`–`md-r4`, `tr-p1`–`tr-p4`,
`pf-m1`–`pf-m3`, `rd-act1`–`rd-act3`, and `tp-hills`) are not missing
binaries, but remain `REFERENCE_ONLY` until rights and provenance are
resolved. Distinct paths are not merged.

## Duplicate and inconsistency report — 10

1. The ten screen-local ICONS registries declare 87 raw keys that can drift. The exhaustive canonical map preserves 86 vector definitions and intentionally normalizes only `warn`/`alert`; `chevU` and reorder `up` remain distinct.
2. Track/footprints, Expeditions/mountain, Elevation Bank and Mountain DNA risk
   unrelated screen-by-screen symbols.
3. Explore uses remote Unsplash references while other surfaces use local JPGs
   for overlapping mountain concepts.
4. Matterhorn appears in multiple Explore placements; the Canvas reconstruction
   drops one card but reuses the same file elsewhere.
5. `ex-s1.jpg`–`ex-s7.jpg` are repeated by Expedition Basecamp, Expeditions
   Library and Profile.
6. Training and readiness rasters combine reusable families with distinct
   paths such as `tp-hills.jpg` and `rd-act1.jpg`–`rd-act3.jpg`; distinct paths
   remain separate until identity and rights are confirmed.
7. `tb-avatar.jpg` was mixed into editorial assets even though it represents a
   profile/user image.
8. `md-3d.jpg` is grouped with photography despite serving a terrain/route-tool
   role.
9. `hero-base-camp.png` coexists with protected approved artwork and the runtime
   mountain resolver without approval equivalence.
10. The Canvas Explore reconstruction substitutes Lucide/literal glyphs for
    custom UK, axes, route, bars, mark and status geometry and reduces featured
    cards/map pins. It remains reference-only.

The canonical resolution for all ten groups is recorded in the JSON catalogue.

## Implementation-ready component contracts

The future React Native implementation can resolve assets without embedding
arbitrary screen-local SVGs or images:

```tsx
<SRIcon name="search" size={24} />
<SRSignatureSymbol assetKey="SR-SYM-ELEVATION-BANK-001" size={32} />
<SRRankBadge assetKey="SR-RANK-HILLWALKER-001" state="earned" />
<SRAchievementBadge
  family="SR-ACH-ELEVATION"
  milestone="10000m"
  state="earned"
/>
<SRArtwork assetKey="SR-IMG-EXPLORE-HERO" placement="hero" />
```

### Resolver rules

- `SRIcon` resolves only the 86 non-generatable canonical vector concepts.
- `SRSignatureSymbol` resolves an approved branded-symbol version; mark and
  wordmark are immutable protected geometry.
- `SRRankBadge` accepts only the seven exact rank keys and derives
  locked/earned/featured states where possible.
- `SRAchievementBadge` requires an approved family and milestone slot.
- `SRArtwork` preserves source, version, placement and approval provenance.
- Mountain assets always use the protected resolver hierarchy.
- Map/route visuals require verified runtime data.
- No production refactor is authorised by this inventory.

## Artwork generator/catalogue readiness

This catalogue prepares the requested **UI ASSET SYSTEM** grouping:

- Signature Symbols
- Ranks
- Achievements
- Editorial Images

It does not create a second generator or modify production records. Standard UI
icons are present in the overall inventory but have
`generation_policy: not-generatable`. All 38 prompt records are
`generation_policy: manual-only` and `record_state: DRAFT`. Existing approved
artwork, review manifests, version history, admin-key protections, and batch
limits remain unchanged.

### Artwork Admin integration

- `/ui-assets` is the first-class, all-environment Artwork Admin route for this
  canonical read-only catalogue.
- The shared Artwork Admin navigation links Signatures, Mountain Heroes, UI
  Asset System, and the development-only existing-asset gallery.
- Every record exposes its provenance, selected-model state and generation
  history count. Prompt records additionally expose their resolved prompt,
  negative prompt, aspect ratio and transparent-background requirement.
- **Copy prompt** is a manual preparation action only. It does not call a
  generation API, approve an asset, publish an asset, or create history.
- Existing Signature and Mountain Hero generation/review behaviour is
  unchanged.

## Change and migration statement

- Current deliverable files changed: `docs/SUMMITREADY_MASTER_ASSET_INVENTORY.md`,
  `docs/summitready-master-asset-inventory.json`,
  `artifacts/artwork-admin/src/App.tsx`,
  `artifacts/artwork-admin/src/components/ArtworkAdminHeader.tsx`,
  `artifacts/artwork-admin/src/components/UiAssetSystemCatalogue.tsx`,
  `artifacts/artwork-admin/src/pages/ArtworkManager.tsx`,
  `artifacts/artwork-admin/src/pages/AssetGallery.tsx`,
  `artifacts/artwork-admin/src/pages/MountainQueue.tsx`, and
  `artifacts/artwork-admin/src/pages/UiAssetsPage.tsx`.
- Artwork generated or published: **none**.
- Production UI modified: **no**.
- Production data modified: **no**.
- Database/schema modified: **no**.
- Migration required: **no**.