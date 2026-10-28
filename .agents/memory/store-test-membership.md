---
name: Store test membership
description: Separate verified Google Play license-test access from browser Test Store preview purchases.
---

Verified Google Play license-test subscriptions should work against the live API.
Accept only server-verified active Play sandbox subscriptions for the signed-in
owner, with no pending payment and an unexpired store period. Never turn this
into blanket sandbox access, a client-controlled bypass, or a longer offline grant.

**Why:** The owner confirmed their failed Expeditions checkout was a Google Play
test purchase. A production-only environment filter rejected valid tester access.
This is a deliberate exception for Google Play license testing, not approval to
enable every sandbox store in production or change live billing.

**How to apply:** Keep test-store preview products separate from Play license-test
receipts. Preview availability and prices do not prove native store availability
or pricing. Do not change Google Play or Apple prices as a preview repair.
