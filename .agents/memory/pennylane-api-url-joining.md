---
name: Pennylane API URL joining
description: The external API base URL includes a path that must survive endpoint resolution.
---

Pennylane endpoint paths must be resolved relative to the configured API base path, not as root-absolute URLs. A base such as `https://app.pennylane.com/api/external/v2` must produce `/api/external/v2/me`, not `/me`.

**Why:** Resolving a path beginning with `/` against the base URL discarded the API path and returned Pennylane's HTML application shell, which surfaced as an “Unexpected token <” JSON error.

**How to apply:** Normalize the base URL with a trailing slash and strip leading slashes from endpoint paths before constructing requests. Apply the same rule to JSON API calls and PDF downloads.