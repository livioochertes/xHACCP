---
name: Marketplace product removal
description: Rules for removing products from individual marketplaces without damaging shared order history.
---

When an administrator removes a product while a specific marketplace is selected, remove only that marketplace's availability entry. Reserve global product deletion for an all-market action by an unrestricted administrator. Products appear only when they have an active entry for the requested market; no market row is not global availability.

**Why:** Products are shared catalog records while invoices preserve links to them across markets. A global deletion can be blocked by, or risk damaging, historical orders that belong to another marketplace. Treating a missing market row as globally available makes an item removed from one market reappear there.

**How to apply:** Route every product-market mutation through a valid, authorized market value. Validate every affected market before replace-all operations so a restricted administrator cannot remove or change another market by omission. Every import must create or update only its selected market row; legacy products without rows must be reimported or explicitly migrated before becoming market-visible.

For a global product deletion, remove its product translations (including SEO research sources) in the same database transaction as the product. A historical order/invoice reference that blocks product deletion must roll the whole transaction back. Removing a product from one market is not a global deletion and must keep shared translations intact.

**Why:** SEO provenance belongs to its localized product translation, but order and invoice history must not be partially changed when a product is still referenced.

**How to apply:** Keep child cleanup inside `storage.deleteProduct`; do not apply it to `deleteProductMarket`.