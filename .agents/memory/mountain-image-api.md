---
name: Mountain image loading pattern
description: How mountain/hill photos are fetched in the Expo app — always remote URI, never bundled assets
---

## Rule

Mountain and hill photos are **always remote URIs** fetched from the API server. Never use `require()` or bundled assets for mountain photos.

**Pattern used everywhere:**
```ts
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const imageUri = `${API_BASE}/mountain-image?name=${encodeURIComponent(mountainName)}&width=800&height=400`;
// Then: <ExpoImage source={{ uri: imageUri }} contentFit="cover" />
```

**Why:** The `/api/mountain-image` endpoint fetches from Wikipedia pageimages → Wikimedia Commons → Mapbox satellite fallback, with a 30-day `Cache-Control` header so repeat loads are instant. Every screen in the app (dashboard, plan, hill-detail, session-detail, trail-detail, challenge-detail) uses this exact pattern.

**How to apply:** Any component that needs a mountain or hill photo should build a `{ uri: ... }` source using `API_BASE + "/mountain-image?name=" + encodeURIComponent(name)`. Optional `&width=` and `&height=` params (max 1280×800). Keep the category gradient as an absolute-fill background layer behind `ExpoImage` so it shows while the image loads.
