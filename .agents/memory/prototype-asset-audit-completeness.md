---
name: Prototype asset audit completeness
description: How to prove icon-catalogue completeness when prototypes use dynamic icon registries.
---

For prototype asset audits, scanning rendered `data-icon` attributes is insufficient. Enumerate every key declared in each prototype icon registry, then map every file/key occurrence to one canonical asset or an explicit, documented alias.

**Why:** Dynamic template expressions hide active icon dependencies from simple selector scans. An audit appeared complete several times while omitting registry keys used only through conditional rendering.

**How to apply:** Validate the catalogue directly against the immutable prototype source ref. The check must fail for every missing or extra file/key mapping and must not contain hand-written exclusions.