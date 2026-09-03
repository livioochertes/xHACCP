---
name: Viva currency-specific sources
description: Viva checkout source codes must be matched to the merchant and currency enabled for that source.
---

A Viva `sourceCode` and authentication credentials are market/account-specific. If Viva returns `PersonsValidateCurrencyFailedCurrencyNotFound`, the source must be configured for that currency or replaced with a currency-enabled source; the application must not silently convert the marketplace amount.

**Why:** The RO Viva source accepted the request structure but rejected a valid EUR currency code because EUR was not enabled for that source. FR now has its own Viva API key, OAuth credentials, merchant ID, and EUR source.

**How to apply:** Keep all Viva credentials and source configuration market-specific, select them from the request hostname, fail before creating a local pending order when the needed set is missing, and test each market/currency combination in Viva after configuration changes.