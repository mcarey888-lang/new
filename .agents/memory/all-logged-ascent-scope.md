---
name: All-logged ascent scope
description: Keep completed-activity ascent distinct from evidence-qualified elevation credits.
---

The Elevation Bank credit figure and the sum of ascent from all completed activities have different meanings. Never relabel credits as "all logged"; display the scope of an all-logged total explicitly until complete cross-device activity sync exists.

**Why:** The credit ledger intentionally excludes some indoor and manual activity, while completed training sessions and hikes are partly stored in device-local history. Neither source alone proves a complete cross-device lifetime total. Combining them naively can count the same tracked hike twice.

**How to apply:** When showing a total, identify the records it covers. Prefer stable activity identity for deduplication, and keep the qualified credit ledger unchanged. Before claiming a cross-device lifetime total, synchronize and reconcile every activity type, edits, and deletions.