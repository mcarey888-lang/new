---
name: Evidence authority ordering
description: Durable ordering rule for correction, revocation, retry, and restart-safe evidence projections.
---

Evidence evaluators and persisted ingestion must use the same locale-independent
total authority order. Producer revisions scoped to a rule version cannot serve
as global correction authority when rule versions may reset their counters;
use a globally ordered producer event authority and retain local revision only
as a deterministic secondary cursor.

**Why:** Separate evaluator and persistence comparisons produced arrival-order
and restart-dependent results, and a newer producer rule with a low local
revision could lose to an older rule's high revision.

**How to apply:** For any evidence projection, centralize one shared comparator,
make revocation precedence explicit at equal authority, and include reversed
arrival, restart, rule-reset, and locale-independent string-order tests.