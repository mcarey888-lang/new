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