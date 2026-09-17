---
name: SmartBill product synchronization
description: Supported SmartBill product catalog write and read contracts for the Romanian marketplace.
---

SmartBill is a destination for product synchronization, not a product source. Product catalog writes use the V1 `/invoice/v2` payload with `isDraft: true` and `products[].saveToDb: true`; SmartBill matches existing products by code and updates them without assigning an invoice number. The remote catalog may be read transiently by code/name only to preserve SmartBill's existing names in outbound payloads; it must never be imported into the local catalog.

**Why:** SmartBill contains products that are not sold on the site. Reverse catalog or stock synchronization could expose or overwrite local catalog data that is intentionally not commercialized.

**How to apply:** Keep synchronization payloads limited to documented invoice product fields, cap each draft at 400 lines, and report submitted/draft/failed counts. Product catalog reads must remain internal, code-scoped, and non-persistent; never expose remote-only products or synchronize SmartBill stock back to the site. SmartBill reads for invoice series, PDFs, payment status, and email delivery remain separate.