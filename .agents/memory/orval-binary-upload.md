---
name: Generated binary upload requests
description: Orval image uploads may serialize Blob bodies as JSON despite a binary schema.
---

Generated binary upload helpers may JSON-stringify a Blob even when the OpenAPI request body declares image/jpeg and the server expects raw bytes. Regeneration can reintroduce the bug. Check the generated request body after codegen and test that it sends the Blob itself.

**Why:** A generated community-photo upload helper sent JSON-shaped bytes under an image content type, so the API correctly rejected an otherwise valid photo.

**How to apply:** When adding or regenerating binary OpenAPI endpoints, inspect the generated transport rather than trusting its TypeScript Blob signature; maintain a request-level regression check or a separate supported binary transport.