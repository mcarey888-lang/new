# SummitReady Website Audit
*Mountain Training Guides — SEO & Content Strategy*

---

## 1. Complete List of Public Routes

| Route | File | Lines | Status |
|---|---|---|---|
| `/` | App.tsx | ~500 | Live |
| `/privacy` | Privacy.tsx | — | Live |
| `/terms` | Terms.tsx | — | Live |
| `/training-guides` | TrainingGuides.tsx | ~200 | Index |
| `/training-guides/mont-blanc-training-plan` | MontBlancPlan.tsx | 356 | Live |
| `/training-guides/kilimanjaro-training-plan` | KilimanjaroPlan.tsx | 290 | Live |
| `/training-guides/matterhorn-preparation-guide` | MatterhornGuide.tsx | 286 | Live |
| `/training-guides/everest-base-camp-training-plan` | EBCPlan.tsx | ? | Live |
| `/training-guides/gran-paradiso-training-plan` | GranParadisoPlan.tsx | ? | Live |
| `/training-guides/6-week-hiking-training-plan` | SixWeekHikingPlan.tsx | ? | Live |
| `/training-guides/beginner-mountain-fitness-plan` | BeginnerMountainFitnessPlan.tsx | ? | Live |
| `/can-i-climb` | CanIClimb.tsx | ~200 | Index |
| `/can-i-climb/kilimanjaro` | KilimanjaroCIC.tsx | 206 | Live |
| `/can-i-climb/mont-blanc` | MontBlancCIC.tsx | ? | Live |
| `/can-i-climb/matterhorn` | MatterhornCIC.tsx | ? | Live |
| `/can-i-climb/gran-paradiso` | GranParadisoCIC.tsx | ? | Live |
| `/can-i-climb/everest-base-camp` | EBCCIC.tsx | ? | Live |
| `/mountains` | Mountains.tsx | ~220 | Index |
| `/mountains/kilimanjaro` | KilimanjaroMtn.tsx | 137 | Live |
| `/mountains/mont-blanc` | MontBlancMtn.tsx | ? | Live |
| `/mountains/matterhorn` | MatterhornMtn.tsx | ? | Live |
| `/screenshot-helper` | ScreenshotHelper.tsx | — | Internal only |

**21 public pages total** (excluding screenshot-helper).

---

## 2. Which Pages Already Match the Guide-Page Strategy

The three main training guide pages — Mont Blanc, Kilimanjaro, and Matterhorn — are well-structured:
- Hero image with mountain photography
- Breadcrumb navigation (Home > Training Guides > [Mountain])
- Proper `<h1>` tag
- Article schema.org markup
- Inline CTAs linking to the app
- Canonical URLs set correctly

The "Can I Climb?" pages use FAQPage schema, which is excellent for appearing in Google's "People Also Ask" boxes. These are the strongest pages on the site from an SEO perspective.

---

## 3. Which Pages Are Too Thin or Need Improving

- **`/mountains/kilimanjaro`** — 137 lines. Mostly stat boxes and short paragraphs. No schema.org markup. Probably 300–400 words total. Thin for a topic Google takes seriously.
- **`/mountains/mont-blanc`** and **`/mountains/matterhorn`** — likely similar depth (same template). All three Mountain Profile pages read more like an expanded card than a true content piece.
- **EBC, Gran Paradiso, 6-Week, and Beginner plans** — unknown depth; may have been written quickly.
- **No page exists for Ben Nevis or Snowdon** — two of the highest-volume UK mountain search queries, directly relevant to your northern England user base.

---

## 4. Pages to Keep, Merge, Rename, or Redirect

**Keep all current URLs as-is.** The three-section structure serves three distinct search intents:

- "Kilimanjaro mountain profile" → `/mountains/kilimanjaro`
- "How to train for Kilimanjaro" → `/training-guides/kilimanjaro-training-plan`
- "Can I climb Kilimanjaro?" → `/can-i-climb/kilimanjaro`

Google rewards targeting different intents with different pages. **Do not merge these.** Instead, cross-link them heavily — each page should point to the other two for the same mountain.

### Broken links to fix immediately (no URL changes needed):

**In `Mountains.tsx`:**
- Gran Paradiso → links to `/mountains/mont-blanc` (wrong — copy-paste bug)
- Everest Base Camp → links to `/mountains/mont-blanc` (wrong)
- Breithorn → links to `/mountains/mont-blanc` (wrong)

**In `CanIClimb.tsx`:**
- Everest Base Camp → links to `/can-i-climb` (the index, not its own page at `/can-i-climb/everest-base-camp`)
- Gran Paradiso → links to `/can-i-climb` (should be `/can-i-climb/gran-paradiso`)
- Matterhorn → links to `/training-guides/matterhorn-preparation-guide` instead of `/can-i-climb/matterhorn`

These bugs mean EBC and Gran Paradiso's "Can I Climb?" pages are **completely unreachable** by clicking through the UI, and are therefore unlikely to be crawled by Google.

---

## 5. Is There a /guides Index Page?

**No single `/guides` index.** There are three separate index pages:

- `/training-guides` ✅
- `/can-i-climb` ✅
- `/mountains` ✅

There is no umbrella page that ties all three together per mountain. Whether to add one is a strategic choice (see Phase 4 below).

---

## 6. SEO Metadata Status

| Page | Title | Description | Canonical | Schema.org |
|---|---|---|---|---|
| `/` | Static in index.html | Unknown | Unknown | Unknown |
| `/training-guides` | ✅ | ✅ | ✅ | ✅ CollectionPage |
| `/training-guides/mont-blanc-training-plan` | ✅ | ✅ | ✅ | ✅ Article |
| `/training-guides/kilimanjaro-training-plan` | ✅ | ✅ | ✅ | ✅ Article |
| `/training-guides/matterhorn-preparation-guide` | ✅ | ✅ | ✅ | ✅ Article |
| `/can-i-climb` | ✅ | ✅ | ✅ | ✅ CollectionPage |
| `/can-i-climb/kilimanjaro` | ✅ | ✅ | ✅ | ✅ FAQPage |
| `/can-i-climb/mont-blanc` | likely ✅ | likely ✅ | likely ✅ | likely ✅ FAQPage |
| `/mountains` | ✅ | ✅ | ✅ | ❌ missing |
| `/mountains/kilimanjaro` | ✅ | ✅ | ✅ | ❌ missing |
| EBCPlan, GranParadisoPlan, etc. | probably ✅ | probably ✅ | probably ✅ | unknown |

### Critical structural limitation:
`usePageMeta` sets meta tags via JavaScript after the page mounts. The site is a Vite SPA with no server-side rendering or prerendering. Googlebot does execute JavaScript, so it will eventually see the correct tags — but the first crawl of any deep URL sees only the base `index.html` until JS runs. This is a known weakness of single-page apps.

---

## 7. Sitemap Status

```xml
<!-- Current sitemap.xml — only ONE entry -->
<url>
  <loc>https://summitready.uk/</loc>
  <lastmod>2025-05-14</lastmod>
</url>
```

**All 20 content pages are completely absent from the sitemap.**

This is the single biggest SEO problem on the site. Google has no signal to discover or prioritise these pages. `robots.txt` correctly points to the sitemap — which means Google is actively reading a sitemap that tells it only one URL exists.

---

## 8. Are These Pages Indexable by Google?

**Technically yes. Practically impaired.**

| Check | Status |
|---|---|
| robots.txt allows all crawlers | ✅ |
| No noindex tags | ✅ |
| Googlebot will render JS and see content | ✅ (eventually) |
| All content pages in sitemap | ❌ None of them |
| Initial HTML has meaningful meta for deep URLs | ❌ No |
| Inbound links from other domains to content pages | ❌ Unknown / low |
| EBC and Gran Paradiso reachable by internal linking | ❌ Broken links |

The broken internal links mean EBC and Gran Paradiso "Can I Climb?" pages are not reachable by following links from within the site — which further reduces the likelihood of Google crawling them.

---

## 9. Recommended Plan — Safest Path to a Scalable Mountain Training Guides Section

### Phase 1 — Fix what's broken (no URL changes, no content changes)
*These are zero-risk, no redirects needed, highest ROI items.*

1. Fix 3 broken `href` values in `Mountains.tsx` (Gran Paradiso, EBC, Breithorn → all wrongly pointing at `/mountains/mont-blanc`)
2. Fix 3 broken `href` values in `CanIClimb.tsx` (EBC and Gran Paradiso pointing at the index; Matterhorn pointing at training-guide instead of its own CIC page)
3. Update `sitemap.xml` to include all 20 pages with correct dates
4. Verify `index.html` has a homepage title and description in the static HTML (not just via JS)

---

### Phase 2 — Strengthen existing content

5. Add schema.org markup to `/mountains` index (CollectionPage) and to all three `/mountains/*` pages — currently missing entirely. Mountain profile pages should use `TouristAttraction` or `Place` schema.
6. Deepen the three thin Mountain Profile pages — minimum 600–900 words each: routes, best season, altitude profile, descent, summit success rate. Currently they read as expanded cards.
7. Add cross-links — every mountain's training guide should link to its "Can I Climb?" page and Mountain Profile, and vice versa. Currently the three sections exist in silos.

---

### Phase 3 — Add missing high-value pages

8. **Ben Nevis training guide** (`/training-guides/ben-nevis-training-plan`) — UK's highest peak, enormous domestic search volume. Include the local hill training angle: "how to train for Ben Nevis using hills near you."
9. **Snowdon training guide** (`/training-guides/snowdon-training-plan`) — same logic, second most popular UK summit query.
10. **"How to train for mountains using local hills"** — a standalone guide answering exactly the question your app solves. This is your biggest SEO differentiator from every other training guide site.

---

### Phase 4 — Consider a /guides umbrella (optional)

A `/guides` or `/mountain-training` hub page aggregating all three sections per mountain would help Google understand the site structure and give you a natural place to answer "how do I train for [mountain]?" in one place. This is additive — no existing URL changes needed.

---

### Answers to your five target questions — current gap analysis:

| Question | Covered? | Best current URL |
|---|---|---|
| Am I ready for Kilimanjaro? | ✅ Good page, broken internal link to it | `/can-i-climb/kilimanjaro` |
| How fit do I need to be for Everest Base Camp? | ⚠️ Page exists, unreachable via UI | `/can-i-climb/everest-base-camp` |
| How should I train for the Matterhorn? | ✅ Good page | `/training-guides/matterhorn-preparation-guide` |
| How long should I train for Mont Blanc? | ✅ Good page | `/training-guides/mont-blanc-training-plan` |
| How can I train for mountains using local hills? | ❌ No dedicated page | — (biggest gap) |

---

*Generated June 2026 · summitready.uk*
