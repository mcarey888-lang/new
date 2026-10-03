---
name: Failed Orval generation cleanup
description: Invalid input can delete generated clients before validation finishes.
---

Orval may clean generated output directories before rejecting an invalid OpenAPI
document. Missing generated exports after a failed run do not prove a feature was
removed from the specification.

**Why:** An unquoted comma inside a YAML flow-map description became a stray
property; generation failed after deleting clients, producing misleading unrelated
mobile type errors.

**How to apply:** Correct and regenerate the specification before typechecking
consumers. Do not run consumer checks concurrently with regeneration. Separate
successful code generation from failures in the command's subsequent shared-library
typecheck, and inspect the generated diff for unrelated transport regressions.