---
name: Production loopback QA
description: Owner-authorised production CORS exception for locally served QA web builds.
---

The owner deliberately approved allowing localhost/loopback browser origins to call the production API for QA.

**Why:** The team's intended QA process tests locally served web exports against the real production backend; default production CORS otherwise rejects those origins.

**How to apply:** Retain the narrow opt-in rather than broadening CORS universally or changing NODE_ENV. This permits browser access, not bypassing authentication or permission checks. Approval to configure this exception is not approval to publish, build a mobile app, or declare the wider production audit passed.

Do not treat a production-scoped project-variable read-back as proof that a published API received that value.

**Why:** The saved production flag read back as true, but after an owner publish the public preflight still returned `origin_not_allowed`. The project-variable view did not establish the running deployment's injected environment.

**How to apply:** Use the API service's explicit production runtime environment for this non-secret QA opt-in, and require a successful live localhost preflight after publishing before declaring it active. Preserve the distinction between saved configuration, local production-mode policy tests and the actual published response.
