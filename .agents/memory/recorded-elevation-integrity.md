---
name: Recorded elevation integrity
description: Preserve recording evidence and distinguish altitude filtering from historical-data correction.
---

Never cap recorded ascent using a mountain's summit altitude, a planned ascent target, or a guessed normal route. Repetitions and alternate routes can legitimately exceed those values.

**Why:** Real-phone reports exposed large, near-matching accumulated ascent and descent from GPS altitude noise. A plausible-looking replacement number would conceal the problem rather than establish what was actually climbed.

**How to apply:** Preserve raw recorded fixes separately from filtered totals. Treat desktop simulations as regression evidence, not real-device GPS validation. Do not automatically rewrite previously saved hikes using assumed terrain or route figures; any correction requires usable recorded evidence and an explicit, understandable correction flow.

Historical GPS reprocessing is a user-confirmed estimate, not verified ascent.
Keep the original measurements and notes, retain the untouched fixes, and
explain missing accuracy metadata or insufficient coverage before offering a
correction. Do not change qualified server credits just because a local review
was applied.

**Why:** A completed route can survive on a phone while its displayed totals are
wrong. Recovering those totals must not destroy the only remaining evidence or
claim a certainty that the GPS readings do not support.

**How to apply:** Use explicit preview and confirmation, with an original-value
audit. Keep private device backups separate from the canonical activity/evidence
ledger: a backup or retry must not create another credited activity.

Quality coverage requires known active recording duration and usable readings
throughout the active segments; missing duration is never complete coverage.
Do not infer coverage merely from the first and last timestamps or trust a
previously cached “reliable” label when reprocessing or uploading evidence.

**Why:** Independent verification found that two accurate readings ten seconds
apart could label a six-hour recording reliable despite a passing test suite.
Accurate individual fixes do not establish the coverage of an entire hike.

**How to apply:** Use the same duration-aware evidence assessment at live,
finish, save, detail/restore and upload boundaries; exclude deliberate pauses
without filling in missing GPS readings. Preserve original evidence and keep
historical qualified-credit corrections as a separate protected transaction.
