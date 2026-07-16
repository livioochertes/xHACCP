---
name: Volume discount must be applied server-side
description: Backend recalculates prices from DB for security — must also apply volume discount tiers or discounted prices are ignored in emails and Viva payment.
---

## Rule
Whenever the backend recalculates product prices from DB (for security, never trusting client prices), it must also call `applyVolumeDiscount(basePrice, quantity, product.volumeDiscounts)` after `applyMarketOverlay()`.

**Why:** The backend security pattern re-fetches each product from DB and uses `effectiveProduct.price × quantity` as the canonical price. Without the volume discount step, the base price is used regardless of quantity tiers — causing emails and payment charges to use the wrong (higher) amount.

**How to apply:**
- `applyVolumeDiscount()` helper is defined at the top of `server/routes.ts` (mirrors `client/src/lib/volume-price.ts`).
- Two routes need it: `POST /api/orders` (COD order creation) and `POST /api/payments/viva/create-order`.
- In the Viva route, accumulate `validatedVivaItems` during the validation loop so the same server-calculated discounted prices are used for both the Viva payment amount AND the order items stored in DB.
- Do NOT use client-provided `item.price` or `cartItems.map(...)` for order item storage — always use the server-validated array.
