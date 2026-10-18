---
name: Publish source and routing verification
description: Distinguish a running old deployment from a completed update, and validate manifests rather than SPA fallback HTML.
---
Publish builds a workspace snapshot; it does not check out the canonical GitHub branch. Check that the intended source is already in the workspace, and compare any automatic Publish checkpoint with the intended commit.

**Why:** The previous deployment remained available while its replacement was building. A running-deployment status and successful older build were mistaken for evidence that the new version had finished promoting.

**How to apply:** Inspect the specific build's completion time and logs before interpreting live-source checks. Check API script content and hosted mobile manifests independently: one can be fresh while the other is routed incorrectly.

Build history can omit an in-flight release or expose it late. Absence of a newer entry does not prove that a Publish request was never accepted.

**Why:** A completed build later appeared with a creation time earlier than negative history checks made while it was building. The available status and history calls had continued to show the older successful deployment.

**How to apply:** Describe missing builds as “not visible in available history,” not “not triggered.” Establish acceptance separately from completion, and do not infer a build-skip heuristic or failed request from history absence alone.

A manifest check must require JSON content, a newer `createdAt`, the expected source fingerprint, and an accessible launch asset. HTTP 200 and a Last-Modified header alone are insufficient.

**Why:** The root marketing SPA returned HTML 200 at mobile manifest paths. Its HTML modification time was unrelated to the native bundle timestamp.

**How to apply:** Use the read-only publish verification command with the production URL and cutoff time. Its served-code checks do not establish browser interactions, account persistence or phone behaviour.
