---
name: Conditional HTTP checks
description: Node fetch request caching can invalidate an otherwise correct Express ETag check.
---

When checking ETag revalidation with Node fetch and an explicit If-None-Match header, set request Cache-Control to max-age=0, or use curl.

**Why:** Node fetch adds a request no-cache directive for explicit validators; Express then correctly returns a full 200 instead of 304. That produced a false failure against a working route-map revalidation response.

**How to apply:** Inspect the request semantics before changing server caching code when a Node check reports 200 but an ordinary conditional curl returns 304.
