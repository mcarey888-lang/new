---
name: Canonical GitHub branch
description: Owner's standing instruction for preventing divergence between workspace and map development.
---

Use `claude/route-map-server` in `mcarey888-lang/new` as the canonical branch for subsequent commits after reconciliation.

**Why:** The owner explicitly requested one source of truth after separate workspace and map branches diverged and made testing against current source difficult.

**How to apply:** Check the current branch before new work. Preserve both histories when reconciling branches, synthesize overlapping behaviour instead of selecting one side wholesale, and verify the remote push separately from publishing. Publishing still requires the owner's Replit Publish action.
