---
name: withTimeout generic inference with any-typed promises
description: Generic Promise.race timeout wrapper loses type info when wrapping an any-typed Clerk call; destructured properties become unknown.
---

A generic helper like `withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>` (implemented via `Promise.race`) fails to infer `T` when the argument passed in is typed `any` (e.g. `signIn.password(...)` where `signIn` itself is cast `as any`). TypeScript infers `T` as `unknown` instead of `any`, so destructuring `{ error } = await withTimeout(...)` fails with TS2339 ("Property does not exist on type 'unknown'").

**Why:** Clerk v3's `signIn`/`signUp` objects are commonly cast `as any` in this codebase to work around dummy-object typing issues (see clerk-dummy-resources.md). Wrapping their method calls in a generic timeout helper then hits this inference gap.

**How to apply:** Cast the awaited `withTimeout(...)` call result `as any` at each call site (consistent with the existing `as any` convention for Clerk objects) rather than trying to fix the generic signature — e.g. `const { error } = await withTimeout(signIn.finalize(), 20000) as any;`.
