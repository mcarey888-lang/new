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

## UK preview currency and legacy products

Use GBP-only Test Store products for the UK browser preview, while native
paywalls must retain the actual localised Apple/Google price string. Never
replace a dollar symbol with a pound symbol on a differently priced product.

**Why:** Multi-currency preview products can resolve to dollar pricing. RevenueCat
also refuses to delete a Test Store product that has transactions, despite the
generic setup guidance recommending removal of old products.

**How to apply:** Link replacement preview products to the same packages and
entitlements, preserve native-store package associations, and verify GBP values
from the live catalogue. Retain transaction-bearing legacy products when deletion
is refused; do not erase customer purchases to clear a pricing cache. Refresh the
preview to discard cached offerings. Product replacement is not a native-price
change or proof of an installed store checkout's current currency.
