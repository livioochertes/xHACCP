---
name: Viva checkout error handling
description: Safe diagnostics and user-facing behavior for Viva order-creation failures.
---

Payment order creation must never expose an upstream HTML page or raw provider response in the checkout UI. Server logs may include a short, normalized provider error for diagnosis, but must not include source codes, access tokens, or customer contact payloads; a short request identifier is the safe correlation mechanism.

**Why:** Gateways and payment providers can return HTML or verbose error bodies, which can leak implementation details into customer-facing toasts and make the actual failure hard to diagnose.

**How to apply:** Keep payment API failures as controlled JSON responses with a stable error code and request ID, and make the shared client error parser ignore HTML responses.