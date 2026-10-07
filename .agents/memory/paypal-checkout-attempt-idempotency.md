---
name: PayPal checkout attempt idempotency
description: Prevent duplicate local and provider checkouts when a PayPal create request has an ambiguous outcome.
---

A PayPal button retry must reuse a client attempt ID. Persist that ID with a unique database constraint and a fingerprint of the submitted checkout details; reject attempts that reuse the same ID with changed details. Derive PayPal's create request ID from the resulting stable local order, and retrieve an already-bound provider order rather than creating another.

**Why:** A timeout can hide a successful PayPal order creation. A new local order changes the provider idempotency key and can create a second checkout.

Only a confirmed permanent create rejection may fail the local attempt and authorize the client to use a new attempt ID. Keep the same attempt and provider key for timeouts, network failures, provider errors, and rate limits.

**Why:** A rejected response proves the provider did not accept that create request; an uncertain response does not. Treating a transient response as permission to create a new checkout can duplicate orders or provider checkouts.

**How to apply:** Keep the client attempt identity stable across retries of the same cart and address payload, make local order creation race-safe in the database, recover provider orders by their stored ID when available, and expose an explicit server signal only after a permanent rejection is recorded.
