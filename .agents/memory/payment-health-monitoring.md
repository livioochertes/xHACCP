---
name: Payment health monitoring scope
description: User chose passive payment alerts and admin history instead of daily synthetic checks.
---

Monitor actual payment failures and provide an admin status/history view with explicit manual, read-only authentication checks. Do not add daily synthetic checkout/auth tests without a new request.

**Why:** After discussing daily testing, the user chose only real-error alerts and the admin overview, considering alerts sufficient to trigger intervention.

**How to apply:** Treat cancellation, normal customer validation errors and payment declines separately from technical incidents. Keep stage health independent: successful authentication does not establish successful checkout or webhook processing. Keep development observations isolated from production notifications.
