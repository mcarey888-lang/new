---
name: Canonical alias trust boundary
description: Why review-state catalogue aliases may resolve verified mountains without being presented as verified facts.
---

Use a catalogue alias only as an identity-resolution key, then independently require the matched mountain itself to be verified. Do not present the alias row as a verified fact.

**Why:** The international import marks aliases as needs-review even when their canonical mountain is verified. Filtering aliases to verified silently misses every imported alias and bypasses canonical safety through cache or AI.

**How to apply:** Match the importer-normalized alias key, re-check the canonical mountain's verified status before returning it, and keep review-state alias rows out of trusted-facts payloads.
