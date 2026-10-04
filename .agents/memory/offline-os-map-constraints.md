---
name: OS offline-map licence and scope
description: User-mandated licence margin, release proof and protected-system boundaries.
---

Keep the OS day-map window at 22 hours, never 24. Expired OS imagery must become
unavailable even offline; no permanent fallback may be claimed until one actually
exists. Do not alter the three supplied pure decision modules to make plumbing pass.
Start must never wait for map readiness.

**Why:** The user pays under a maximum 24-hour OS cache licence and explicitly
requires the two-hour safety margin for sleeping phones and clock drift.

**How to apply:** Treat foreground expiry and failed deletions as correctness
conditions, not best-effort cleanup. The user explicitly accepted advancing an
injected clock and observing deletion of actual temporary tile files as proof of
the expiry logic. Real-phone cache/download/drawing verification is still required
before enabling the release flag, especially iPhone Apple Maps cache reads.
JavaScript bundle export and filesystem unit tests are not phone drawing evidence.

This map-plumbing scope must not change Training/Readiness, AI Coach, Elevation
Bank, activity evidence/engine, sync, auth, billing, schema or the Summit Data Engine.

**Why:** The user expressly restricted the work to map plumbing and forbade migrations.

**How to apply:** Keep renderer integration separate from recording/evidence logic,
and report unavailable capabilities instead of widening the protected scope.

Leave the web recorder unchanged in this job; do not make its conversion a release
prerequisite for this native-map plumbing or claim its map is covered. The permanent
OSM fallback is separate work after native maps are proven.

**Why:** The user explicitly confirmed these scope boundaries in the follow-up.

**How to apply:** Report native views and web/embedded map coverage separately.