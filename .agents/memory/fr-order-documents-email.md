---
name: French order documents email
description: Rules for the consolidated French invoice and MyFlyingBox notification.
---

For French orders, send the initial customer confirmation and internal company notification only after the paid transition is claimed. Keep the separate consolidated invoice/tracking email gated on an issued Pennylane invoice, retrievable PDF, and MyFlyingBox AWB. Use the opaque public order reference for tracking; do not expose sequential IDs or courier credentials.

**Why:** French checkout creates pending orders directly through Viva or PayPal, bypassing the generic order route. Sending the initial confirmation before payment can confirm an unpaid order; waiting for invoice/AWB readiness unnecessarily delays order confirmation. Payment callbacks and webhooks can race, so the paid transition must gate one initial notification attempt.

**How to apply:** Call the initial FR confirmation on the first successful paid transition for both Viva and PayPal; keep Romanian, COM, and Sameday flows unchanged. The invoice/tracking email remains independently idempotent and retryable after all required artifacts exist.