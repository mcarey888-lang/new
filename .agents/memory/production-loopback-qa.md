---
name: Production loopback QA
description: Owner-authorised production CORS exception for locally served QA web builds.
---

The owner deliberately approved allowing localhost/loopback browser origins to call the production API for QA.

**Why:** The team's intended QA process tests locally served web exports against the real production backend; default production CORS otherwise rejects those origins.

**How to apply:** Retain the narrow opt-in rather than broadening CORS universally or changing NODE_ENV. This permits browser access, not bypassing authentication or permission checks. Approval to configure this exception is not approval to publish, build a mobile app, or declare the wider production audit passed.
