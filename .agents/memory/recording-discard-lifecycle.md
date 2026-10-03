---
name: Recording discard lifecycle
description: Why deleting a hike must fence recovery writes and navigate safely without a back stack.
---

Discard is a recording-lifecycle operation, not a navigation action. Fence and drain checkpoint writes before deleting the recovery record, and preserve unrelated recordings and saved personal plans.

**Why:** The user encountered a finished recording whose Discard button only attempted Back. A restored screen can have no previous route, and leaving its checkpoint behind lets the recording reopen. Autosave can also recreate deleted recovery data if deletion is not ordered after pending writes.

**How to apply:** Use the same deletion path for short recordings and finished summaries; stop recording producers, delete only the matching owner/activity recovery data, prevent concurrent Save/Discard, and leave via an explicit valid destination. A storage failure must remain visible and retryable, not look like successful deletion.