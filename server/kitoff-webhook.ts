/**
 * KitOff Webhook Integration
 *
 * Sends a POST request to KitOff after a confirmed xHACCP order that contains
 * >= 4 label-set units. KitOff then generates a BASIC promo code and emails
 * it directly to the customer.
 *
 * Endpoint: https://kitoff.app/api/xhaccp/webhook
 * Auth header: x-xhaccp-secret: <XHACCP_WEBHOOK_SECRET>
 */

export interface OrderItemForKitoff {
  productName: string;
  quantity: number;
}

/**
 * Returns true if the product is a KitOff label-set (rolls of labels).
 * Heuristic: name contains "roll" or "etichete" (case-insensitive).
 * This covers English ("Set of 8 KitOff label rolls") and
 * Romanian ("Set de 8 role de etichete KitOff") product names.
 * Intentionally excludes dispensers, subscriptions, and accessories.
 */
export function isLabelSetProduct(productName: string): boolean {
  const lower = productName.toLowerCase();
  return lower.includes('roll') || lower.includes('etichete');
}

/**
 * Counts total label-set units in an order.
 */
export function countLabelSets(items: OrderItemForKitoff[]): number {
  return items
    .filter(item => isLabelSetProduct(item.productName))
    .reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Sends the KitOff webhook for an order.
 * Safe to call fire-and-forget — all errors are logged, never thrown.
 *
 * @param email    Customer email address
 * @param orderId  Numeric order ID (used as deduplication key by KitOff)
 * @param quantity Total label-set units purchased
 */
export async function sendKitoffWebhook(
  email: string,
  orderId: number,
  quantity: number
): Promise<void> {
  const secret = process.env.XHACCP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(`[KitOff] XHACCP_WEBHOOK_SECRET not set — skipping webhook for order #${orderId}`);
    return;
  }

  const payload = {
    email,
    orderId: String(orderId),
    quantity,
  };

  try {
    const resp = await fetch('https://kitoff.app/api/xhaccp/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-xhaccp-secret': secret,
      },
      body: JSON.stringify(payload),
    });

    const body = await resp.json().catch(() => ({})) as any;

    if (resp.ok) {
      if (body?.codeSent) {
        const reason = body.reason ? ` (${body.reason})` : '';
        console.log(`[KitOff] ✅ Code sent to ${email} for order #${orderId}${reason}`);
      } else {
        console.log(`[KitOff] ℹ️ Webhook OK but no code sent for order #${orderId}: ${body?.reason || 'unknown reason'}`);
      }
    } else {
      console.error(`[KitOff] ❌ Webhook returned ${resp.status} for order #${orderId}:`, body);
    }
  } catch (err) {
    console.error(`[KitOff] ❌ Webhook network error for order #${orderId}:`, err);
  }
}

/**
 * Convenience: inspects order items, counts label sets, and fires the
 * KitOff webhook if quantity >= 4. Call this after every confirmed payment.
 *
 * @param email    Customer email
 * @param orderId  Numeric order ID
 * @param items    Order line items with productName + quantity
 */
export async function maybeNotifyKitoff(
  email: string,
  orderId: number,
  items: OrderItemForKitoff[]
): Promise<void> {
  if (!email) {
    console.warn(`[KitOff] No email for order #${orderId} — skipping`);
    return;
  }

  const quantity = countLabelSets(items);

  if (quantity < 4) {
    console.log(`[KitOff] Order #${orderId}: ${quantity} label set(s) — below threshold, skipping`);
    return;
  }

  console.log(`[KitOff] Order #${orderId}: ${quantity} label set(s) for ${email} — triggering webhook`);
  await sendKitoffWebhook(email, orderId, quantity);
}
