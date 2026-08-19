---
name: API codegen and Zod compatibility
description: OpenAPI integer schemas can generate zod.int(), which is incompatible with this workspace's installed Zod runtime.
---

When adding OpenAPI contracts here, prefer numeric identifiers as `type: number` unless the generated Zod version is confirmed to support `z.int()`.

**Why:** The workspace currently generates schemas against a Zod 3 runtime while Orval may emit Zod 4-style helpers for integer formats, causing the required library typecheck to fail after otherwise successful codegen.

**How to apply:** Run API codegen immediately after changing the spec and fix generated compatibility issues before building routes or frontend callers.