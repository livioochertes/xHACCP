# xHACCP WMS Integration API

## Partner documentation

**API version:** `v1`  
**Audience:** Warehouse management systems and logistics partners  
**Transport:** HTTPS with JSON request and response bodies  
**Time zone:** UTC; timestamps use ISO 8601 format

This API allows an approved logistics partner to:

- pull orders that are ready for fulfillment;
- acknowledge that an order was imported into the WMS;
- send fulfillment status events and parcel tracking data;
- send inventory quantities by SKU.

The WMS always initiates the communication. xHACCP does not call the partner's API, poll the partner, or send ASN messages in the current integration phase.

## 1. Environments and base URL

The API uses one host and one versioned route family. Marketplace names are **not** part of the URL.

```text
Production base URL: https://xhaccp.fr/api/wms/v1
```

Use the published base URL supplied by xHACCP if it differs from the example above. Do not build a URL with `/ro`, `/fr`, or `/com`.

The supported marketplace codes are:

| Code | Marketplace |
| --- | --- |
| `ro` | Romanian marketplace |
| `fr` | French marketplace |
| `com` | International/English marketplace |

Sandbox and production credentials are issued separately:

- sandbox keys start with `wms_test_`;
- production keys start with `wms_live_`.

The environment is recorded on every key and keys must never be exchanged between environments. The current API uses the same route family for both key types; xHACCP will tell you which data and route configuration are available for your test key. Do not assume that a separate sandbox hostname exists.

## 2. Authentication

Send the API key in the `Authorization` header on every endpoint except health:

```http
Authorization: Bearer wms_live_REPLACE_WITH_YOUR_KEY
```

Keys are partner-specific. The API resolves the partner exclusively from the key; a query parameter cannot grant access to another partner.

### 2.1 Scopes

Keys are issued with one or more scopes:

| Scope | Allows |
| --- | --- |
| `orders:read` | List and retrieve orders |
| `orders:ack` | Acknowledge an imported order |
| `orders:events` | Send fulfillment events and tracking parcels |
| `inventory:write` | Send inventory updates |

A key with the `*` scope is treated as having every scope. A key without the required scope receives `403 INSUFFICIENT_SCOPE`.

### 2.2 Key handling

- Store the plaintext key in your WMS secret manager.
- Never put a key in source control, logs, tickets, screenshots, or support messages.
- xHACCP stores only a SHA-256 hash of the key.
- The plaintext key is displayed only once when xHACCP creates it.
- If a key is lost, ask xHACCP to issue a new key; the old value cannot be recovered.
- To rotate a key, install the new key first, verify it, and then ask xHACCP to revoke the old key.
- A revoked key stops working immediately and returns `401 UNAUTHENTICATED`.

## 3. Request correlation and rate limits

Every request under `/api/wms/v1` receives an `X-Request-Id` response header:

```http
X-Request-Id: wms_abc123_example
```

You may send your own `X-Request-Id` value for tracing. Values longer than 120 characters are replaced by a generated ID. Include the returned request ID in support requests.

The limit is **120 requests per minute per API key**. When the limit is exceeded:

- the response is `429`;
- the error code is `RATE_LIMITED`;
- the response includes `Retry-After: 60`.

Use exponential backoff and do not retry a request immediately in a tight loop.

All WMS requests are audited by xHACCP with the request ID, partner/key context where available, HTTP method, path, status code, and timestamp.

## 4. Common response and error format

Successful collection responses use a `data` property:

```json
{
  "data": []
}
```

Errors use this format:

```json
{
  "error": {
    "code": "INVALID_EVENT",
    "message": "event_id, event_type and a valid occurred_at are required",
    "request_id": "wms_abc123_example"
  }
}
```

`details` may be included for validation errors.

### 4.1 HTTP status codes

| HTTP | Error code(s) | Meaning |
| ---: | --- | --- |
| `400` | `UNAUTHENTICATED`, `IDEMPOTENCY_KEY_REQUIRED`, `INVALID_CURSOR`, `INVALID_UPDATED_SINCE` | The request is malformed or authentication is missing |
| `401` | `UNAUTHENTICATED` | The key is missing, invalid, revoked, or belongs to an inactive partner |
| `403` | `INSUFFICIENT_SCOPE`, `MARKET_NOT_ALLOWED` | The key is valid but is not authorized for the operation or market |
| `404` | `ORDER_NOT_FOUND` | The order does not exist, is not visible to this partner, or is not fulfillable |
| `409` | `IDEMPOTENCY_KEY_REUSED`, `IDEMPOTENCY_IN_PROGRESS` | The idempotency key conflicts with another request |
| `422` | `INVALID_EVENT`, `INVALID_INVENTORY_BATCH` | The request body is not acceptable |
| `429` | `RATE_LIMITED` | The per-key rate limit was exceeded |
| `500` | `INTERNAL_ERROR` | xHACCP could not complete the request |

Resource isolation is intentional: an order, event, or shipment belonging to another partner is reported as not found rather than disclosed.

## 5. Order visibility and routing

An order becomes available to a WMS only when all of the following are true:

1. the order has a confirmed timestamp;
2. payment is complete, or the payment method is cash on delivery (`cash_on_delivery`, `cod`, or `cash`);
3. the order has a fulfillment partner snapshot;
4. the fulfillment status is one of `ready`, `acknowledged`, `picking`, `packed`, `shipped`, or `delivered`;
5. the order is routed to the authenticated partner's ID and an allowed marketplace.

Orders with products that cannot be resolved to the catalog SKU are not useful to the WMS and should be reported to xHACCP support if they are expected but absent.

Routing rules:

- each marketplace has at most one active fulfillment partner;
- one partner may serve more than one marketplace;
- `?market=` can restrict a request to one of the key's already-authorized markets;
- `?market=` can never expand the key's access;
- a route change affects new fulfillment snapshots;
- orders already assigned to a partner keep that partner snapshot.

The shop status (`status`) and the WMS fulfillment status (`fulfillment_status`) are separate fields. Do not use the shop status as a substitute for the fulfillment state machine.

## 6. Endpoint summary

| Method | Endpoint | Scope | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | None | Public service health check |
| `GET` | `/orders` | `orders:read` | Cursor-paginated order list |
| `GET` | `/orders/{public_order_ref}` | `orders:read` | Full order detail |
| `POST` | `/orders/{public_order_ref}/ack` | `orders:ack` | Confirm WMS import |
| `POST` | `/orders/{public_order_ref}/events` | `orders:events` | Send fulfillment state and parcels |
| `POST` | `/inventory` | `inventory:write` | Send inventory quantities |

The `{public_order_ref}` value is the public reference returned by xHACCP, for example `ord_7f9e...`. It is not the internal numeric database ID.

---

## 7. Health check

### `GET /health`

This endpoint is unauthenticated and is safe for uptime monitoring.

```bash
curl -i https://xhaccp.fr/api/wms/v1/health
```

Example response:

```http
HTTP/2 200
X-Request-Id: wms_abc123_example
```

```json
{
  "ok": true,
  "service": "xhaccp-wms-api",
  "version": "v1",
  "timestamp": "2026-09-08T06:00:00.000Z"
}
```

The health endpoint confirms that the HTTP service is responding. It does not authenticate a warehouse key or confirm that a specific partner is routed.

## 8. List orders

### `GET /orders`

Required scope: `orders:read`.

```bash
curl --fail-with-body \
  -H "Authorization: Bearer ${WMS_API_KEY}" \
  "https://xhaccp.fr/api/wms/v1/orders?limit=50"
```

### Query parameters

| Parameter | Required | Description |
| --- | --- | --- |
| `market` | No | Restrict the response to `ro`, `fr`, or `com`. The market must already be routed to the key's partner. |
| `status` | No | Comma-separated fulfillment statuses. Supported values are `ready`, `acknowledged`, `picking`, `packed`, `shipped`, and `delivered`. |
| `updated_since` | No | ISO timestamp. Returns records whose `updated_at` is later than this value. |
| `limit` | No | Number of records requested. Default `50`; maximum `100`. |
| `cursor` | No | Opaque cursor returned in `pagination.next_cursor`. |

Results are ordered by `confirmed_at`, then the internal order sequence for stable cursor pagination. Never decode or modify a cursor. If `next_cursor` is `null`, the page is complete.

Example:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer ${WMS_API_KEY}" \
  "https://xhaccp.fr/api/wms/v1/orders?market=fr&status=ready,acknowledged&limit=50"
```

Example response:

```json
{
  "data": [
    {
      "id": "ord_01HXYZ...",
      "market": "fr",
      "currency": "EUR",
      "status": "confirmed",
      "fulfillment_status": "ready",
      "confirmed_at": "2026-09-08T06:00:00.000Z",
      "updated_at": "2026-09-08T06:00:00.000Z",
      "totals": {
        "total": "265.65",
        "shipping": "9.90"
      },
      "payment": {
        "method": "card",
        "status": "paid"
      },
      "customer": {
        "email": "marie@example.com",
        "first_name": "Marie",
        "last_name": "Durand",
        "phone": "+33612345678"
      },
      "shipping_address": {
        "firstName": "Marie",
        "lastName": "Durand",
        "streetAddress": "12 rue de la Mer",
        "city": "Nice",
        "zipCode": "06000",
        "country": "FR",
        "phone": "+33612345678",
        "email": "marie@example.com"
      },
      "billing_address": {},
      "notes": "Leave at reception",
      "items": [
        {
          "sku": "XH-SET-L",
          "name": "HACCP label set",
          "quantity": 2,
          "unit_price": "132.83",
          "total_price": "265.66",
          "weight": "2100",
          "configuration": null
        }
      ],
      "shipments": [],
      "events": []
    }
  ],
  "pagination": {
    "next_cursor": "eyJjb25maXJtZWRBdCI6IjIwMjYtMDktMDhUMDY6MDA6MDAuMDAwWiIsImlkIjoxMjM0fQ",
    "limit": 50
  }
}
```

Money values are decimal strings. Treat them as decimal values, not binary floating-point numbers.

### Recommended pull loop

1. Start with no cursor.
2. Store the complete response in your import log.
3. Import each order using `id` as the xHACCP public order reference.
4. Continue with `pagination.next_cursor`.
5. Stop when `next_cursor` is `null`.
6. Acknowledge each successfully imported order with a unique idempotency key.
7. Use `updated_since` for subsequent reconciliation passes.

Do not use offset pagination. New orders can be confirmed while a multi-page pull is in progress.

## 9. Get an order

### `GET /orders/{public_order_ref}`

Required scope: `orders:read`.

```bash
curl --fail-with-body \
  -H "Authorization: Bearer ${WMS_API_KEY}" \
  "https://xhaccp.fr/api/wms/v1/orders/ord_01HXYZ..."
```

The response is wrapped in `data` and has the same order shape as the list response. The detail response also includes accepted WMS events and stored parcels:

```json
{
  "data": {
    "id": "ord_01HXYZ...",
    "market": "fr",
    "currency": "EUR",
    "status": "confirmed",
    "fulfillment_status": "shipped",
    "confirmed_at": "2026-09-08T06:00:00.000Z",
    "updated_at": "2026-09-08T14:02:00.000Z",
    "totals": {
      "total": "265.65",
      "shipping": "9.90"
    },
    "payment": {
      "method": "card",
      "status": "paid"
    },
    "customer": {
      "email": "marie@example.com",
      "first_name": "Marie",
      "last_name": "Durand",
      "phone": "+33612345678"
    },
    "shipping_address": {},
    "billing_address": {},
    "notes": null,
    "items": [],
    "shipments": [
      {
        "parcel_id": "PARCEL-001",
        "tracking_number": "6A12345678901",
        "carrier": "colissimo",
        "status": "shipped",
        "updated_at": "2026-09-08T14:02:00.000Z"
      }
    ],
    "events": [
      {
        "event_id": "evt_01J...",
        "type": "shipped",
        "status": "shipped",
        "occurred_at": "2026-09-08T14:02:00.000Z"
      }
    ]
  }
}
```

An order that belongs to another partner returns `404 ORDER_NOT_FOUND`; the API does not confirm that the reference exists.

## 10. Acknowledge an order import

### `POST /orders/{public_order_ref}/ack`

Required scope: `orders:ack`.

`X-Idempotency-Key` is required. Use a stable, unique value for the logical import operation and reuse it when retrying the same request.

```bash
curl --fail-with-body -X POST \
  -H "Authorization: Bearer ${WMS_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: import-ord-01HXYZ-attempt-1" \
  -d '{"wms_order_ref":"SLL-88123","metadata":{"import_batch":"2026-09-08-0600"}}' \
  "https://xhaccp.fr/api/wms/v1/orders/ord_01HXYZ.../ack"
```

The body is JSON. `wms_order_ref` is accepted as partner metadata; `metadata` is returned in the acknowledgement response. The API does not require a specific body field, but sending your own order reference is strongly recommended.

Example response:

```json
{
  "data": {
    "id": "ord_01HXYZ...",
    "fulfillment_status": "acknowledged",
    "acknowledged_at": "2026-09-08T06:03:12.000Z",
    "metadata": {
      "import_batch": "2026-09-08-0600"
    }
  }
}
```

Acknowledgement is forward-only:

- `ready` becomes `acknowledged`;
- an order already at `acknowledged`, `picking`, `packed`, `shipped`, or `delivered` is not moved backwards;
- the same idempotency key and identical body replays the original response;
- a concurrent request using the same key receives `409 IDEMPOTENCY_IN_PROGRESS`;
- a reused key with a different body receives `409 IDEMPOTENCY_KEY_REUSED`.

## 11. Send fulfillment events and tracking

### `POST /orders/{public_order_ref}/events`

Required scope: `orders:events`.

`X-Idempotency-Key` is required. Events also have a partner-scoped natural key: `event_id`.

```bash
curl --fail-with-body -X POST \
  -H "Authorization: Bearer ${WMS_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: event-evt-01J-shipped" \
  -d '{
    "event_id": "evt_01J_SHIPPED_001",
    "event_type": "shipped",
    "occurred_at": "2026-09-08T14:02:00Z",
    "wms_order_ref": "SLL-88123",
    "shipments": [
      {
        "parcel_id": "PARCEL-001",
        "carrier": "colissimo",
        "tracking_number": "6A12345678901"
      }
    ]
  }' \
  "https://xhaccp.fr/api/wms/v1/orders/ord_01HXYZ.../events"
```

### Event body

| Field | Required | Description |
| --- | --- | --- |
| `event_id` | Yes | Stable partner-generated event identifier, maximum 160 characters |
| `event_type` | Yes* | Event status. `status` can be used as an alias |
| `status` | Yes* | Alias for `event_type`; use only one of the two |
| `occurred_at` | No | ISO timestamp of the warehouse event; current time is used if omitted |
| `wms_order_ref` | No | Partner's order reference |
| `shipments` | No | Array of parcel updates |

Accepted event types and aliases:

| Input | Stored fulfillment status |
| --- | --- |
| `ack`, `acknowledged` | `acknowledged` |
| `picking` | `picking` |
| `packed` | `packed` |
| `shipped` | `shipped` |
| `delivered` | `delivered` |
| `cancelled`, `canceled` | `cancelled` |
| `returned` | `returned` |
| `on_hold` | `on_hold` |

`received` is not currently an accepted event type. Unknown types return `422 INVALID_EVENT`.

### Shipment body

Each object in `shipments` may contain:

```json
{
  "parcel_id": "PARCEL-001",
  "tracking_number": "6A12345678901",
  "carrier": "colissimo"
}
```

`parcel_id` identifies a parcel within the order. Sending the same `parcel_id` again updates that parcel. Different parcel IDs create separate shipment records, so multi-parcel orders are supported. The API stores the carrier and tracking number; a tracking URL is not currently accepted or generated by this endpoint.

Example response:

```json
{
  "data": {
    "event_id": "evt_01J_SHIPPED_001",
    "status": "shipped"
  }
}
```

### Event behavior

- Events are stored with their original `occurred_at` and payload.
- A newer event can advance the fulfillment status.
- A stale event is still accepted and recorded, but it does not move the order backwards.
- Repeating an existing `event_id` returns `200` with `duplicate: true` and does not create another event.
- A duplicate `event_id` is treated as a duplicate even if the retried body differs; use a new event ID for a genuinely new event.
- A `shipped` event queues a customer shipment email after the API operation. An email failure does not turn a successful WMS response into an API failure.
- WMS cancellation changes the fulfillment state; it does not automatically refund the order.

Duplicate response example:

```json
{
  "data": {
    "event_id": "evt_01J_SHIPPED_001",
    "status": "shipped"
  },
  "duplicate": true
}
```

## 12. Send inventory

### `POST /inventory`

Required scope: `inventory:write`.

`X-Idempotency-Key` is required. A batch must contain between 1 and 1,000 items.

The preferred request shape is:

```json
{
  "items": [
    {
      "sku": "XH-SET-L",
      "quantity": 140,
      "available_quantity": 134,
      "updated_at": "2026-09-08T06:00:00Z"
    },
    {
      "sku": "XH-SET-S",
      "quantity": 88,
      "available_quantity": 88,
      "updated_at": "2026-09-08T06:00:00Z"
    }
  ]
}
```

The endpoint also accepts a raw JSON array or an object using `inventory` instead of `items`. For compatibility, `available` is accepted as an alias for `available_quantity`, and `source_updated_at` is accepted as an alias for `updated_at`.

Each item uses:

| Field | Required | Description |
| --- | --- | --- |
| `sku` | Yes | Must match an xHACCP catalog product code |
| `quantity` | Yes | Non-negative integer total quantity |
| `available_quantity` | Yes | Non-negative integer available quantity |
| `updated_at` | Yes | Source timestamp used for out-of-order protection |

Example request:

```bash
curl --fail-with-body -X POST \
  -H "Authorization: Bearer ${WMS_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: inventory-2026-09-08-0600" \
  -d '{
    "items": [
      {
        "sku": "XH-SET-L",
        "quantity": 140,
        "available_quantity": 134,
        "updated_at": "2026-09-08T06:00:00Z"
      }
    ]
  }' \
  "https://xhaccp.fr/api/wms/v1/inventory"
```

Example response:

```json
{
  "data": {
    "accepted_skus": ["XH-SET-L"],
    "ignored_stale_skus": [],
    "unknown_skus": []
  }
}
```

Inventory is stored per partner and SKU. If an incoming `updated_at` is older than or equal to the stored source timestamp, that SKU is returned in `ignored_stale_skus` and the stored value is kept.

Unknown product codes do not fail the entire batch. They are returned in `unknown_skus`. Invalid individual entries without a usable timestamp or non-negative integer quantities are skipped; partners should validate locally and monitor the response for missing SKUs.

Inventory storage is always enabled. Whether inventory affects storefront availability is controlled separately by xHACCP and is not a guarantee that a storefront quantity changes immediately.

## 13. Fulfillment state machine

The main forward path is:

```text
ready → acknowledged → picking → packed → shipped → delivered
```

The API allows a partner to skip intermediate states, for example `acknowledged → shipped`. It never regresses an order because an old event arrived late.

Additional states:

| State | Meaning |
| --- | --- |
| `cancelled` | The order was cancelled in the shop or by a cancellation event |
| `returned` | The warehouse reported a return |
| `on_hold` | Warehouse processing is temporarily blocked |

The WMS status is independent of the store's customer/order status. If an order disappears from the ready list after a shop-side change, run a reconciliation request with `updated_since` and contact xHACCP if the order needs to be re-queued.

## 14. Idempotency and retries

Use a unique `X-Idempotency-Key` for every logical write:

```http
X-Idempotency-Key: import-ord-01HXYZ-attempt-1
```

Rules:

1. The same key with the same request body replays the stored response.
2. The same key with a different body returns `409 IDEMPOTENCY_KEY_REUSED`.
3. A concurrent request using a key that is still running returns `409 IDEMPOTENCY_IN_PROGRESS`.
4. Retry network failures with the same key and unchanged body.
5. Do not generate a new key for a retry unless the original operation must be treated as a new logical operation.
6. For events, keep `event_id` stable across retries as well.

Acknowledge, event, and inventory requests all require the header, even where the underlying operation is naturally repeatable.

## 15. Recommended integration sequence

### Initial setup

1. Receive a sandbox key from xHACCP.
2. Confirm the base URL and the marketplace codes assigned to the partner.
3. Call `/health`.
4. Call `/orders?limit=1` with the sandbox key.
5. Confirm that the response contains the expected `data` and `pagination` properties.
6. Test a complete sandbox order lifecycle:
   - list the order;
   - import it;
   - acknowledge it;
   - send `picking`, `packed`, and `shipped` events;
   - send parcel tracking;
   - retry each write to verify idempotency.
7. Test an inventory batch with a known SKU, an unknown SKU, and an older timestamp.
8. Ask xHACCP to review the sandbox audit log.
9. Store the production key in the production WMS secret manager and run the same read-only smoke test.

### Production polling

A typical loop:

```text
GET /orders?limit=100
  → import each order
  → POST /orders/{ref}/ack with a stable idempotency key
  → follow pagination.next_cursor
  → repeat periodically with updated_since for reconciliation
```

Recommended operational safeguards:

- persist the last successful cursor with the corresponding import batch;
- do not acknowledge an order until it is durably imported;
- keep a request/response audit trail on the WMS side;
- alert on repeated `401`, `403`, `429`, and `5xx` responses;
- treat `404` as either an inaccessible/unknown order or an order that is no longer fulfillable;
- preserve original event timestamps while recording the local receipt time;
- never log authorization headers or request bodies containing personal data.

## 16. Partner onboarding checklist

Before production intake is enabled, confirm with xHACCP:

- [ ] Legal partner name and partner code are correct.
- [ ] The intended marketplaces (`ro`, `fr`, `com`) are routed to this partner.
- [ ] The routing is active only for marketplaces the partner can serve.
- [ ] The key has the minimum required scopes.
- [ ] Sandbox and production keys are stored separately.
- [ ] `/health` returns `200`.
- [ ] Authenticated `/orders?limit=1` returns `200`.
- [ ] A test order was acknowledged with an idempotency key.
- [ ] A test event and parcel were accepted.
- [ ] An inventory batch returned the expected accepted and unknown SKU lists.
- [ ] Duplicate requests replay safely.
- [ ] The WMS can continue using cursors and `updated_since`.
- [ ] The partner has a support contact and a procedure for key revocation.

## 17. Support information to include in a ticket

Never include an API key. Provide:

- environment: sandbox or production;
- marketplace code;
- endpoint and HTTP method;
- UTC timestamp;
- `X-Request-Id`;
- HTTP status and error code;
- public order reference, if relevant;
- your WMS import/event ID;
- a redacted request body if support needs to reproduce a validation error.

## 18. Current limitations

The following are intentionally outside the current partner API contract:

- outbound calls from xHACCP to the WMS;
- polling or retry orchestration performed by xHACCP;
- ASN/inbound notice synchronization;
- automatic refunds for WMS cancellation or return events;
- tracking URL storage or carrier-specific tracking URL generation;
- a separate public sandbox host;
- a public OpenAPI document.

If any of these capabilities is required, agree the contract with xHACCP before implementing it in the WMS.