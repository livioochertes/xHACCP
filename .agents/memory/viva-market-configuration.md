---
name: Viva market configuration
description: Initial Viva checkout and recurring renewals must share market-specific credentials and currency rules.
---

Viva payment flows should resolve credentials and currency through one market configuration. RO uses RON, while FR and COM use EUR; COM may use a dedicated `VIVA_COM_*` account when configured and otherwise retains the established shared account.

**Why:** Checkout and renewal code can otherwise drift, causing an initial payment to succeed while a monthly renewal uses the wrong source or currency.

**How to apply:** Update the shared Viva configuration when adding a marketplace or changing credentials, and cover both initial checkout payloads and recurring transaction requests in the same test matrix.