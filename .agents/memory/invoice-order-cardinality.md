---
name: Invoice order cardinality
description: Production can retain multiple invoice records for one order during local fallback, SmartBill issuance, or reissuance.
---

The invoice-to-order relationship is one invoice record to one order, but not one order to one invoice record. Historical local/fallback invoices can coexist with a later issued SmartBill or reissued invoice.

**Why:** Production contains orders with both an earlier pending local invoice and a later issued invoice, so a unique constraint on invoices.order_id prevents publish-time schema validation and does not match application behavior.

**How to apply:** Do not add a unique constraint to invoices.order_id; use invoice status/number and explicit selection when identifying the current invoice for an order.