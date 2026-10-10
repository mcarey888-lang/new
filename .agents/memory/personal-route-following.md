---
name: Personal saved-route following
description: Product intent and safety boundaries for using custom route plans during live GPS recording.
---

Saved personal routes must be usable as recording targets, not only reopenable in the planner. The user confirmed saved-route access works and explicitly requested loading a saved route to start tracking/following it.

A saved route selected on Track must also appear as a map preview before Start,
not merely as a named card. Frame its saved geometry in the visible area above
the bottom sheet, and clear the preview when the selection is removed.

**Why:** The user selected a saved route and saw its distance and ascent in the
card but no route on the map. The pre-start preview is part of selecting a route,
not something that should require starting GPS recording.

**How to apply:** Preview planned geometry without creating GPS points,
recorded activities or expedition credits.

**Why:** Planner access alone does not meet the user's hiking workflow. Following a personal plan must remain distinct from completing a verified expedition stage.

**How to apply:** Preserve both planner review and follow actions. Use the planned geometry only as a navigation overlay; actual GPS remains the source of recorded distance, ascent and evidence. Never inherit an unrelated pending expedition or reuse a saved-plan ID as the activity ID. Keep a private owner-validated route snapshot with an interrupted hike so following can resume without downloading the plan again.

Shared recorder integrations must reconcile every route origin when changing
map-message protocols, including owner-private saved plans.

**Why:** The shared branch and workspace had different route-following
implementations. A merge retained the private-plan overlay with the obsolete
message vocabulary while updating the community and canonical overlays.

**How to apply:** Preserve the owner-scoped following hook and recovery snapshot.
Check personal, community and canonical overlay handoffs against the new map
protocol; never replace actual GPS with planned geometry to make a line appear.