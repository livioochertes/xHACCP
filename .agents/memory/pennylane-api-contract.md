---
name: Pennylane API contract
description: Pennylane Company API v2 uses company-scoped numeric IDs and structured invoice/customer payloads.
---

Use Company API v2 at `https://app.pennylane.com/api/external/v2`. Customer lookup uses a JSON `filter` query on `external_reference`; company customers are created through `company_customers` and require `billing_address.country_alpha2`. Customer invoices use `invoice_lines`, tax-exclusive string prices, ISO currency, country VAT codes such as `FR_200`, a required `deadline`, and `draft: true` when they will be finalized separately. Finalization uses `PUT /customer_invoices/{id}/finalize`. Product and ledger-account IDs are company-specific and must be stored per market/company, never hardcoded across environments.

**Why:** The API rejects generic field names and portable IDs; relying on an assumed REST shape can create invalid or mis-accounted invoices. Test accounts can also reject finalization until invoice numbering is configured.

**How to apply:** Keep the Pennylane adapter isolated, validate the live contract with the connected sandbox, and treat missing/invalid credentials as retryable invoice failures rather than generating a local French fallback.