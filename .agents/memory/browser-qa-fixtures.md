---
name: Browser QA fixture installation
description: Managed preview fixtures must be verified in the actual loaded app frame before protected or paid flows.
---

Install in-page fetch fixtures in the actual loaded application frame after the
page settles. Verify both an explicit fixture marker and the replaced fetch
function before submitting protected or paid actions. Trigger the application's
refetch control without navigating after installation.

**Why:** Managed browser runs accepted initialization scripts without the fixture
appearing in the final application document. This produced false fixture failures
and unauthenticated reads, not evidence of broken application behavior.

**How to apply:** Select the frame by a known application control, evaluate the
fixture there, and assert it is installed. Block unexpected API requests and use
only fictional credentials. Reloads require installation and verification again
before refetching. A pre-fixture unauthenticated read can fail harmlessly, but
never submit an unstubbed mutation or paid request.

Seed the required fictional record state explicitly when resuming a follow-up
run rather than assuming browser fixture localStorage survived. A later run was
missing that fixture entry despite an earlier run reporting a successful mock
assignment; this alone is not evidence of an application persistence failure.
