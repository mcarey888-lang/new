---
name: Git sequencer lock recovery
description: Check applied history after a cherry-pick fails before creating a commit.
---

After a cherry-pick fails on an index lock, verify the intended patches actually
exist in history before continuing the sequencer.

**Why:** A failed first pick left sequencer state despite a clean working tree;
continuing advanced to the next pick without applying the failed one.

**How to apply:** Wait for concurrent Git work to finish, inspect status and the
sequencer alongside commit history, then recover only the agent-owned unpublished
sequence. Do not delete an active lock or assume a clean tree means every pick ran.

Do not assume `--continue` can resume a conflicted multi-pick `--no-commit` sequence
with staged resolutions.

**Why:** Continuation refused staged changes as overwritten even though sequencer
options still recorded `no-commit = true`.

**How to apply:** Inspect history, remaining picks and staged changes before recovery.
Preserve the resolved work and apply only patches that have not yet landed; do not
abort and discard the resolved integration merely to clear sequencer state.