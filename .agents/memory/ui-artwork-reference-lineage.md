---
name: UI artwork reference lineage
description: Durable safety rules for family-aware artwork references, reference caps, and review-object persistence.
---

Family-aware generation must identify every visual reference by immutable candidate ID, version, and stored object path. Asset keys alone are not reproducible because several approved versions can coexist.

**Why:** Resolving references by asset key can silently select the wrong approved version. Reusing version-derived object paths can also leave a later run blocked by objects orphaned during a partial upload or process failure.

**How to apply:** Keep family masters and curator references as exact candidate descriptors. For a three-image application cap, prioritize the master, then a required refinement source, then curator selections; reject required-reference overflow rather than silently dropping inputs, and use configured additions only as optional fill. Use unique run-scoped object paths, generation-based compare-and-swap writes, and the same renewable lock for all manifest mutations.