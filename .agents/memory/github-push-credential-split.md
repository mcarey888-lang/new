---
name: GitHub push credential split
description: Shell Git authentication and the Replit GitHub connector can have different repository permissions.
---

The GitHub connector's OAuth grant and the credential used by shell `git push`
are separate paths. A connector can report repository `push` permission while
the configured HTTPS remote still rejects both the ambient credential and a
workspace token.

**Why:** A completed checkpoint could be committed locally but not pushed even
though the GitHub API connection was healthy and had full repository
permissions. The connector proxy does not expose its credential to Git smart
HTTP.

**How to apply:** When shell push returns 401/403, inspect the repository
permission through the existing connector before requesting reauthorization.
Do not rewrite the branch through the Git Data API or squash checkpoints merely
to bypass a Git transport credential problem; preserve the local commits and
report the push as blocked until the writable Git credential is repaired.