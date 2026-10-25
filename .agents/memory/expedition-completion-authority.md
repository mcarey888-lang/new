---
name: Expedition completion authority
description: Durable rules for final-stage contribution, cinematic routing, and exactly-once Expedition completion.
---

Final-stage activity saves must return through Basecamp so the protected summit
transition and cinematic remain the only normal path to Expedition completion.
Completion requires both stable completed-stage identities and canonical 100%
simulated progress. Cinematic replay is visual only and never awards completion.

**Why:** Architectural review found that route-only completion and a direct jump
from tracking to the completion screen could bypass the summit experience or
award completion while canonical simulated progress was below 100%.

**How to apply:** Any future tracking, recovery, deep-link, replay, or completion
change must preserve the Basecamp handoff, use the shared Expedition presentation
state, and keep completion idempotent and scoped to the active expedition.

Every successful manual expedition-stage log must return directly to Basecamp
to show updated progress, not reveal the Training hill picker or interrupt with
optional challenge assignment. Ordinary Training hill logging remains available.

**Why:** The owner explicitly identified the post-save Log Hill screen as
redundant for expedition stages and requested the Basecamp progress handoff.

**How to apply:** Finish saving session evidence and expedition progress before
leaving the logging flow; failed saves must not trigger the return. Final-stage
logs still enter the existing Basecamp completion authority rather than awarding
completion themselves.

Users may inspect every stage and choose which unfinished stage to do next; the
generated stage sequence is not a mandatory walking order.

**Why:** The owner explicitly requested clickable stage information and control
over which stage they do first.

**How to apply:** Preserve stage identities, completed stages, activity evidence
and total targets when changing the order. Choosing a stage never completes it,
starts recording, or resets the expedition or the separate Training goal.