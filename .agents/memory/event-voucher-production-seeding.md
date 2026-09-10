---
name: Event voucher production seeding
description: Fixed campaign rows can be absent in production even when the table and development seed exist.
---

The public fixed-campaign endpoint should provision its known campaign idempotently when the table exists but the seed row is missing. It must still respect an explicitly inactive campaign.

**Why:** Production schema synchronization does not guarantee that seed data created in development is present in an existing production database.

**How to apply:** Use an insert-on-conflict-do-nothing data path for known campaign defaults; do not add startup-time DDL or overwrite an existing campaign configuration.