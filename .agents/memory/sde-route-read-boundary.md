---
name: SDE route read boundary
description: Durable trust and activation rules for canonical route intelligence reads and geometry disclosure.
---

Canonical mountain and route intelligence must be read server-side from the independently managed Summit Data Engine through `ENGINE_DATABASE_URL` only. The connection is bounded and read-only, and it must never fall back to the application `DATABASE_URL`.

**Why:** Treating the application database as an undocumented SDE replica creates an unsupported publication boundary. Falling back to another database can also promote stale or unrelated rows to canonical trust.

**How to apply:** Keep canonical route endpoints production-off by default. Missing or unreachable engine configuration returns explicit unavailable/degraded results. Do not connect mobile clients directly to the engine.

Canonical geometry must remain unavailable unless every geometry member has exact reusable-rights evidence and a persisted validation is explicitly tied to that exact geometry/version. The current SDE validation model does not provide that exact version link, so identity, facts, trust, and provenance may be read while geometry/profile-dependent matching degrades.

**Why:** A reusable fact source or a historical route validation cannot safely authorize geometry assembled from separate source bundles.

**How to apply:** Never infer topology completion, member rights, or validation-version equivalence. Adding the missing publication/validation relationship is separate schema and production work requiring explicit approval.