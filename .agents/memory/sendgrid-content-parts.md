---
name: SendGrid content parts
description: Omit absent plain-text or HTML formats rather than sending empty content parts.
---

Do not include an empty HTML part in a text-only message, or an empty plain-text part in an HTML-only message.

**Why:** SendGrid can reject empty content parts with HTTP 400. This can silently prevent operational alerts even when the same sender and API key work for marketing HTML.

**How to apply:** Include only formats with actual content, reject messages with no content explicitly, and classify numeric SDK error codes even when response.statusCode is absent.
