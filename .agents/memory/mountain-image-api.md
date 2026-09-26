---
name: Mountain image loading pattern
description: How mountain/hill photos are fetched in the Expo app — always remote URI, never bundled assets
---

## Rule

Mountain and hill photos are **always remote URIs** fetched from the API server. Never use `require()` or bundled assets for mountain photos. Exact, reviewed artwork can supersede a generic mountain-image lookup where that lookup still serves a stale map or unrelated fallback. Do not show the fallback while an approved image is resolving.

**Pattern used everywhere:**
```ts
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const imageUri = `${API_BASE}/mountain-image?name=${encodeURIComponent(mountainName)}&width=800&height=400`;
// Then: <ExpoImage source={{ uri: imageUri }} contentFit="cover" />
```

**Why:** The `/api/mountain-image` endpoint fetches from Wikipedia pageimages → Wikimedia Commons → Mapbox satellite fallback, and its long-lived cache can retain a map even after reviewed artwork becomes available. A matching Batch artwork asset is not automatically selected by this endpoint.

**How to apply:** For normal subjects, build a remote `{ uri: ... }` source from `API_BASE + "/mountain-image?name=" + encodeURIComponent(name)` with optional dimensions. For a known reviewed asset, validate its exact approval before selecting it, and use a gradient while resolving rather than briefly showing an old fallback image. Keep the gradient behind `ExpoImage` so failures do not reveal unrelated imagery. Approval of a development-only asset is not proof of production availability.
