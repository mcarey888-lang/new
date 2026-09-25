---
name: Artwork admin API mismatch
description: How to interpret non-JSON admin status responses before a paid generation request.
---

Treat an HTML response from a JSON artwork-status endpoint as an API routing or frontend/backend version mismatch, not as an image-generation failure. Keep paid generation controls unavailable until current status can be read, and offer an explicit status retry with a useful explanation.

**Why:** An older API or redirect can return a valid webpage with HTTP 200; blindly parsing it throws a misleading syntax error and leaves the operator unable to tell whether a generation is already running or ready. Retrying generation in that state risks unnecessary paid work.

**How to apply:** Validate the response type before parsing JSON in admin controls, distinguish authorization errors from out-of-sync services, and verify the current API endpoint directly before diagnosing the image provider. When an artifact's Vite config expects runtime environment variables, supply them when running tests from another package's runner; otherwise startup fails before any test executes.