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

**Why:** Older image responses could retain a map after reviewed artwork became available. Approved mountain metadata and the reviewed Batch library are distinct approval sources; neither should be ignored simply because the other has no image.

**How to apply:** For normal subjects, build a remote `{ uri: ... }` source from `API_BASE + "/mountain-image?name=" + encodeURIComponent(name)` with optional dimensions. For a known reviewed asset, validate its exact approval before selecting it, and use a gradient while resolving rather than briefly showing an old fallback image. Keep the gradient behind `ExpoImage` so failures do not reveal unrelated imagery. Approval of a development-only asset is not proof of production availability.

Approved mountain images must be accessible through the shared image-reading path in every profile and build, without exposing the private review workflow. Existing identity-bound approvals lead; an exact, currently approved Batch image takes precedence over automatic art or placeholders, and can rescue a broken external photo.

**Why:** Mont Blanc's approved image was restricted to a development sample profile, leaving real accounts with a placeholder. Matterhorn also had an external approved photo that failed despite an available approved stored image.

**How to apply:** Preserve approval/version and mountain-identity checks, never generate replacements for approved mountains, and verify actual image bytes rather than approval metadata alone. Missing/offline storage is still a real availability failure; do not promise an image exists in production solely from a successful development read.
