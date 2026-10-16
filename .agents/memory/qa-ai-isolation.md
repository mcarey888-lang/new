---
name: QA AI isolation
description: Prevent unintended paid AI usage during ordinary browser regression tests.
---

Install network guards before the first page load when a QA run excludes paid AI. Blocking explicit generation buttons alone is insufficient.

**Why:** A guest goal-setup regression opened the dashboard and automatically triggered coach assessments, despite the tester never pressing an AI button. Treating “no AI clicks” as isolation did not prevent those requests.

**How to apply:** Review automatic AI-backed requests in the changed journey and intercept them, including assessments, before navigation. For layout-only checks, abort API requests altogether. Do not disable normal product features or alter production configuration just to isolate a test.
