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

Use named component schemas for new request bodies when exporting both Orval
Zod validators and generated types from one barrel.

**Why:** Inline update/delete request bodies produced identically named exported
validators and types, causing duplicate-export errors even after generation
succeeded.

**How to apply:** Reference a distinctly named request schema rather than editing
generated export lists by hand. Regenerate, then check raw binary upload bodies.

Keep new path operations inline in the root spec unless external PathItem
references have been tested with the installed generator.

**Why:** Orval 8.5.3 rejected external path references through its `x-ext` bundling,
including URI-encoded parameter braces. Inlining the operations and named schemas
allowed generation to complete without changing generator dependencies.

**How to apply:** Prefer ordinary local component-schema refs in this workspace.
If a failed clean also confused Metro's watcher, restore all generated output
first, then restart Metro and request the entry URL actually emitted in its HTML;
guessing `/node_modules/expo-router/entry.bundle` uses the wrong pnpm entry path.