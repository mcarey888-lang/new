---
name: Exact GitHub Git Data commits
description: How to preserve local Git object identity when shell push credentials fail but the GitHub integration can write Git objects.
---

When recreating a local commit through GitHub's Git Data API, pass the commit message exactly as stored in the commit object, including its final newline. Verify every uploaded blob SHA, generated tree SHA, and generated commit SHA before updating the branch ref. Update the ref with `force: false`. In the CodeExecution shell callback, `git ls-tree` output may arrive without its tab separator between the 40-character SHA and the filename; parse the SHA by fixed width rather than splitting on whitespace.

**Why:** Omitting the stored final newline produced a different commit SHA even though the tree, parent, author, committer, timestamp, and visible message were identical. Supplying the newline reproduced the local SHA exactly. Whitespace splitting on the shell callback's `ls-tree` output falsely reported a blob mismatch because the filename was appended to the SHA.

**How to apply:** Use this only when normal Git transport cannot push and an authorized GitHub integration is available. Upload objects without moving the ref, abort on any SHA mismatch, and move the ref only after the complete commit chain exactly matches local history.