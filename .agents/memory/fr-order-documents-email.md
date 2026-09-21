---
name: French order documents email
description: Rules for the consolidated French invoice and MyFlyingBox notification.
---

For French orders, send one consolidated customer email only after the Pennylane invoice is issued, its PDF is retrievable, and a MyFlyingBox AWB exists. Use the opaque public order reference for the tracking URL; do not expose the sequential order ID or courier credentials.

**Why:** Payment callbacks, webhooks, and administrative retries can arrive in any order and can be delivered more than once. Claiming the invoice notification atomically after all required artifacts exist prevents duplicate customer emails while still allowing a failed send to be retried.

**How to apply:** Keep Romanian, COM, and Sameday customer emails on their existing paths. FR notification retries should clear the claim when delivery fails, and the public tracking page must remain unauthenticated but scoped to FR MyFlyingBox orders.