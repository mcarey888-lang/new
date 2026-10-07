---
name: Mountain page extension scope
description: User constraints on extending the existing mountain planning page.
---

For mountain-page work, extend the existing SummitReady screen and systems, not a parallel product. Do not introduce a second recorder, route/navigation service or map stack merely to meet presentation requirements.

**Why:** The user explicitly said this is not a rebuild and required existing routes, safe parking and free tracking to remain useful when route building or offline maps are unavailable.

**How to apply:** Audit/reuse first. Treat unknown infrastructure as an explicit unavailable boundary, not fake progress or a download. Keep production updates separate; do not perform broad schema pushes, upgrade major native dependencies or delete existing/test activities as part of this work.

Explore should concentrate on finding mountains/routes and getting parking directions. Do not display repeated “unverified” or “not verified” warnings on its discovery or mountain-detail pages; use neutral overview/suggestion language without changing data trust or navigation eligibility.

**Why:** The user explicitly said these labels make the app appear incomplete and reduce confidence, and requested a simpler discovery and parking experience on 2026-10-07.

**How to apply:** Hide empty feature placeholders and unavailable actions, retain useful safety/access advice, and label researched parking as suggested rather than pretending it is a confirmed pin.