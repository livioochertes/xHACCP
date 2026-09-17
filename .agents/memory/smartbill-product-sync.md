---
name: SmartBill product synchronization
description: Supported SmartBill product catalog write and read contracts for the Romanian marketplace.
---

SmartBill is a destination for product synchronization, not a product source. Product catalog writes use the V1 `/invoice/v2` payload with `isDraft: true` and `products[].saveToDb: true`; SmartBill matches existing products by code and updates them without assigning an invoice number. Products and stock must never be imported back into the site because SmartBill contains a broader catalog.

**Why:** SmartBill contains products that are not sold on the site. Reverse catalog or stock synchronization could expose or overwrite local catalog data that is intentionally not commercialized.

**How to apply:** Keep synchronization payloads limited to documented invoice product fields, cap each draft at 400 lines, and report submitted/draft/failed counts. SmartBill reads are allowed only for invoice operations such as series, invoice PDF, payment status, and email delivery; do not add product/catalog/stock read-back flows.