---
name: Payment credential debugging constraint
description: Avoid repeatedly requesting existing payment secrets that the project owner has verified.
---

Do not request re-entry of the existing payment secrets during troubleshooting unless the user explicitly asks to update them.

**Why:** The user confirmed that all existing payment secrets are present and correct, and explicitly instructed us not to request them again.

**How to apply:** Investigate request construction, endpoint selection, runtime configuration, transport, and provider diagnostics without exposing secret values. An authentication rejection is evidence to investigate, not permission to repeatedly open a credential form.
