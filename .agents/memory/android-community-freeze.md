---
name: Android community responsiveness
description: Why Android Activity and Photos require bounded image mounting and stable auth-token effects.
---

## Rule

Keep community photo-token effects keyed by visibility and user identity, not by a potentially changing auth function reference. Bound the number of native post photos mounted at once and let people reveal more deliberately. Do not treat a signed-out web preview as proof that signed-in Android Activity or Photos is responsive.

**Why:** The user observed You opening and then freezing on Android in Activity or Photos after an earlier optimisation deferred community loading on the initial Profile view. Those sections begin fetching posts and protected photos only when opened; a token effect that resets state and re-fetches on changing auth function identity could repeat after each render, while mounting a full photo feed can overwhelm native decoding. The exact device-level cause is still unconfirmed without an authenticated Android reproduction.

**How to apply:** When adjusting the community feed or auth integration, check effect dependency stability and avoid resetting token state on unrelated renders. Keep private photo caching isolated by user, preserve access to older posts through incremental display, and verify the signed-in Android path separately from browser checks.