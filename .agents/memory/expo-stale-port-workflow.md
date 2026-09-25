---
name: Expo workflow port collisions
description: How to handle a stale Expo process occupying the managed preview port after a workflow restart
---

If the Expo workflow starts but prompts to use the next port, do not accept the alternate port. Check whether a previous workflow process group still owns the configured port. Stop only that stale process group, then restart the managed Expo workflow.

**Why:** The artifact preview routes to its assigned port. A surviving old Metro process can keep serving there while the current workflow waits at an interactive port prompt; a successful HTTP response alone does not mean the new workflow is running.

**How to apply:** On a port-conflict prompt, inspect the listener and its parent process tree, distinguish the stale group from the current workflow, and confirm the restarted workflow prints that web is waiting on its assigned port.