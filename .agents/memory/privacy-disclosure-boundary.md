---
name: Privacy disclosure and consent boundary
description: Avoid overstating anonymity, erasure guarantees or native SDK suppression in privacy work.
---

Privacy notices must distinguish app-owned events, SDK automatic collection and
provider-dashboard integrations. A random installation ID is pseudonymous, not
proof of anonymity; omitting email does not rule out advertising matching.
An Android-only JavaScript guard does not prove an included iOS native SDK is
silent. Policy changes do not create consent or complete an erasure workflow.

**Why:** Launch review found old blanket anonymity and deletion guarantees that
were not supported by the collection paths and cross-provider cleanup.

**How to apply:** Verify native/runtime behaviour before certifying no tracking.
Describe actual automated deletion scope, qualify residuals and confirm provider
retention operationally. Keep behavioural consent/SDK changes separate when the
owner authorises privacy-copy/declaration updates only.
