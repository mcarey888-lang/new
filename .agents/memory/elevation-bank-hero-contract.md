---
name: Elevation Bank hero contract
description: Approved profile hero is a presentation-only component imported unchanged from its source branch.
---

Keep the approved Elevation Bank hero and its icon artwork as the Profile's persistent layout. Wire its credit figures with actual API data; do not invent distinct-summit or year-on-year statistics. Show a confirmed zero only for a successful empty API result; show unknown credit figures as dashes when the API is unavailable. The existing Bank card may still serve other screens.

**Why:** The user explicitly approved a rendered and tested component and asked for data wiring rather than reconstruction. The API does not supply all the mockup figures; guesses would misrepresent account progress. The user clarified that a confirmed zero deserves a motivational empty state, and corrected the earlier fallback: showing the old card during an API failure made it look as though the approved hero was never imported.

**How to apply:** For future Bank changes, adjust the call site and available data sources first. Preserve the reviewed SVG icons and figure semantics unless the user explicitly requests a new design or changes the credit contract. Protected queries must wait for the Clerk bearer getter to be installed, but do not turn authentication failure into a zero balance.

Development Bank availability is a two-part condition: a Clerk-authenticated API request and an enabled Stage 2 ledger against an actually present development schema. A local manual subtotal can exist even while either condition fails.

**Why:** A missing bearer returned an authentication redirect in preview; independently, the development ledger gate was off even though its tables existed. A successful login alone would still not have produced an API-backed zero or balance.

**How to apply:** Distinguish an authenticated zero response from an error. Before enabling ledger reads/writes in another environment, verify that environment's schema and release policy; the production gate is intentional and must not be bypassed just to make the hero appear.

An API redirect from the preview despite the frontend being signed in can indicate that the preview's Clerk development publishable key and the API's live Clerk secret belong to different environments. Preserve the live key for production; do not bypass authentication to make ledger data visible.

**Why:** A development request still returned an authentication redirect after token-getter ordering was fixed. The frontend reported development keys, while the route's auth wrapper only redirects with the live secret. Ordering alone cannot make a development token valid to a live Clerk instance.

**How to apply:** Use a separately supplied matching development secret for development API verification, leaving production credentials untouched. Do not assume a local self-reported figure is server credit.