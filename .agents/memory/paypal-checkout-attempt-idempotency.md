---
name: PayPal checkout attempt idempotency
description: Prevent duplicate local and provider checkouts when a PayPal create request has an ambiguous outcome.
---

A PayPal button retry must reuse a client attempt ID. Persist that ID with a unique database constraint and a fingerprint of the submitted checkout details; reject attempts that reuse the same ID with changed details. Derive PayPal's create request ID from the resulting stable local order, and retrieve an already-bound provider order rather than creating another.

**Why:** A timeout can hide a successful PayPal order creation. A new local order changes the provider idempotency key and can create a second checkout.

**How to apply:** Keep the client attempt identity stable across retries of the same cart and address payload, make local order creation race-safe in the database, and recover provider orders by their stored ID when available.
