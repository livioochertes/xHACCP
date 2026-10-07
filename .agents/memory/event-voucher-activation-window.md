---
name: Event voucher activation window
description: Opt-in creates a minimal Client account; successful first payment determines whether a voucher opens a 12-month benefit or stays one-time.
---

After explicit opt-in, create or associate a minimal Client account by the signup email; billing and delivery details are not required. Send a new account a unique, expiring password-setup link, and never replace an existing account's password.

A voucher is usable on the first order. A successful paid redemption within 30 days of opt-in starts a 12-month validity period from the successful payment; the same client may reuse it according to the promotion's rules. If no payment succeeds within 30 days, the voucher remains a one-time discount for a later first order and does not activate the 12-month repeat benefit. Failed, cancelled, or unpaid orders do not activate or consume it.

**Why:** The user confirmed automatic Client creation at opt-in, a secure password-setup link, 12 months from the first successful paid order within 30 days, and a one-time first-order discount if that activation window is missed.

**How to apply:** Bind personal vouchers and qualifying orders to the Client account/email across checkout paths. Change activation and validity only after an idempotent successful-payment transition; keep late first-use vouchers limited to one paid order. Do not require billing or shipping information at opt-in.