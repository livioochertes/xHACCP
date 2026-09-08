# WMS production readiness

Use this checklist before connecting the first warehouse. The production API
key must be stored in Replit Secrets or the warehouse's secret manager. Never
paste the plaintext key into chat, a ticket, a commit, or this file.

## 1. Publish the schema safely

1. Confirm `shared/schema.ts` contains the WMS tables and order columns from
   `db/migrations/0006_wms_partner_api.sql`.
2. Publish from the current development database.
3. In the Publish schema review, confirm the WMS changes are additive:
   `fulfillment_partners`, `market_fulfillment`, `wms_api_keys`,
   `wms_shipments`, `wms_order_events`, `wms_inventory`,
   `wms_idempotency_keys`, `wms_audit_logs`, and the WMS order columns.
4. Do not choose overwrite production data. If Publish reports a rename or a
   drop, stop and resolve the schema difference before continuing.
5. Confirm the published app responds to
   `GET /api/wms/v1/health` with HTTP 200.

The repository does not run DDL during build or startup. Development schema
changes are applied through the normal post-merge flow, and production schema
changes are applied by Publish.

## 2. Record one routing decision per marketplace

In Admin → WMS partners, review all three cards:

- `ro`: activate the intended partner, or select the intended partner and
  leave **Rutare activă** unchecked.
- `fr`: make the same deliberate choice.
- `com`: make the same deliberate choice.

The overview marks a market as `activă`, `inactivă`, or `neconfigurată`.
Production readiness is complete only when all three are either active or
explicitly inactive. An unconfigured market is not an intentional decision.

An active route is used for new fulfillment snapshots. Changing routing does
not rewrite orders that already have a `fulfillment_partner_id`; requeue those
orders only after confirming the desired partner.

## 3. Test sandbox and production keys independently

Create one Sandbox key and one Production key for the intended partner. Store
the plaintext production key outside chat, then expose both values to the
local smoke check only through environment variables:

```sh
WMS_BASE_URL=https://your-published-domain \
WMS_SANDBOX_API_KEY="$WMS_SANDBOX_API_KEY" \
WMS_PRODUCTION_API_KEY="$WMS_PRODUCTION_API_KEY" \
npm run check:wms-production
```

The check verifies the public health endpoint, the `wms_test_` and `wms_live_`
prefixes, and an authenticated orders request for each key. It never prints
either plaintext key. Review the WMS audit log after the run and confirm the
two requests belong to the expected partner and key records.

After the warehouse passes its own sandbox test, keep the sandbox key for
future certification and only then enable the production route/key.