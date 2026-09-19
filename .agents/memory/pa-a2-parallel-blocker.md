---
name: PA-A2 parallel infrastructure blocker
description: How to treat the unresolved production Publish diff while continuing later development.
---

Treat the PA-A2 production migration issue as a parked, unresolved parallel infrastructure issue. Do not apply the incomplete Publish diff, alter the reviewed schema to accommodate the analyzer, or activate production database-dependent behavior. It does not block normal Stage 5 development once the owner supplies the Stage 5 runbook.

**Why:** Replit Publish omits required composite unique indexes from the generated production diff. The owner chose to wait for Replit support while continuing product development with production frozen at its current safe state.

**How to apply:** Preserve the blocker in handoff/status documentation, keep all production schema, flags, backfills, canonical-history consumers, adapters, and runtime activation unchanged, and treat older documents that make production migration a prerequisite for Stage 5 as superseded by this direction. Do not begin or redesign Stage 5 without the owner-provided master runbook.