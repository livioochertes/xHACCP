---
name: Viva currency-specific sources
description: Viva checkout source codes must be matched to the merchant and currency enabled for that source.
---

A Viva `sourceCode` is not automatically valid for every currency on the merchant account. If Viva returns `PersonsValidateCurrencyFailedCurrencyNotFound`, the source must be configured for that currency or replaced with a currency-enabled source; the application must not silently convert the marketplace amount.

**Why:** The RO Viva source accepted the request structure but rejected a valid EUR currency code because EUR was not enabled for that source.

**How to apply:** Keep market-specific Viva source configuration separate, fail before creating a local pending order when the needed source is missing, and test each market/currency combination in Viva after configuration changes.