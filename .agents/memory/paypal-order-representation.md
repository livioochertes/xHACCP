---
name: PayPal order representation
description: Minimal create responses are not evidence of an invalid or mismatched checkout.
---

PayPal Orders v2 defaults to a minimal create response containing only ID, status, and links. Request a full representation before validating purchase-unit ownership, currency, and amount. Read the same provider order when an idempotent replay or incomplete response lacks those fields.

**Why:** A successful checkout can be rejected locally when validation treats omitted fields as mismatched fields. Previously created idempotent responses may remain minimal after the request preference changes.

**How to apply:** Preserve all ownership and monetary checks against complete order details. Keep detail-read failures outside permanent-create-rejection handling: a failed lookup does not prove that the already-created checkout is terminal or that its voucher reservation may be released.
