---
name: Community sharing privacy
description: Product consent boundaries for community posts and user-shared routes.
---

Member sharing is an opt-in, per-post audience choice between Only me and all signed-in SummitReady members. Existing activity, journal photos, qualified Elevation Bank totals, and location are never published automatically. An owned photo post must remain private until its media upload finishes; changing a private post to members requires an explicit confirmation.

**Why:** The user asked for Facebook-like audience controls rather than an automatically public profile. Journal photos are device-local and may reveal people or private locations, while Elevation Bank credits have a separate evidence standard.

**How to apply:** Preserve private defaults on all new posting surfaces, isolate cached private posts and photo URLs by active account on shared devices, strip photo metadata before storing, and enforce member/owner checks on every media read.

Sample member stories are presentation-only examples, visibly labeled as fictional. Never seed them into the member API or mix sample achievements into personal progress; show them separately when the real feed is empty or unavailable, and do not let them conceal a feed error.

**Why:** The user wanted to see what a populated community could look like before real members post. Treating fictional members as live accounts would misrepresent social activity and blur the user's private achievement totals.

**How to apply:** Keep preview cards read-only and independent of authentication, reporting, photo uploads, award evidence, and real feed state. When real member posts are available, let them replace the preview.

When a successfully loaded member feed is empty, show the fictional preview without a separate “No member stories” empty panel above it. Label the examples prominently as fictional, and never show them in place of an API error.

**Why:** Placing an empty-state panel directly above fictional story cards made the feed appear to contradict itself.

**How to apply:** Keep the private “My posts” empty state separate; a failed member feed must display its error rather than example cards.

Users should retain their own saved routes and be able to share created routes so other users can search for and use them. Explicitly published community routes should appear immediately, without an approval queue.

**Why:** The user requested an AllTrails-like shared route library and selected immediate publication.

**How to apply:** Keep private saved plans separate from public community copies. Publication must be an explicit route-sharing action, never an automatic consequence of recording a hike or saving a private plan. This choice does not relax the existing photo, activity or location-history privacy boundaries.

Saved hikes should have a dedicated space in You, not only an entry inside Track
or the route planner.

**Why:** The user requested a clear personal home in You for saved hikes while
discussing how other members should discover shared routes.

**How to apply:** Make the user's saved library accessible from You. Do not
interpret this navigation requirement as permission to expose private saved
routes to other members.