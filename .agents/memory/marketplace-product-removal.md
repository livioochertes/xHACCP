---
name: Marketplace product removal
description: Rules for removing products from individual marketplaces without damaging shared order history.
---

When an administrator removes a product while a specific marketplace is selected, remove only that marketplace's availability entry. Reserve global product deletion for an all-market action by an unrestricted administrator. Once a product has any marketplace availability entry, it must have an active entry for the requested market to appear there.

**Why:** Products are shared catalog records while invoices preserve links to them across markets. A global deletion can be blocked by, or risk damaging, historical orders that belong to another marketplace. Treating a missing market row as globally available makes an item removed from one market reappear there.

**How to apply:** Route every product-market mutation through a valid, authorized market value. Validate every affected market before replace-all operations so a restricted administrator cannot remove or change another market by omission. Explicitly reconcile legacy products that have no market rows before relying on market-specific admin views.