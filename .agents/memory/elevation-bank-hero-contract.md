---
name: Elevation Bank hero contract
description: Approved profile hero is a presentation-only component imported unchanged from its source branch.
---

Keep the approved Elevation Bank hero and its icon artwork unchanged. Wire its profile call site with actual API credit figures and locally held activity context; do not invent distinct-summit or year-on-year statistics. Show the hero for confirmed API balances, including a genuine zero, and retain the existing Bank card for the other screens and unavailable states.

**Why:** The user explicitly approved a rendered and tested component and asked for data wiring rather than reconstruction. The API does not supply all the mockup figures; guesses would misrepresent account progress. The user also clarified that a confirmed zero deserves a motivational empty state, while a failed authenticated request must not be relabelled as zero.

**How to apply:** For future Bank changes, adjust the call site and available data sources first. Preserve the reviewed SVG icons and figure semantics unless the user explicitly requests a new design or changes the credit contract. Protected queries must wait for the Clerk bearer getter to be installed, but do not turn authentication failure into a zero balance.

Development Bank availability is a two-part condition: a Clerk-authenticated API request and an enabled Stage 2 ledger against an actually present development schema. A local manual subtotal can exist even while either condition fails.

**Why:** A missing bearer returned an authentication redirect in preview; independently, the development ledger gate was off even though its tables existed. A successful login alone would still not have produced an API-backed zero or balance.

**How to apply:** Distinguish an authenticated zero response from an error. Before enabling ledger reads/writes in another environment, verify that environment's schema and release policy; the production gate is intentional and must not be bypassed just to make the hero appear.