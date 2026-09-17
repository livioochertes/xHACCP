---
name: SmartBill product synchronization
description: Supported SmartBill product catalog write and read contracts for the Romanian marketplace.
---

SmartBill has no supported V1 `/products` write/list endpoint. Product catalog writes use the V1 `/invoice/v2` payload with `isDraft: true` and `products[].saveToDb: true`; SmartBill matches existing products by code and updates them without assigning an invoice number. V3 product listing is read-only and requires a separate Bearer token.

**Why:** The old `/products` implementation returned 404, while the official contract documents product persistence as part of invoice payloads and separates V3 authentication.

**How to apply:** Keep synchronization payloads limited to documented invoice product fields, cap each draft at 400 lines, report submitted/draft/failed counts, and never claim per-row create/update status without a V3 catalog comparison.