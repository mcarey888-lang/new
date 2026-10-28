---
name: Expedition authoring policy
description: Owner's external-AI expedition authoring workflow and trust constraints.
---

The owner wants to create expedition content in Claude and ChatGPT and bulk
import it into the existing SummitReady expedition library, not replace the
library or rebuild users' saved expeditions.

The owner also wants app-like expedition generation in the admin panel, using
the **same creation engine as custom expeditions**, rather than needing JSON
for every new catalogue addition. Keep both authoring paths.

**Why:** The owner requested an easier way to add new expeditions using the
creation workflow already available in the app.

**How to apply:** Reuse the engine rather than maintaining a divergent admin
matcher. Results are editable drafts; saving, owner review and artwork approval
remain deliberate separate actions. This does not resume paid route acquisition
or turn generated estimates into verified route facts.

Admin authoring must also support choosing the local mountains manually and
seeing how closely the selection matches the target, not only automatic creation.

**Why:** The owner specifically asked for the same mountain-choice and live
target-match workflow they use in the mobile app.

**How to apply:** Preserve the app's identity, one-route-per-summit and match-score
semantics. Compare route ascent and distance, not summit altitude; selection
changes should not trigger paid generation automatically. Keep target-match
feedback available while editing stage figures as well as during initial selection.

Expedition authoring should allow the owner to deliberately reuse approved
artwork from the Signatures library, rather than requiring a fresh generation.

**Why:** The owner explicitly requested assigning existing Signatures artwork
to the expeditions they create.

**How to apply:** Keep reuse an explicit owner choice, with image previews and
the source artwork's identity retained. Do not silently substitute another
expedition's artwork, regenerate it, or activate a draft just to assign an image.
The actual choice belongs in the expedition editor, not only in the artwork
generation page.

Reusing artwork should preserve a reviewed snapshot rather than a live link to
another expedition's mutable artwork.

**Why:** Regenerating or clearing the source must not silently change an image
already chosen for a different expedition.

**How to apply:** Keep approved source identity/version lineage and preserve the
destination's independent approval and availability controls.

**Why:** The older curated library was imported separately from the summit
catalogue; the owner requested reusable database-backed additions and bulk imports.

**How to apply:** Keep the downloadable template and AI prompt aligned with the
accepted import contract. Preview errors before saving, use create-only draft
imports, and require deliberate owner review before making content available.
Catalogue summit selection establishes identity/location only; route ascent,
walking distance, access and hazards need their own evidence. Do not silently
rewrite started expeditions, user activity or approved artwork.

Active expeditions must be discoverable independently of Featured status.
Region-less expeditions belong in All Regions; never infer a walking region
from the expedition title or target mountain.

**Why:** The owner expects activating an admin-authored expedition to make it
available in the app. Editorial promotion and regional filters must not become
undocumented publication requirements.

**How to apply:** Preserve tier/access checks separately from catalogue discovery.
Use explicit walking-region metadata for filtering, retain an All Regions path,
and do not use a static prototype bundle count as the live catalogue total.

When a stage has a linked catalogue summit, show that summit's name instead of
a generic terrain-estimate label.

**Why:** The owner wants terrain-estimated expedition stages identified by their
actual selected summits, not by a synthetic route label.

**How to apply:** Prefer the exact linked `catalogueMountain.name` in stage
presentation and saved `summitName` in already-started local expeditions. Retain
route estimates, stable completion keys and provenance; do not infer a summit
from the challenge title when no catalogue identity is linked.

Prioritize a small, reviewed UK route collection covering the existing
expedition stages before acquiring a large generic route catalogue.

**Why:** The owner agreed to keep the current expeditions and improve their data,
while keeping provider costs low. A summit record alone does not establish a
named walking route or its geometry.

**How to apply:** Audit existing route coverage first, then stage source-specific
candidates with explicit commercial reuse rights. Public availability of GPX/KMZ
downloads is not permission to redistribute them in SummitReady. In particular,
personal-use downloads need separate permission; keep ODbL attribution and
applicable share-alike obligations explicit for OSM-derived route data. A failed
source request is unavailable evidence, never proof that a route does not exist.

For existing expeditions whose named routes are not yet supported by verified
route data, prefer reviewed stages anchored to actual catalogue summits rather
than presenting the route name as if a navigable route exists.

**Why:** The owner wants legacy expeditions reconciled to the summit database
before route data is available. Legacy challenge names and walking estimates
alone are not evidence of a summit location, route geometry or starting point.

**How to apply:** Bind only reviewed, unambiguous summit identities; a
multi-summit circuit needs explicit review rather than a single guessed summit.
Keep historical stage completion identities and saved progress intact, and
keep unverified route facts clearly separate from verified summit details.

New externally curated summit-stage proposals primarily match the target's
cumulative ascent, using as few sensible distinct stages as possible and
prioritising larger local mountains/hills. Distance means the one-way summit
approach, including pre-summit undulations but excluding post-summit return.

**Why:** The owner clarified that these are approximate fun challenges: exact
uphill segmentation is not a prerequisite. Summit altitude is not climb gain;
legacy full-route distance is not one-way approach distance.

**How to apply:** Use the owner-approved approximate figures and identified
approach/start without restarting research. Half the distance of a same-route
out-and-back is acceptable; never halve ascent or circular walks. Keep missing
exact-uphill and full-outing figures null, not zero. Label Approx. ascent and
Approach distance, explain additional return walking, and separate local,
international-reference and actual activity totals. Never force approach
figures into full-route fields or rewrite saved plans, manual totals or GPS.

Keep genuinely unsupported international comparisons as explicitly named
pending sources with their precise evidence gap; never count them as startable
challenges or replace missing figures with zero.

**Why:** The owner explicitly accepts pending exceptions while asking that all
other supported challenges be finished. This is not permission to block on
strict uphill-only segmentation or to treat summit height as climb ascent.

**How to apply:** Report available challenge counts separately from source
coverage, aliases and exclusions. Retain source/artwork identities and legacy
detail access. The owner made one explicit region-inference exception for
"The Lake District Mont Blanc 2"; it does not relax the general rule against
guessing walking regions from titles. Account for its artwork association
without an indistinguishable second collection card.
