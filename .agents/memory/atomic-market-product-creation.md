---
name: Atomic marketplace product creation
description: New products must be created together with their first marketplace association, with interrupted legacy creates reconciled safely.
---

A newly created product must have at least one marketplace association before the Admin reports success. The shared product row and its initial marketplace row must be committed in one transaction.

**Why:** A two-request create flow can successfully insert the shared product but lose or skip the marketplace request, leaving an invisible product while the Admin displays a success confirmation.

**How to apply:** Send the intended marketplace with product creation, validate category ownership for that marketplace, return both created rows, and treat products without any marketplace row as interrupted legacy creates that should be reconciled idempotently to the default permitted market.