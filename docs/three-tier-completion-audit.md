# Three-tier development completion audit

Date: 27 October 2026. Development only. No billing mutations, geographic
generation, database writes, publishing or build submission.

## Owner-selected starter: The Lake District Mont Blanc

The owner selected **The Lake District Mont Blanc**, `SIG054`, instead of
the three original shortlist candidates below. This supersedes the Fuji
recommendation, but is a content selection, **not technical route approval**.
The access-policy starter ID remains unset until the evidence checks pass.

Read-only development inspection confirmed:

| Stage | Existing expedition figures | Summit evidence |
|---|---|---|
| Fairfield Horseshoe | 18 km / 1,100 m | Fairfield, `cea28ba5-4a81-4762-add7-f36f85b8d071`, trusted DoBIH provenance |
| Scafell Pike via Corridor Route | 15 km / 1,000 m | Scafell Pike, `a4bf692f-2b58-463e-9960-a293e6c6a687`, trusted DoBIH provenance |

The two Hard stages correctly total **33 km / 2,100 m**; order, positive values
and two-day structure pass. Artwork is approved. Summit links are absent, and
there are no verified route identity+definition+facts records for either peak.
Both saved route drafts are withdrawn hiking-engine constructions, not
publishable evidence; no map approval or accepted technical validation exists
on those revisions.

Focused published-reference checks on 27 October 2026:

- [Visit Lake District: Fairfield Horseshoe](https://www.visitlakedistrict.com/things-to-do/fairfield-horseshoe-p1221161)
  describes an Ambleside circuit, 17.25 km and 1,090 m ascent.
- [WalkLakes: Fairfield Horseshoe](https://www.walklakes.co.uk/walk_42.html)
  describes a 16.4 km / 1,080 m variant. Its text/photos are copyrighted and its
  GPX is offered for purchase; no commercial-app reuse grant was established.
- [Walking Britain: Corridor Route from Seathwaite](https://www.walkingbritain.co.uk/walk-1114-gps)
  lists 15.4 km / 970 m and explicitly restricts its GPX to private use.
  No restricted GPX was downloaded or copied.

These references corroborate the named walking itineraries and the broad
scale of the stored planning estimates. They do not prove the exact existing
variant, route measurement, legal access or reusable navigation geometry.
Do not silently replace the existing 18/15 km targets with a different
publisher's variant or sum different variants into a supposedly verified total.

Remaining work is matching source/variant evidence, source reuse permission
where geometry will be embedded, and access/elevation checks, followed by the
full free start/stage/completion/replay journey. No replacement track was
generated, published or approved. The wider route-database project stays paused.

## Completion summary

### Implemented and tested

- Explore can save, retain, recover and sync ordinary recorded hikes without a
  paid membership. There is no membership check in the ordinary recorder/save
  pipeline or its private-backup API. Account ownership checks still apply.
- Expeditions grants expedition access, not personalised training/readiness.
  Pro grants both. Legacy `premium` remains full Pro.
- Training gates prevent the personalised child screens mounting; backend
  coaching, plan adjustment and training assessment routes independently check
  membership. No client `tier`/`free` flag grants access.
- Expiry changes paid permissions, not stored history or recording state.
  Added tests exercise the actual private-backup/outbox utilities after expiry
  for Explore, Expeditions, Pro and legacy. They preserve raw track data and
  existing saved-history keys. They do not simulate native GPS.
- Mobile cached evidence now has a fixed 24-hour maximum measured from
  **CustomerInfo.requestDate**, not from each SDK/cache read. Earlier entitlement
  expiry wins. Missing, malformed or implausibly future timestamps grant nothing.
  A failed retry does not renew this allowance. A fresh authoritative response
  can renew it; fresh revocation removes access.
- Account-scoped SDK query/listener results are checked against the currently
  identified account before updating membership state.
- Backend definitions reject incomplete paginated results. Successful fresh
  revocation replaces cached paid access; network failure can retain only
  previously verified, unexpired access.

### Implemented but not yet tested on native devices

Localized package selection, store-confirmed prices, eligible Pro trial display,
purchase/restore result handling, account changes, paid screen gating, receipt
expiry/grace handling, and the prepared replacement path.

Ordinary recording recovery and progress have automated coverage, but actual
GPS recording through a store expiry, app suspension and reconnect still needs
iOS/Android device testing. No browser test can establish native billing success.

### Blocked by external configuration

New products, entitlements and offerings do not yet exist. New-tier prices,
eligible trial and direct Expeditions-to-Pro replacement cannot be declared
working. Native replacement stays disabled. Separate Clerk production alignment
must be resolved before release; no auth configuration changed in this work.

### Remaining code/content work

Choose and verify a starter before setting its central identity. Its complete
start/stage/finish/celebration/replay UI journey remains untested. Do not substitute
an arbitrary free expedition or silently use withdrawn geometry.

The proposed coaching allowance is still a proposal, not an enforced monthly
ledger. Renewal/refund/expiration webhook analytics remain unimplemented.
Neither was silently enabled or changed for legacy subscribers.

## Starter: inspected evidence, not assumed geography

The live development audit found **60 expeditions and 120 stages**, all 60 with
approved artwork. The `approved`/`image_status` fields approve artwork; they are
not route verification. There are 36 review revisions; only four are retained
source-track candidates rather than withdrawn constructed itineraries.

Read-only reproducible audit:

```
NODE_ENV=development pnpm --filter @workspace/api-server exec tsx scripts/audit-starter-membership.ts
```

All three shortlisted expeditions have:

- Two correctly ordered stages, matching recommended days.
- Positive distance/ascent figures, with stored totals exactly matching stage
  sums. **This verifies arithmetic/structure, not measured route accuracy.**
- Active catalogue entries and approved artwork.
- Real summit records with coordinates and trusted DoBIH provenance, accepted by
  the existing trust policy even though importer-owned status is `imported`.
  Do not blanket-change those statuses to `verified`.
- No stage `catalogue_mountain` links yet. That is missing integration metadata,
  not proof the named mountain is wrong. No content rows were changed.
- No verified identity+definition+facts route records for the relevant summits.
  Existing route-review evidence must therefore be assessed separately.

### 1. Australian Summit Challenge — SIG047

Target inspiration: Mount Kosciuszko; actual stages are UK walks.

| Stage | Stored figures | Verified summit identity |
|---|---|---|
| Mam Tor and Great Ridge | 13 km / 550 m | Mam Tor, `8c5dd25e-8dc7-4b9f-b182-f24a7b8821e3`, 517 m |
| Whernside from Ribblehead | 13 km / 550 m | Whernside, `02a57334-867a-440c-9744-a3074da3f3b1`, 736.6 m |

Total: **26 km / 1,100 m**. Lowest stored ascent in the current collection.
Both stages are labelled Moderate; overall challenge is Hard. This is not
automatically an easy beginner outing.

Missing: both available map drafts were constructed from network waypoints and
are withdrawn. A matching published itinerary/track, exact start/finish/variant,
distance/ascent evidence and rights/access review are still needed for both.

- Geographic accuracy: route extent/variant and measured figures unconfirmed;
  not evidence the named walks or stored estimates are false.
- Progression: ordered definition and sums pass. Full completion/replay UI still
  needs exercising after designation.
- Metadata: summit links absent; imagery approved. Neither grants route approval.

### 2. Scottish Summit Challenge — SIG042

Target inspiration: Ben Nevis; both actual stages are in Yorkshire.

| Stage | Stored figures | Verified summit identity |
|---|---|---|
| Pen-y-ghent from Horton | 10 km / 500 m | `8e90bcd9-35a9-456c-aee5-1ceb9a9a67b7`, 694.1 m |
| Ingleborough via Clapham | 17 km / 700 m | `9bbcba26-82be-430a-9887-27f6112d5c0b`, 723.3 m |

Total: **27 km / 1,200 m**. Both stages Moderate; overall Hard.
The two walks are geographically more coherent than the other shortlists.

Missing: Pen-y-ghent's network draft and Ingleborough's hiking-engine draft are
withdrawn, not source tracks. Both need matching published evidence, exact route
variant/start/return, route facts and rights/access review.

- Geographic accuracy: summit identity verified; itinerary and figures not yet.
- Progression: structure/sums pass; native complete/replay journey unproven.
- Metadata: missing summit links, approved imagery. The inspiration title does
  not relocate the actual UK stages or verify them.

### 3. Fuji Sunrise Challenge — SIG031

Target inspiration: Mount Fuji; actual stages are in Wales and Yorkshire.

| Stage | Stored figures | Verified summit identity |
|---|---|---|
| Yr Wyddfa via Llanberis Path | 14.5 km / 975 m | Snowdon–Yr Wyddfa, `d2e4f6b3-d992-4ed4-9622-4ab05c6ef1dd`, 1,085 m |
| Whernside from Ribblehead | 13 km / 550 m | `02a57334-867a-440c-9744-a3074da3f3b1`, 736.6 m |

Total: **27.5 km / 1,525 m**. Both stages Moderate; overall Hard.

Existing Llanberis evidence is a saved **6.03 km** chain from OpenStreetMap
relation **4004181**, revision `osm-4004181-v5-source-1`, attributed ODbL-1.0.
Its provenance/source identity is established, but it is explicitly **source
geometry only**, not the complete 14.5 km expedition itinerary. It has no map
feedback, canonical binding, accepted validation or technical decision.
The separate generated Llanberis draft is withdrawn. Whernside also has only
a withdrawn network draft.

- Geographic accuracy: real peak and named path source verified. Full ascent,
  summit link, return, intended trailhead and the route figures remain unproven.
  Do not reverse/add joins to manufacture the missing itinerary.
- Progression: definition/arithmetic checks pass, not a completed native journey.
- Metadata: summit links absent; approved imagery; existing source attribution
  can be retained but does not establish current access or whole-route rights.

### Recommendation / verification boundary

**Fuji Sunrise has the smallest existing-evidence head start**, because one
stage already has a retained named-path source. This does not establish the
least total acquisition effort: its missing full itinerary and Whernside track
may still require substantial work. Australian Summit is the better low-ascent
candidate; Scottish Summit is the more geographically coherent alternative.

Completed verification here: catalogue identities/provenance, positive values,
ordered stage definitions, totals, approval meaning and retained-versus-withdrawn
source status. Missing route evidence is not reclassified as incorrect content.
No existing evidence supports final approval of either full stage pair.

Owner input needed: choose which existing candidate to finish verifying, and
thereby scope any focused published-source review to that starter. The wider
commercial **route database** remains paused. None is activated as the free
starter while those geographic/evidence checks remain unresolved.

## Exact billing configuration checklist

Read-only audit:

```
pnpm --filter @workspace/scripts exec tsx src/auditSubscriptionCatalogue.ts
```

### Already exists — preserve

RevenueCat project: `proj6b5c72b3`.

| App type, confirmed by listApps | RevenueCat app ID | Existing product identifiers |
|---|---|---|
| Apple App Store, “Summit Ready iOS” | `app678af997dc` | `summit_ready_premium_monthly`, `summit_ready_premium_annual` |
| Google Play, “Summit Ready Android” | `appddabe2ce2e` | `summit_ready_premium_monthly:monthly-base`, `summit_ready_premium_annual:annual-base` |
| RevenueCat Test Store | `appe6b0cd308e` | `summit_ready_premium_monthly`, `summit_ready_premium_annual` |

The actual app type matters: Test Store products advertise P1M/P1Y, but this
does not prove that the Apple products are ready. The Apple entries currently
return null duration/trial metadata; verify their state in App Store Connect.
No inspected product advertises a trial. Play currently reports P7D monthly
and P14D annual grace; keep until deliberately changed and tested.

All six products are confirmed attached to entitlement **`premium`**
(`entle03c11a958`). Application interpretation stays **full Pro**.

Current offering **`default`** (`ofrngd39372f8d2`) has:

- `$rc_monthly` (`pkge99b7e4dda0`): existing monthly product per app.
- `$rc_annual` (`pkgefaa943bb6a`): existing annual product per app.

Preserve these IDs, attachments and legacy price treatment. Do not attach new
Expeditions products to `premium`. Existing Apple subscription-group name/ID is
**not exposed by this audit**; do not invent it or create an incompatible group.

### Proposed exact identifiers — not created, availability not yet checked

New Apple products (four):

| Tier | Product ID | UK new-customer target | RevenueCat entitlement/offering/package |
|---|---|---|---|
| Expeditions monthly | `summit_ready_expeditions_monthly` | £4.99 / month | `expeditions` / `expeditions` / `$rc_monthly` |
| Expeditions annual | `summit_ready_expeditions_annual` | £34.99 / year | `expeditions` / `expeditions` / `$rc_annual` |
| Pro monthly | `summit_ready_pro_monthly` | £9.99 / month | `pro` / `pro` / `$rc_monthly` |
| Pro annual | `summit_ready_pro_annual` | £69.99 / year | `pro` / `pro` / `$rc_annual` |

Apple group: inspect and **reuse the actual existing legacy subscription group**
if compatible. Put Pro/new Pro and equivalent legacy service at the higher
service level (level 1), Expeditions at the lower level (level 2). Monthly/yearly
within one tier deliver the same service. Do not use a separate tier group that
permits overlapping subscriptions. If no legacy group exists, proposed display
name is **SummitReady Membership**; Apple assigns the group ID. Stop and resolve
incompatible legacy grouping rather than promising a lossless move.

Configure an eligible **2-week free introductory offer** on each new Pro product;
none on Expeditions. Eligibility is Apple's subscription-group policy, not an
app-created second trial. Preserve legacy products' purchased rights/prices.

New Google Play subscriptions (two) and base plans (four):

| Subscription ID | Base plan ID | RevenueCat imported product identifier | UK target |
|---|---|---|---|
| `summit_ready_expeditions` | `monthly-base` | `summit_ready_expeditions:monthly-base` | £4.99 / month |
| `summit_ready_expeditions` | `annual-base` | `summit_ready_expeditions:annual-base` | £34.99 / year |
| `summit_ready_pro` | `monthly-base` | `summit_ready_pro:monthly-base` | £9.99 / month |
| `summit_ready_pro` | `annual-base` | `summit_ready_pro:annual-base` | £69.99 / year |

Use auto-renewing P1M/P1Y base plans; UK availability initially. Proposed Pro
offer IDs are `pro-trial-14d` under each base plan (scoped by base plan).
Configure a P14D free phase with the intended new-customer eligibility rules.
No Expeditions trial. Play has **no Apple-style subscription group**; replacement
uses the previous subscription purchase/product through Billing/RevenueCat.
Set and test grace/account hold and recovery; their final durations are an
explicit store policy decision, not inferred from app copy.

RevenueCat:

1. Create entitlement lookup keys **`expeditions`** and **`pro`**; preserve `premium`.
2. Import the exact Apple products and Play base plans above into their
   confirmed apps. Attach Expeditions products only to `expeditions`, Pro to
   `pro`. Pro's application policy includes Expeditions without needing two
   entitlements attached to one purchase.
3. Create offering **`expeditions`** with `$rc_monthly`/`$rc_annual` assigned
   to the corresponding Expeditions products on each store.
4. Create offering **`pro`** with `$rc_monthly`/`$rc_annual` assigned to Pro
   products. Keep `default` and legacy packages intact. The app selects explicit
   offerings, not positions or whichever offering happens to be current.
5. Confirm the SDK public app keys and backend project agree with these actual
   app types. A test-store transaction is not an Apple/Google sandbox receipt.
   Native sandbox builds must use real store SDK keys, not the Test Store/Expo
   Go/web path or a development mode that forces that path.
6. Verify UK availability, taxes, localized prices and actual trial eligibility
   in the native purchase sheet. No hardcoded target price is used as a fallback.
7. Only after successful replacement QA, enable `nativeUpgradesVerified`.
   Until then direct cross-tier replacement stays disabled/store-managed.

These are **proposed new identifiers**, not claims of existing products. Apple
group ID and provider-generated RevenueCat IDs are obtained after creation.
Store reviews/agreements, product readiness and price-point acceptance must be
confirmed in their consoles. No live configuration was changed.

## Cached access policy — precise bounds

| Layer | Outage retention | Revocation / expiry |
|---|---|---|
| Mobile SDK evidence | At most 24h from CustomerInfo.requestDate, never reset by reading a cached receipt | Earlier per-entitlement expiry wins; receipt with no expiry still has the 24h cap. UI rechecks at 30s intervals; new SDK responses refresh through events and a 5-minute query interval while open. |
| Backend | In-memory owner cache, refresh attempted after 30s; failure retains at most 24h since last successful verification and no later than the earliest known active-entitlement end | Successful fresh denial replaces cache. Expired/missing proof fails closed for paid APIs, with retryable verification error when provider unavailable. |

The backend is conservative when multiple entitlements have different end dates:
its shared cached snapshot stops at the earliest end; a fresh verification
determines any remaining paid tier. It never extends another tier indefinitely.
Cache is process-local, not persisted; a restart may require online verification.
The mobile policy uses store response dates and normal device wall-clock time,
not a tamper-proof local entitlement ledger.

No layer deletes plans, achievements, activity history or checkpoints on expiry.
After the bounded offline allowance, **new paid features** require fresh proof;
an ongoing ordinary recording/save/recovery/sync still does not require payment.
Billing-recovery/grace authority comes from RevenueCat/store evidence, never
from an invented client grace period.

## Verification record

152 automated tests passed in this pass:

- 32 API policy/cache/middleware/binary-transport tests.
- 8 mobile expiry-backup/sync and paywall-auth-return tests.
- 72 existing GPS storage, elevation, recovery, ownership and sync regressions.
- 40 expedition manual-stage, order, contribution, progress, distance and return
  regressions.

Mobile and API TypeScript checks passed. The read-only source and billing audits
above ran successfully. No content, approvals, subscriber settings or progress
was changed. These checks do not prove native purchases or full starter replay.

### Native sandbox matrix still required — both stores

| Test | Required observation |
|---|---|
| Purchase each of four new packages | Actual localized total/period, correct entitlement; failure/cancel/pending grants nothing unverified |
| Eligible / ineligible Pro trial | 14 days only on actually eligible selected offer; correct renewal price; no repeat trial or Expeditions promise |
| Restore and reinstall | Correct owner and previous/legacy tier, no duplicated charge; cross-account receipt behaviour reviewed |
| Expeditions → Pro | Same-group StoreKit change / Play replacement, no overlapping paid subscriptions; correct effective entitlement |
| Cancel renewal | Paid access remains until actual end, history preserved |
| Expiry in foreground/background | New paid work gated, free discovery/history intact; active GPS recording/save still works |
| Outage across cache deadline | Valid existing access retained only within evidence bounds; expired paid permissions not perpetuated |
| Grace, hold and billing recovery | Honour actual store/RevenueCat access, recover without duplicate purchase or data loss |
| Legacy monthly/yearly | Restore and retain all purchased Pro features and agreed legacy price treatment |
| Account switch | No old owner's entitlement, plan data or private recording leaks |
| Starter after verified designation | All stages, 100% completion/celebration, continued history and replay without subscription |

Nothing has been published or submitted. Later release requires a matching
backend deployment and new native build, with explicit owner approval.
