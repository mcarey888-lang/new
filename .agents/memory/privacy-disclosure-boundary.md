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

Core sign-in, purchases, recording and progress must remain usable when optional
measurement is declined. Erasure completion must distinguish app-account removal
from unresolved provider work and lawfully retained records.

**Why:** The owner explicitly required privacy controls without feature or
subscription regressions, and an accurate outcome rather than blanket erasure.

**How to apply:** Keep consent out of access gates; never mark a pending external
cleanup as complete merely because the authentication identity is gone.

Policy-only publications must visibly separate currently deployed processing
from prepared native/server improvements. A future-release paragraph is not
enough if another paragraph makes an unqualified current enforcement guarantee.

**Why:** A four-file website snapshot initially described consent rejection and
deletion outcomes that depend on a later server migration and native release.

**How to apply:** Label rollout status at the top and at each affected claim.
Qualify old SDK behaviour and provider erasure; update read-only wording checks
rather than restoring misleading blanket promises just to satisfy a test.
