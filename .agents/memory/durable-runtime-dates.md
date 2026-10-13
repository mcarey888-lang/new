---
name: Durable runtime dates
description: The active durable callback runtime can reject Date constructors and Date.now despite tool documentation.
---

In durableptc v1, date operations may throw “disabled” errors even though the tool description says they are supported. Use a small impure function for a fresh timestamp, or omit timestamps when unnecessary.

**Why:** Both new Date() and Date.now() failed while saving schema evidence; the completed SQL reads were unaffected, but the write never ran.

**How to apply:** Do not repeat successful database calls after a later local timestamp failure. Reuse their recorded results and correct only the timestamp/write portion.
