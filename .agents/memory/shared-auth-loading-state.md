---
name: Shared auth loading state
description: Constraint for the client-side global authentication state used by multiple hooks.
---

When authentication state is shared through module-level state and setter subscriptions, every new subscriber must immediately synchronize with the current global value after registering. Otherwise a child can finish initialization before a parent registers, leaving the parent permanently stuck in its initial loading state.

**Why:** CartProvider and Header both call the auth hook, and effect ordering can let one initialize global auth before the other subscribes.

**How to apply:** Register the setter first, then copy the current global auth state into the new hook instance; keep a bounded network timeout for auth and cart requests as a secondary safeguard.