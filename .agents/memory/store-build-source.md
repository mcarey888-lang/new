---
name: Store build source
description: Preserve the tested workspace snapshot when shared development branches have newer independent changes.
---

Store builds must use the exact tested workspace snapshot, not whichever commit is newest on a shared development branch. If that remote branch has independent changes, push a separate release ref rather than replacing it or silently adding untested changes to the release.

**Why:** Shared map development and Replit workspace development can advance separately. Building directly from the shared branch can omit local fixes or include code not covered by the release checks.

**How to apply:** Compare the workspace and remote revisions before cloud builds, preserve collaborators' branches, and verify the cloud build's reported commit matches the tested release snapshot.
