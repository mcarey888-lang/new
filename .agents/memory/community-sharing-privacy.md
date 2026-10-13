---
name: Community sharing privacy
description: Product consent boundaries for community posts and user-shared routes.
---

Member sharing is an opt-in, per-post audience choice between Only me and all signed-in SummitReady members. Existing activity, journal photos, qualified Elevation Bank totals, and location are never published automatically. An owned photo post must remain private until its media upload finishes; changing a private post to members requires an explicit confirmation.

**Why:** The user asked for Facebook-like audience controls rather than an automatically public profile. Journal photos are device-local and may reveal people or private locations, while Elevation Bank credits have a separate evidence standard.

**How to apply:** Preserve private defaults on all new posting surfaces, isolate cached private posts and photo URLs by active account on shared devices, strip photo metadata before storing, and enforce member/owner checks on every media read.

Recorded-hike audiences are a separate policy: the first use requires an explicit Public / Followers / Only me choice, remembered for future recordings with a per-recording override. Public means signed-in members, not anonymous visitors. Followers must be backed by a genuine following relationship. Unknown legacy intent stays owner-private until reviewed.

**Why:** The repair package explicitly defines this model; a posting default is not permission to publish a hike, and historical uploads do not establish consent.

**How to apply:** Never retroactively apply a new default to existing records. Keep posts and photos separately opt-in, isolate unfinished drafts and recording state across account changes, and re-check access whenever a saved reference is opened.

Only the created route actually walked qualifies for an offer to share, not every planned route after one completion. A saved community route is a reference; following it requires a new GPS recording. Community recordings and proposed trails are unverified until an independent review approves them.

**Why:** The user chose completion of each route and an explicit share prompt, rather than automatic publication or crowd averages being treated as verified routes.

**How to apply:** Preserve original recorded geometry and keep moderation, personal planning, recording evidence, and canonical catalogue approval separate. Approving an app-owned trail suggestion is a reviewed candidate, never permission to insert or verify engine catalogue records.

Sample member stories are presentation-only examples, visibly labeled as fictional. Never seed them into the member API or mix sample achievements into personal progress; show them separately when the real feed is empty or unavailable, and do not let them conceal a feed error.

**Why:** The user wanted to see what a populated community could look like before real members post. Treating fictional members as live accounts would misrepresent social activity and blur the user's private achievement totals.

**How to apply:** Keep preview cards read-only and independent of authentication, reporting, photo uploads, award evidence, and real feed state. When real member posts are available, let them replace the preview.

When a successfully loaded member feed is empty, show the fictional preview without a separate “No member stories” empty panel above it. Label the examples prominently as fictional, and never show them in place of an API error.

**Why:** Placing an empty-state panel directly above fictional story cards made the feed appear to contradict itself.

**How to apply:** Keep the private “My posts” empty state separate; a failed member feed must display its error rather than example cards.

Users should retain their own saved routes and be able to share created routes so other users can search for and use them. Explicitly published community routes should appear immediately, without an approval queue.

**Why:** The user requested an AllTrails-like shared route library and selected immediate publication.

**How to apply:** Keep private saved plans separate from public community copies. Publishing a custom planned route requires its explicit sharing action. Recorded hikes follow the separate first-use audience policy above: choosing Public permits future recordings to be discoverable after sync without an extra Publish action. Legacy hikes and photos do not inherit that consent.

Only the specific route actually completed is eligible for community sharing.
Ask the walker to share each eligible route; do not publish automatically or
unlock all their created routes after their first completed hike.

**Why:** The user explicitly chose “Only the route actually completed” and
“Ask the walker to share each route” when clarifying the completion requirement.

**How to apply:** Check route-specific completion before offering publication.
Declining leaves the route private. Publish immediately after explicit sharing
confirmation, without an approval queue. Keep unwalked plans and other saved
routes private.

Saved hikes should have a dedicated space in You, not only an entry inside Track
or the route planner.

**Why:** The user requested a clear personal home in You for saved hikes while
discussing how other members should discover shared routes.

**How to apply:** Make the user's saved library accessible from You. Do not
interpret this navigation requirement as permission to expose private saved
routes to other members.